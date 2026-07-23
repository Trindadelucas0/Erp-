/**
 * Vínculo CT-e ↔ NF-e mercadoria (automático pela chave do XML ou manual).
 */
import { randomUUID } from 'crypto'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import {
  extrairCamposResumoDoXml,
  extrairChavesNfeReferenciadasDoCte,
  normalizarXmlNfe,
} from '../focus-nfe/parser-xml-nfe.js'
import { logFocus } from '../focus-nfe/logs-focus-nfe.js'
import { importarNfePorChave } from '../focus-nfe/importar-nfe-por-chave.js'

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

    if (!nfe || nfe.tipoDocumento !== 'nfe55' || !nfe.xmlConteudo || !nfe.nfeCompleta) {
      if (!importarFocusSeAusente) {
        ultimaFalhaImport =
          ultimaFalhaImport ??
          `NF …${chave.slice(-8)} ainda não está no ERP (vínculo local pendente).`
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
      if (!nfe || nfe.tipoDocumento !== 'nfe55') continue
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
    select: { id: true },
    orderBy: { dataEmissao: 'desc' },
    take: 500,
  })

  let vinculados = 0
  let semChave = 0
  let pendentes = 0
  let importadosFocus = 0

  // 1ª passagem: só vínculo local (zero Focus)
  for (const cte of ctes) {
    const r = await tentarVincularCteAutomatico(companyId, cte.id, {
      importarFocusSeAusente: false,
    })
    if (r.vinculado) {
      vinculados += 1
      await reanalisarCteAposVinculo(companyId, cte.id)
      continue
    }
    if (r.semChaveNfe) {
      semChave += 1
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
      select: { id: true, chaveNfeReferenciada: true, analiseJson: true },
      take: 80,
    })

    pendentes = 0
    let focusRestantes = 20
    for (const cte of aindaPendentes) {
      // Sem forcarRetryFocus: não re-bate Focus se a análise já registrou 404/falha
      if (!forcarRetryFocus && jaTentouFocusSemSucesso(cte.analiseJson)) {
        pendentes += 1
        continue
      }

      const chave = cte.chaveNfeReferenciada?.replace(/\D/g, '') ?? ''
      if (chave.length !== 44) {
        pendentes += 1
        continue
      }

      const jaTinhaNfe = await clientePrisma.nfeRecebida.findUnique({
        where: { companyId_chaveNfe: { companyId, chaveNfe: chave } },
        select: { id: true, nfeCompleta: true, xmlConteudo: true },
      })

      const precisaFocus = !jaTinhaNfe?.xmlConteudo || !jaTinhaNfe.nfeCompleta
      if (precisaFocus && focusRestantes <= 0) {
        pendentes += 1
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
      } else if (!r.semChaveNfe) {
        pendentes += 1
        if (precisaFocus && r.falhaImport) {
          await registrarFalhaVinculoNaAnalise(cte.id, chave, r.falhaImport)
        }
      }
    }
  }

  logFocus('info', 'cte_vinculos_lote', {
    companyId,
    analisados: ctes.length,
    vinculados,
    importadosFocus,
    semChave,
    pendentes,
  })

  return {
    analisados: ctes.length,
    vinculados,
    importadosFocus,
    semChave,
    pendentes,
  }
}

/**
 * Após XML de NF-e: procura CT-es com esta chave referenciada ainda sem vínculo.
 */
async function tentarVincularNfesPendentesAoCte(companyId: string, nfeId: string): Promise<void> {
  const nfe = await clientePrisma.nfeRecebida.findFirst({
    where: { id: nfeId, companyId, tipoDocumento: 'nfe55' },
  })
  if (!nfe) return

  const ctes = await clientePrisma.nfeRecebida.findMany({
    where: {
      companyId,
      tipoDocumento: 'cte',
      chaveNfeReferenciada: nfe.chaveNfe,
      vinculosComoCte: { none: {} },
    },
  })

  for (const cte of ctes) {
    const valor =
      cte.xmlConteudo != null
        ? extrairCamposResumoDoXml(cte.xmlConteudo).valorTotal
        : decimalNum(cte.valorTotal)
    try {
      await criarVinculo({
        companyId,
        nfeRecebidaId: nfe.id,
        cteRecebidaId: cte.id,
        chaveNfeReferenciada: nfe.chaveNfe,
        origemVinculo: 'automatico',
        valorFrete: valor,
      })
    } catch {
      // já vinculado em corrida
    }
  }

  // CT-es com XML mas sem chaveNfeReferenciada persistida: reparse
  const ctesComXml = await clientePrisma.nfeRecebida.findMany({
    where: {
      companyId,
      tipoDocumento: 'cte',
      xmlConteudo: { not: null },
      vinculosComoCte: { none: {} },
    },
    select: { id: true, xmlConteudo: true, valorTotal: true },
    take: 50,
  })
  for (const cte of ctesComXml) {
    if (!cte.xmlConteudo) continue
    const chaves = extrairChavesNfeReferenciadasDoCte(cte.xmlConteudo)
    if (!chaves.includes(nfe.chaveNfe)) continue
    const resumo = extrairCamposResumoDoXml(cte.xmlConteudo)
    await clientePrisma.nfeRecebida.update({
      where: { id: cte.id },
      data: { chaveNfeReferenciada: chaves[0] ?? nfe.chaveNfe },
    })
    try {
      await criarVinculo({
        companyId,
        nfeRecebidaId: nfe.id,
        cteRecebidaId: cte.id,
        chaveNfeReferenciada: nfe.chaveNfe,
        origemVinculo: 'automatico',
        valorFrete: resumo.valorTotal ?? decimalNum(cte.valorTotal),
      })
    } catch {
      // ignore
    }
  }
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
  tentarVincularNfesPendentesAoCte,
  vincularCteManual,
  desvincularCte,
  listarVinculosDaNfe,
  listarVinculosDoCte,
}
