/**
 * Vínculo CT-e ↔ NF-e mercadoria (automático pela chave do XML ou manual).
 */
import { randomUUID } from 'crypto'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { normalizarCnpj } from '../../compartilhado/validacoes/documentos.js'
import {
  extrairCamposResumoDoXml,
  extrairChavesNfeReferenciadasDoCte,
  extrairCnpjTomadorCte,
  normalizarXmlNfe,
  xmlNfeTemItensParseaveis,
} from '../focus-nfe/parser-xml-nfe.js'
import {
  logFocus,
  logTabelaVinculoCte,
  type LinhaTabelaVinculoCte,
} from '../focus-nfe/logs-focus-nfe.js'
import { importarNfePorChave } from '../focus-nfe/importar-nfe-por-chave.js'
import { repositorioFocusNfe } from '../focus-nfe/repositorio-focus-nfe.js'

export type CteAguardandoNf = {
  cteId: string
  chaveCte: string
  chaveNfe: string | null
  status: string
  motivo: string
}

/** Compara CNPJ/CPF do tomador do CT-e com o CNPJ da empresa. */
async function empresaEhTomadorDoCte(
  companyId: string,
  xmlCte: string
): Promise<{ ok: boolean; tomador: string | null; cnpjEmpresa: string | null }> {
  const empresa = await repositorioFocusNfe.buscarEmpresaCnpj(companyId)
  const cnpjEmpresa = empresa?.cnpj ? normalizarCnpj(empresa.cnpj) : null
  const tomadorRaw = extrairCnpjTomadorCte(xmlCte)
  const tomador = tomadorRaw ? normalizarCnpj(tomadorRaw) : null
  if (!cnpjEmpresa || !tomador) {
    return { ok: false, tomador, cnpjEmpresa }
  }
  return { ok: tomador === cnpjEmpresa, tomador, cnpjEmpresa }
}

function nfeProntaParaVinculoAutomatico(nfe: {
  tipoDocumento: string | null
  xmlConteudo: string | null
  nfeCompleta: boolean
}): boolean {
  if (nfe.tipoDocumento !== 'nfe55' || !nfe.xmlConteudo) return false
  return xmlNfeTemItensParseaveis(nfe.xmlConteudo)
}

function motivoCurtoPendente(
  analiseJson: unknown,
  chaveRef: string | null
): string {
  const chave = chaveRef?.replace(/\D/g, '') ?? ''
  if (chave.length !== 44) return 'Sem chave NF no XML'
  if (jaTentouFocusSemSucesso(analiseJson)) return 'Focus 404 — DistDFe'
  return 'Aguardando NF no ERP'
}

function oQueFazerPendente(motivo: string): string {
  if (motivo.includes('Focus 404')) return 'Importe o XML da NF; o sistema vincula sozinho'
  if (motivo.includes('Sem chave')) return 'Vínculo manual na NF de mercadoria'
  return 'Aguarde sync ou importe o XML da NF'
}

function decimalNum(v: { toNumber?: () => number } | number | null | undefined): number | null {
  if (v == null) return null
  if (typeof v === 'number') return v
  if (typeof v.toNumber === 'function') return v.toNumber()
  return Number(v)
}

/** Evita re-bater Focus em CT-e que já falhou com 404/DistDFe nesta análise. */
function jaTentouFocusSemSucesso(analiseJson: unknown): boolean {
  if (!analiseJson || typeof analiseJson !== 'object') return false
  const a = analiseJson as {
    motivoParada?: string | null
    negociacao?: { bloqueios?: string[] }
  }
  if (a.motivoParada !== 'vinculo_nfe') return false
  return (a.negociacao?.bloqueios ?? []).some((b) =>
    /Focus|404|DistDFe|não encontrou/i.test(b)
  )
}

type EtapaAnaliseMin = { status: string; avisos: string[]; bloqueios: string[] }

/** Grava bloqueio vinculo_nfe com motivo Focus — lista/detalhe e evita retry no lote. */
async function registrarFalhaVinculoNaAnalise(
  cteId: string,
  chaveRef: string | null,
  falha: string
) {
  const cte = await clientePrisma.nfeRecebida.findUnique({
    where: { id: cteId },
    select: { analiseJson: true },
  })
  const atual =
    cte?.analiseJson && typeof cte.analiseJson === 'object'
      ? (cte.analiseJson as Record<string, unknown>)
      : {}
  const cadastro: EtapaAnaliseMin =
    (atual.cadastro as EtapaAnaliseMin) ?? { status: 'ok', avisos: [], bloqueios: [] }
  const fiscal: EtapaAnaliseMin = (atual.fiscal as EtapaAnaliseMin) ?? {
    status: 'ok',
    avisos: ['CTe: análise fiscal de itens de produto não se aplica.'],
    bloqueios: [],
  }
  const bloqueio = `CTe referencia a NF ${chaveRef?.slice(-8) ?? ''}…. Tentativa automática de importar pela Focus falhou: ${falha}`
  await clientePrisma.nfeRecebida.update({
    where: { id: cteId },
    data: {
      analiseJson: {
        versao: 1,
        atualizadoEm: new Date().toISOString(),
        cadastro,
        fiscal,
        negociacao: { status: 'bloqueante', avisos: [], bloqueios: [bloqueio] },
        autoLancado: false,
        motivoParada: 'vinculo_nfe',
      },
    },
  })
}

async function reanalisarCteAposVinculo(companyId: string, cteId: string) {
  try {
    const { servicoEntradaNotas } = await import('./servico-pipeline-entrada.js')
    await servicoEntradaNotas.analisarNota(companyId, cteId)
  } catch (e) {
    logFocus('warn', 'cte_reanalise_apos_vinculo_falhou', {
      companyId,
      cteId,
      mensagem: e instanceof Error ? e.message : String(e),
    })
  }
}

export type ResultadoVinculoCteAuto = {
  vinculado: boolean
  /** Motivo da última falha de import Focus (se tentou e não vinculou). */
  falhaImport?: string
  /** CT-e sem chave de NF no XML — não chama Focus. */
  semChaveNfe?: boolean
  /** Tomador do CT-e ≠ CNPJ da empresa — sem auto-vínculo. */
  tomadorNaoEmpresa?: boolean
}

async function criarVinculo(params: {
  companyId: string
  nfeRecebidaId: string
  cteRecebidaId: string
  chaveNfeReferenciada: string | null
  origemVinculo: 'automatico' | 'manual'
  valorFrete: number | null
}) {
  const existente = await clientePrisma.nfeCteVinculo.findUnique({
    where: { cteRecebidaId: params.cteRecebidaId },
  })
  if (existente) {
    if (existente.nfeRecebidaId === params.nfeRecebidaId) return existente
    throw new ErroDaAplicacao('Este CT-e já está vinculado a outra NF-e.', 409)
  }

  return clientePrisma.nfeCteVinculo.create({
    data: {
      id: randomUUID(),
      companyId: params.companyId,
      nfeRecebidaId: params.nfeRecebidaId,
      cteRecebidaId: params.cteRecebidaId,
      chaveNfeReferenciada: params.chaveNfeReferenciada,
      origemVinculo: params.origemVinculo,
      valorFrete: params.valorFrete,
      updatedAt: new Date(),
    },
  })
}

/**
 * Após XML de CT-e: grava chave referenciada e tenta vincular às NFs.
 * Focus só é chamado se houver chave de NF (nota de frete/mercadoria) e a NF
 * ainda não estiver no ERP — e se `importarFocusSeAusente` for true.
 * Auto-vínculo exige: NFe com itens parseáveis + tomador do CT-e = CNPJ da empresa.
 * 1 CT-e → 1 NF (primeira chave que conseguir vincular).
 */
async function tentarVincularCteAutomatico(
  companyId: string,
  cteId: string,
  opcoes?: { importarFocusSeAusente?: boolean }
): Promise<ResultadoVinculoCteAuto> {
  const importarFocusSeAusente = opcoes?.importarFocusSeAusente !== false
  const cte = await clientePrisma.nfeRecebida.findFirst({
    where: { id: cteId, companyId, tipoDocumento: 'cte' },
  })
  if (!cte?.xmlConteudo) return { vinculado: false }

  const xml = normalizarXmlNfe(cte.xmlConteudo)
  const tomadorCheck = await empresaEhTomadorDoCte(companyId, xml)
  if (!tomadorCheck.ok) {
    logFocus('info', 'cte_auto_vinculo_tomador_nao_empresa', {
      companyId,
      cteId: cte.id,
      chaveCte: cte.chaveNfe.slice(-8),
      tomador: tomadorCheck.tomador,
      cnpjEmpresa: tomadorCheck.cnpjEmpresa,
    })
    return { vinculado: false, tomadorNaoEmpresa: true }
  }

  const chavesXml = extrairChavesNfeReferenciadasDoCte(xml)
  const resumo = extrairCamposResumoDoXml(xml)
  // Chave que o próprio CT-e entrega: persistida (UI) + XML — sem duplicar
  const chaves: string[] = []
  const adicionarChave = (raw: string | null | undefined) => {
    if (!raw) return
    const digitos = raw.replace(/\D/g, '')
    if (
      digitos.length === 44 &&
      digitos.slice(20, 22) === '55' &&
      !chaves.includes(digitos)
    ) {
      chaves.push(digitos)
    }
  }
  adicionarChave(cte.chaveNfeReferenciada)
  for (const c of chavesXml) adicionarChave(c)
  const chavePrimaria = chaves[0] ?? null

  await clientePrisma.nfeRecebida.update({
    where: { id: cte.id },
    data: { chaveNfeReferenciada: chavePrimaria },
  })

  if (chaves.length === 0) {
    logFocus('info', 'cte_sem_chave_nfe_referenciada', {
      companyId,
      cteId: cte.id,
      chaveCte: cte.chaveNfe.slice(-8),
    })
    return { vinculado: false, semChaveNfe: true }
  }

  const jaVinculado = await clientePrisma.nfeCteVinculo.findUnique({
    where: { cteRecebidaId: cte.id },
  })
  if (jaVinculado) return { vinculado: true }

  let ultimaFalhaImport: string | undefined
  const chavesJaTentadasImport = new Set<string>()

  for (const chave of chaves) {
    let nfe = await clientePrisma.nfeRecebida.findUnique({
      where: { companyId_chaveNfe: { companyId, chaveNfe: chave } },
    })

    if (!nfe || !nfeProntaParaVinculoAutomatico(nfe)) {
      if (!importarFocusSeAusente) {
        ultimaFalhaImport =
          ultimaFalhaImport ??
          `NF …${chave.slice(-8)} ainda não está completa no ERP (vínculo local pendente).`
        continue
      }
      if (chavesJaTentadasImport.has(chave)) continue
      chavesJaTentadasImport.add(chave)

      let importacao: Awaited<ReturnType<typeof importarNfePorChave>>
      try {
        importacao = await importarNfePorChave(companyId, chave)
      } catch (e) {
        const mensagem = e instanceof Error ? e.message : String(e)
        ultimaFalhaImport = `Erro ao importar NF …${chave.slice(-8)}: ${mensagem}`
        logFocus('warn', 'cte_import_nfe_referenciada_excecao', {
          companyId,
          cteId: cte.id,
          chaveNfe: chave.slice(-8),
          mensagem,
        })
        continue
      }
      if (!importacao.ok) {
        ultimaFalhaImport = importacao.mensagem
        logFocus('warn', 'cte_import_nfe_referenciada_falhou', {
          companyId,
          cteId: cte.id,
          chaveNfe: chave.slice(-8),
          mensagem: importacao.mensagem,
        })
        continue
      }

      nfe = await clientePrisma.nfeRecebida.findUnique({
        where: { companyId_chaveNfe: { companyId, chaveNfe: chave } },
      })
      if (!nfe && importacao.ok) {
        nfe = await clientePrisma.nfeRecebida.findFirst({
          where: { id: importacao.notaId, companyId },
        })
      }
      if (!nfe || !nfeProntaParaVinculoAutomatico(nfe)) {
        ultimaFalhaImport =
          ultimaFalhaImport ??
          `NF …${chave.slice(-8)} importada sem itens parseáveis — sem auto-vínculo.`
        continue
      }
    }

    try {
      await criarVinculo({
        companyId,
        nfeRecebidaId: nfe.id,
        cteRecebidaId: cte.id,
        chaveNfeReferenciada: chave,
        origemVinculo: 'automatico',
        valorFrete: resumo.valorTotal ?? decimalNum(cte.valorTotal),
      })
      logFocus('info', 'cte_vinculado_automatico', {
        companyId,
        cteId: cte.id,
        nfeId: nfe.id,
        chaveNfe: chave.slice(-8),
      })
      return { vinculado: true }
    } catch (e) {
      if (e instanceof ErroDaAplicacao && e.statusCode === 409) {
        return { vinculado: true }
      }
      throw e
    }
  }

  return { vinculado: false, falhaImport: ultimaFalhaImport }
}

/**
 * Varre CT-es sem vínculo: primeiro só banco (sem Focus); depois, só para os que
 * têm chave de NF referenciada e ainda sem vínculo, tenta Focus se permitido.
 * `forcarRetryFocus: true` = BUSCAR / Reanalisar em massa — re-bate Focus mesmo após 404.
 * Sem flag = F5 / abertura da lista — só vínculo local + Focus se ainda não tentou.
 */
async function processarVinculosCtePendentes(
  companyId: string,
  opcoes?: { importarFocusSeAusente?: boolean; forcarRetryFocus?: boolean }
): Promise<{
  analisados: number
  vinculados: number
  importadosFocus: number
  semChave: number
  pendentes: number
  pendentesDetalhe: CteAguardandoNf[]
}> {
  const importarFocus = opcoes?.importarFocusSeAusente !== false
  const forcarRetryFocus = opcoes?.forcarRetryFocus === true

  const ctes = await clientePrisma.nfeRecebida.findMany({
    where: {
      companyId,
      tipoDocumento: 'cte',
      xmlConteudo: { not: null },
      vinculosComoCte: { none: {} },
      statusEntrada: { notIn: ['cancelada'] },
    },
    select: {
      id: true,
      chaveNfe: true,
      chaveNfeReferenciada: true,
      analiseJson: true,
    },
    orderBy: { dataEmissao: 'desc' },
    take: 500,
  })

  let vinculados = 0
  let semChave = 0
  let pendentes = 0
  let importadosFocus = 0
  const linhasTabela: LinhaTabelaVinculoCte[] = []

  const pushLinha = (
    cte: { chaveNfe: string; chaveNfeReferenciada: string | null },
    etapa: string,
    http: string | number,
    resultado: string,
    oQueFazer: string
  ) => {
    linhasTabela.push({
      etapa,
      chaveNF: cte.chaveNfeReferenciada ?? '—',
      http,
      resultado: `${resultado} (CT-e …${cte.chaveNfe.slice(-8)})`,
      oQueFazer,
    })
  }

  // 1ª passagem: só vínculo local (zero Focus)
  for (const cte of ctes) {
    const r = await tentarVincularCteAutomatico(companyId, cte.id, {
      importarFocusSeAusente: false,
    })
    if (r.vinculado) {
      vinculados += 1
      await reanalisarCteAposVinculo(companyId, cte.id)
      pushLinha(cte, 'local', '—', 'vinculado', 'Nada — já ligado à NF no ERP')
      continue
    }
    if (r.semChaveNfe) {
      semChave += 1
      pushLinha(cte, 'local', '—', 'sem chave NF', oQueFazerPendente('Sem chave'))
      continue
    }
    if (r.tomadorNaoEmpresa) {
      pushLinha(
        cte,
        'local',
        '—',
        'tomador ≠ empresa',
        'Sem auto-vínculo — frete não é da empresa; vínculo manual se necessário'
      )
      continue
    }
    pendentes += 1
  }

  // 2ª passagem: Focus só se tem chave de NF e ainda sem vínculo
  if (importarFocus && pendentes > 0) {
    const aindaPendentes = await clientePrisma.nfeRecebida.findMany({
      where: {
        companyId,
        tipoDocumento: 'cte',
        xmlConteudo: { not: null },
        chaveNfeReferenciada: { not: null },
        vinculosComoCte: { none: {} },
        statusEntrada: { notIn: ['cancelada'] },
      },
      select: {
        id: true,
        chaveNfe: true,
        chaveNfeReferenciada: true,
        analiseJson: true,
      },
      take: 80,
    })

    pendentes = 0
    let focusRestantes = 20
    for (const cte of aindaPendentes) {
      // Sem forcarRetryFocus: não re-bate Focus se a análise já registrou 404/falha
      if (!forcarRetryFocus && jaTentouFocusSemSucesso(cte.analiseJson)) {
        pendentes += 1
        const motivo = motivoCurtoPendente(cte.analiseJson, cte.chaveNfeReferenciada)
        pushLinha(cte, 'lote (sem retry)', 404, motivo, oQueFazerPendente(motivo))
        continue
      }

      const chave = cte.chaveNfeReferenciada?.replace(/\D/g, '') ?? ''
      if (chave.length !== 44) {
        pendentes += 1
        pushLinha(cte, 'lote', '—', 'chave inválida', oQueFazerPendente('Sem chave'))
        continue
      }

      const jaTinhaNfe = await clientePrisma.nfeRecebida.findUnique({
        where: { companyId_chaveNfe: { companyId, chaveNfe: chave } },
        select: { id: true, nfeCompleta: true, xmlConteudo: true, tipoDocumento: true },
      })

      const precisaFocus =
        !jaTinhaNfe || !nfeProntaParaVinculoAutomatico(jaTinhaNfe)
      if (precisaFocus && focusRestantes <= 0) {
        pendentes += 1
        pushLinha(cte, 'Focus', '—', 'cota lote esgotada', 'Use BUSCAR de novo ou importe XML')
        continue
      }

      const r = await tentarVincularCteAutomatico(companyId, cte.id, {
        importarFocusSeAusente: precisaFocus,
      })
      if (precisaFocus) focusRestantes -= 1

      if (r.vinculado) {
        vinculados += 1
        if (precisaFocus) importadosFocus += 1
        await reanalisarCteAposVinculo(companyId, cte.id)
        pushLinha(
          cte,
          precisaFocus ? 'Focus' : 'local',
          precisaFocus ? 200 : '—',
          precisaFocus ? 'importou e vinculou' : 'vinculado',
          'Nada'
        )
      } else if (r.tomadorNaoEmpresa) {
        pushLinha(
          cte,
          'local',
          '—',
          'tomador ≠ empresa',
          'Sem auto-vínculo — frete não é da empresa; vínculo manual se necessário'
        )
      } else if (!r.semChaveNfe) {
        pendentes += 1
        if (precisaFocus && r.falhaImport) {
          await registrarFalhaVinculoNaAnalise(cte.id, chave, r.falhaImport)
        }
        const motivo = r.falhaImport
          ? /404|DistDFe|não encontr/i.test(r.falhaImport)
            ? 'Focus 404 — DistDFe'
            : r.falhaImport.slice(0, 80)
          : motivoCurtoPendente(cte.analiseJson, chave)
        const http = /404/.test(r.falhaImport ?? '') ? 404 : precisaFocus ? '?' : '—'
        pushLinha(cte, precisaFocus ? 'Focus' : 'local', http, motivo, oQueFazerPendente(motivo))
      }
    }
  }

  const pendentesDetalhe = await listarCtesAguardandoNf(companyId)

  logTabelaVinculoCte(
    forcarRetryFocus
      ? 'Lote CT-e (BUSCAR / retry Focus)'
      : 'Lote CT-e (abertura lista / sem martelar Focus)',
    linhasTabela,
    {
      companyId,
      analisados: ctes.length,
      vinculados,
      importadosFocus,
      semChave,
      pendentes: pendentesDetalhe.length,
      forcarRetryFocus,
    }
  )

  return {
    analisados: ctes.length,
    vinculados,
    importadosFocus,
    semChave,
    pendentes: pendentesDetalhe.length,
    pendentesDetalhe,
  }
}

/** CT-es com chave de NF e sem NfeCteVinculo — painel da lista (todas as chaves). */
async function listarCtesAguardandoNf(companyId: string): Promise<CteAguardandoNf[]> {
  const ctes = await clientePrisma.nfeRecebida.findMany({
    where: {
      companyId,
      tipoDocumento: 'cte',
      xmlConteudo: { not: null },
      vinculosComoCte: { none: {} },
      statusEntrada: { notIn: ['cancelada'] },
    },
    select: {
      id: true,
      chaveNfe: true,
      chaveNfeReferenciada: true,
      analiseJson: true,
      statusEntrada: true,
    },
    orderBy: { dataEmissao: 'desc' },
    take: 200,
  })

  return ctes
    .filter((c) => {
      const chave = c.chaveNfeReferenciada?.replace(/\D/g, '') ?? ''
      return chave.length === 44
    })
    .map((c) => {
      const motivo = motivoCurtoPendente(c.analiseJson, c.chaveNfeReferenciada)
      return {
        cteId: c.id,
        chaveCte: c.chaveNfe,
        chaveNfe: c.chaveNfeReferenciada,
        status: c.statusEntrada,
        motivo,
      }
    })
}

/**
 * Após XML de NF-e (sync ou Importar XML): vincula **todos** os CT-es que
 * referenciam esta chave e reanalisa cada CT-e + a NF (gate frete).
 * Só auto-vincula se a NFe tiver itens parseáveis e o tomador do CT-e = empresa.
 */
async function tentarVincularNfesPendentesAoCte(companyId: string, nfeId: string): Promise<void> {
  const nfe = await clientePrisma.nfeRecebida.findFirst({
    where: { id: nfeId, companyId, tipoDocumento: 'nfe55' },
  })
  if (!nfe || !nfeProntaParaVinculoAutomatico(nfe)) return

  const cteIdsVinculados = new Set<string>()
  const linhasTabela: LinhaTabelaVinculoCte[] = []

  const tentarCriar = async (
    cte: { id: string; chaveNfe: string; xmlConteudo: string | null; valorTotal: unknown },
    etapa: string
  ) => {
    if (!cte.xmlConteudo) return
    const tomadorCheck = await empresaEhTomadorDoCte(companyId, cte.xmlConteudo)
    if (!tomadorCheck.ok) {
      linhasTabela.push({
        etapa,
        chaveNF: nfe.chaveNfe,
        http: '—',
        resultado: `tomador ≠ empresa (CT-e …${cte.chaveNfe.slice(-8)})`,
        oQueFazer: 'Sem auto-vínculo — vínculo manual se necessário',
      })
      return
    }
    const valor =
      cte.xmlConteudo != null
        ? extrairCamposResumoDoXml(cte.xmlConteudo).valorTotal
        : decimalNum(cte.valorTotal as { toNumber?: () => number } | number | null)
    try {
      await criarVinculo({
        companyId,
        nfeRecebidaId: nfe.id,
        cteRecebidaId: cte.id,
        chaveNfeReferenciada: nfe.chaveNfe,
        origemVinculo: 'automatico',
        valorFrete: valor,
      })
      cteIdsVinculados.add(cte.id)
      linhasTabela.push({
        etapa,
        chaveNF: nfe.chaveNfe,
        http: '—',
        resultado: `vinculado (CT-e …${cte.chaveNfe.slice(-8)})`,
        oQueFazer: 'Nada',
      })
    } catch {
      // já vinculado em corrida
    }
  }

  const ctes = await clientePrisma.nfeRecebida.findMany({
    where: {
      companyId,
      tipoDocumento: 'cte',
      chaveNfeReferenciada: nfe.chaveNfe,
      vinculosComoCte: { none: {} },
    },
  })

  for (const cte of ctes) {
    await tentarCriar(cte, 'auto pós-NF')
  }

  // CT-es com XML mas sem chaveNfeReferenciada persistida: reparse
  const ctesComXml = await clientePrisma.nfeRecebida.findMany({
    where: {
      companyId,
      tipoDocumento: 'cte',
      xmlConteudo: { not: null },
      vinculosComoCte: { none: {} },
    },
    select: { id: true, chaveNfe: true, xmlConteudo: true, valorTotal: true },
    take: 200,
  })
  for (const cte of ctesComXml) {
    if (cteIdsVinculados.has(cte.id) || !cte.xmlConteudo) continue
    const chaves = extrairChavesNfeReferenciadasDoCte(cte.xmlConteudo)
    if (!chaves.includes(nfe.chaveNfe)) continue
    await clientePrisma.nfeRecebida.update({
      where: { id: cte.id },
      data: { chaveNfeReferenciada: chaves[0] ?? nfe.chaveNfe },
    })
    await tentarCriar(cte, 'auto pós-NF (reparse)')
  }

  for (const cteId of cteIdsVinculados) {
    await reanalisarCteAposVinculo(companyId, cteId)
  }
  if (cteIdsVinculados.size > 0) {
    await reanalisarCteAposVinculo(companyId, nfe.id)
  }

  if (linhasTabela.length > 0) {
    logTabelaVinculoCte('Auto-vínculo quando a NF chegou', linhasTabela, {
      companyId,
      nfeId: nfe.id,
      chaveNfe: nfe.chaveNfe.slice(-8),
      ctesVinculados: cteIdsVinculados.size,
    })
  }
}

/**
 * Remove vínculos **automáticos** cujo tomador do CT-e ≠ CNPJ da empresa
 * (ex.: Fortlev↔KNA quando Fortlev é o tomador). Manuais preservados.
 * Reanalisa NFs afetadas para limpar gate frete / ✓ da lista.
 */
async function repararVinculosCteTomadorIndevido(companyId: string): Promise<number> {
  const vinculos = await clientePrisma.nfeCteVinculo.findMany({
    where: { companyId, origemVinculo: 'automatico' },
    include: {
      cteRecebida: { select: { id: true, xmlConteudo: true, chaveNfe: true } },
      nfeRecebida: { select: { id: true } },
    },
    take: 500,
  })

  const nfeIdsParaReanalisar = new Set<string>()
  let removidos = 0

  for (const v of vinculos) {
    const xml = v.cteRecebida.xmlConteudo
    if (!xml) continue
    const check = await empresaEhTomadorDoCte(companyId, xml)
    if (check.ok) continue

    await clientePrisma.nfeCteVinculo.delete({ where: { id: v.id } })
    removidos += 1
    nfeIdsParaReanalisar.add(v.nfeRecebidaId)
    logFocus('info', 'cte_vinculo_auto_removido_tomador', {
      companyId,
      vinculoId: v.id,
      cteId: v.cteRecebidaId,
      nfeId: v.nfeRecebidaId,
      chaveCte: v.cteRecebida.chaveNfe.slice(-8),
      tomador: check.tomador,
    })
  }

  for (const nfeId of nfeIdsParaReanalisar) {
    await reanalisarCteAposVinculo(companyId, nfeId)
  }

  return removidos
}

/**
 * Cancela CT-e automáticos (origem Focus) cujo tomador ≠ CNPJ da empresa,
 * ainda sem entrada consolidada/contagem. Remove vínculos e reanalisa as NFs.
 * Import XML manual (origem=xml) é preservado.
 */
async function repararCtesTomadorIndevido(companyId: string): Promise<number> {
  const ctes = await clientePrisma.nfeRecebida.findMany({
    where: {
      companyId,
      tipoDocumento: 'cte',
      origem: 'focus',
      xmlConteudo: { not: null },
      statusEntrada: {
        notIn: [
          'entrada_contagem',
          'entrada_contagem_ok',
          'entrada_contagem_divergente',
          'entrada_consolidada',
          'cancelada',
        ],
      },
    },
    select: { id: true, xmlConteudo: true, chaveNfe: true },
    take: 500,
  })

  const nfeIdsParaReanalisar = new Set<string>()
  let cancelados = 0

  for (const cte of ctes) {
    if (!cte.xmlConteudo) continue
    const check = await empresaEhTomadorDoCte(companyId, cte.xmlConteudo)
    if (check.ok) continue

    const vinculos = await clientePrisma.nfeCteVinculo.findMany({
      where: { companyId, cteRecebidaId: cte.id },
      select: { id: true, nfeRecebidaId: true },
    })
    for (const v of vinculos) {
      await clientePrisma.nfeCteVinculo.delete({ where: { id: v.id } })
      nfeIdsParaReanalisar.add(v.nfeRecebidaId)
    }

    await clientePrisma.nfeRecebida.update({
      where: { id: cte.id },
      data: { statusEntrada: 'cancelada' },
    })
    cancelados += 1
    logFocus('info', 'cte_cancelado_tomador_indevido', {
      companyId,
      cteId: cte.id,
      chaveCte: cte.chaveNfe.slice(-8),
      tomador: check.tomador,
      cnpjEmpresa: check.cnpjEmpresa,
    })
  }

  for (const nfeId of nfeIdsParaReanalisar) {
    await reanalisarCteAposVinculo(companyId, nfeId)
  }

  return cancelados
}

async function vincularCteManual(
  companyId: string,
  nfeId: string,
  params: { chaveCte?: string; cteId?: string }
) {
  const nfe = await clientePrisma.nfeRecebida.findFirst({
    where: { id: nfeId, companyId, tipoDocumento: 'nfe55' },
  })
  if (!nfe) throw new ErroDaAplicacao('NF-e de mercadoria não encontrada', 404)

  let cte = null as Awaited<ReturnType<typeof clientePrisma.nfeRecebida.findFirst>>
  if (params.cteId) {
    cte = await clientePrisma.nfeRecebida.findFirst({
      where: { id: params.cteId, companyId, tipoDocumento: 'cte' },
    })
  } else if (params.chaveCte) {
    const chave = params.chaveCte.replace(/\D/g, '')
    cte = await clientePrisma.nfeRecebida.findFirst({
      where: { companyId, chaveNfe: chave, tipoDocumento: 'cte' },
    })
    // CT-e ainda não no banco: puxa sozinho da Focus pela chave (igual sync DistDFe).
    if (!cte && chave.length === 44) {
      const { importarCtePorChave } = await import('../focus-nfe/importar-cte-por-chave.js')
      const importado = await importarCtePorChave(companyId, chave)
      if (importado.ok) {
        cte = await clientePrisma.nfeRecebida.findFirst({
          where: { id: importado.cteId, companyId, tipoDocumento: 'cte' },
        })
      } else if (importado.motivo !== 'chave_invalida') {
        throw new ErroDaAplicacao(importado.mensagem, 400)
      }
    }
  }
  if (!cte) throw new ErroDaAplicacao('CT-e não encontrado na empresa.', 404)

  let chaveRef: string | null = cte.chaveNfeReferenciada
  let valorFrete = decimalNum(cte.valorTotal)
  if (cte.xmlConteudo) {
    const chaves = extrairChavesNfeReferenciadasDoCte(cte.xmlConteudo)
    const resumo = extrairCamposResumoDoXml(cte.xmlConteudo)
    valorFrete = resumo.valorTotal ?? valorFrete
    if (chaves.length > 0 && !chaves.includes(nfe.chaveNfe)) {
      // permite vínculo manual mesmo com chave divergente (fallback humano)
      chaveRef = nfe.chaveNfe
    } else {
      chaveRef = chaves[0] ?? nfe.chaveNfe
    }
  } else {
    chaveRef = nfe.chaveNfe
  }

  return criarVinculo({
    companyId,
    nfeRecebidaId: nfe.id,
    cteRecebidaId: cte.id,
    chaveNfeReferenciada: chaveRef,
    origemVinculo: 'manual',
    valorFrete,
  })
}

async function desvincularCte(companyId: string, nfeId: string, vinculoId: string) {
  const vinculo = await clientePrisma.nfeCteVinculo.findFirst({
    where: { id: vinculoId, companyId, nfeRecebidaId: nfeId },
  })
  if (!vinculo) throw new ErroDaAplicacao('Vínculo não encontrado', 404)
  await clientePrisma.nfeCteVinculo.delete({ where: { id: vinculo.id } })
}

async function listarVinculosDaNfe(companyId: string, nfeId: string) {
  return clientePrisma.nfeCteVinculo.findMany({
    where: { companyId, nfeRecebidaId: nfeId },
    include: {
      cteRecebida: {
        select: {
          id: true,
          chaveNfe: true,
          nomeEmitente: true,
          documentoEmitente: true,
          valorTotal: true,
          dataEmissao: true,
          statusEntrada: true,
          fornecedorPessoaId: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
}

async function listarVinculosDoCte(companyId: string, cteId: string) {
  return clientePrisma.nfeCteVinculo.findMany({
    where: { companyId, cteRecebidaId: cteId },
    include: {
      nfeRecebida: {
        select: {
          id: true,
          chaveNfe: true,
          nomeEmitente: true,
          valorTotal: true,
          statusEntrada: true,
        },
      },
    },
  })
}

export const servicoVinculoCte = {
  tentarVincularCteAutomatico,
  processarVinculosCtePendentes,
  listarCtesAguardandoNf,
  tentarVincularNfesPendentesAoCte,
  repararVinculosCteTomadorIndevido,
  repararCtesTomadorIndevido,
  vincularCteManual,
  desvincularCte,
  listarVinculosDaNfe,
  listarVinculosDoCte,
}
