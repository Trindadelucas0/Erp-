/**
 * Orquestra o pipeline cadastro → fiscal → negociação → lançamento automático.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { normalizarDocumento } from '../../compartilhado/validacoes/documentos.js'
import { servicoDeAutenticacao } from '../autenticacao/servico-autenticacao.js'
import { repositorioFocusNfe } from '../focus-nfe/repositorio-focus-nfe.js'
import { clienteFocusNfe } from '../focus-nfe/cliente-focus-nfe.js'
import {
  extrairCamposResumoDoXml,
  extrairCfopDoXmlCte,
  extrairDadosTransporteDoXmlNfe,
  extrairIcmsDoXmlCte,
  extrairItensDoXml,
  extrairSugestaoFinanceiroDoXmlCte,
  normalizarXmlNfe,
  xmlNfeTemItensParseaveis,
} from '../focus-nfe/parser-xml-nfe.js'
import { logFocus } from '../focus-nfe/logs-focus-nfe.js'
import { obterRecursosEntradaNotas } from '../focus-nfe/config-recursos-entrada-notas.js'
import { analisarCadastro } from './analise-cadastro/analisar-cadastro.js'
import { analisarFiscalItens } from './analise-fiscal/analisar-fiscal-itens.js'
import { analisarNegociacao } from './analise-negociacao/analisar-negociacao.js'
import { repositorioEntradaNotas } from './repositorio-entrada-notas.js'
import type { AnaliseJson, ResultadoEtapa } from './tipos-analise.js'
import { etapaVazia } from './tipos-analise.js'
import type { RegrasFiscaisJson } from './analise-fiscal/analisar-fiscal-basico.js'
import {
  sanitizarRegrasFiscais,
  type DadosRegrasFiscais,
} from '../focus-nfe/esquema-focus-nfe.js'
import type { Prisma } from '@prisma/client'
import { ratearCustoFrete } from './ratear-custo-frete.js'
import { servicoVinculoCte } from './servico-vinculo-cte.js'
import {
  extrairFlagsFornecedorDaNota,
  resolverModoDocumentalEntrada,
  type FlagsFornecedorEntrada,
} from './resolver-modo-documental-entrada.js'
import { randomUUID } from 'crypto'

type EtapaPipeline = 'cadastro' | 'fiscal' | 'negociacao' | 'frete'

function asJson(valor: AnaliseJson): Prisma.InputJsonValue {
  return valor as unknown as Prisma.InputJsonValue
}

function decimalNum(v: { toNumber?: () => number } | number | null | undefined): number | null {
  if (v == null) return null
  if (typeof v === 'number') return v
  if (typeof v.toNumber === 'function') return v.toNumber()
  return Number(v)
}

/** Flags de tipo do fornecedor (Consumo/Prestador/exigir itens) para o pipeline. */
async function obterFlagsFornecedorEntrada(
  companyId: string,
  nota: {
    fornecedorPessoaId: string | null
    documentoEmitente: string | null
    fornecedorPessoa?: {
      papeis?: Array<{ dadosFornecedor?: FlagsFornecedorEntrada | null } | null>
    } | null
  }
): Promise<FlagsFornecedorEntrada | null> {
  const doInclude = extrairFlagsFornecedorDaNota(nota)
  if (doInclude) return doInclude

  let pessoaId = nota.fornecedorPessoaId
  if (!pessoaId && nota.documentoEmitente) {
    const fornecedor = await repositorioEntradaNotas.buscarFornecedorPorCnpj(
      companyId,
      nota.documentoEmitente
    )
    pessoaId = fornecedor?.id ?? null
  }
  if (!pessoaId) return null
  return repositorioEntradaNotas.buscarFlagsFornecedorEntrada(pessoaId)
}

/**
 * Itens por embalagem (múltiplo de compra) do vínculo produto × fornecedor da nota.
 * Mesma regra do Pedido de Compra (`multiplicadorEntrada`): sem vínculo válido, retorna 1.
 */
function resolverItensPorEmbalagem(
  fornecedores: Array<{ fornecedorPessoaId: string; multiplicadorEntrada: unknown }> | undefined,
  fornecedorPessoaId: string | null | undefined
): number {
  if (!fornecedorPessoaId || !fornecedores?.length) return 1
  const vinculo = fornecedores.find((f) => f.fornecedorPessoaId === fornecedorPessoaId)
  const valor = decimalNum(vinculo?.multiplicadorEntrada as never)
  return valor != null && Number.isFinite(valor) && valor > 0 ? valor : 1
}

/**
 * Extrai e grava os itens do XML (NfeRecebidaItem) só quando a nota ainda não
 * tem nenhum — nunca sobrescreve itens já gravados (preserva vínculo/CFOP de entrada
 * já escolhidos). NFS-e/CTe, nota inexistente ou sem XML: no-op silencioso (sem throw)
 * para poder ser chamada em pontos "best effort" (abrir detalhe, BUSCAR, sync, Ver nota).
 */
async function sincronizarItensPendentesDoXml(
  companyId: string,
  notaId: string
): Promise<{ itensAdicionados: number }> {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota || nota.tipoDocumento === 'nfse' || nota.tipoDocumento === 'cte' || !nota.xmlConteudo) {
    return { itensAdicionados: 0 }
  }

  const itens = extrairItensDoXml(nota.xmlConteudo)
  if (itens.length === 0) return { itensAdicionados: 0 }

  const qtd = await repositorioEntradaNotas.contarItens(notaId)
  if (qtd > 0) {
    await repositorioEntradaNotas.backfillUnidadeItensDoXml(notaId, itens)
    return { itensAdicionados: 0 }
  }

  await repositorioEntradaNotas.substituirItensDoXml(notaId, itens)
  return { itensAdicionados: itens.length }
}

async function garantirItensDoXml(companyId: string, notaId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.tipoDocumento === 'nfse' || nota.tipoDocumento === 'cte') {
    return nota
  }
  if (!nota.xmlConteudo) {
    throw new ErroDaAplicacao('Nota sem XML. Importe o XML ou baixe pela Focus antes de analisar.', 400)
  }

  await sincronizarItensPendentesDoXml(companyId, notaId)

  const campos = extrairCamposResumoDoXml(nota.xmlConteudo)
  if (campos.prazoPagamentoXml && !nota.prazoPagamentoXml) {
    await repositorioEntradaNotas.atualizarNota(notaId, {
      prazoPagamentoXml: campos.prazoPagamentoXml,
    })
  }

  return nota
}

/**
 * Preenche o CFOP de entrada sugerido (Cfop.cfopSugestaoEntradaId) nos itens que ainda
 * não têm escolha gravada. Nunca sobrescreve uma escolha manual já feita pelo usuário.
 */
async function sugerirCfopEntradaItensSemEscolha(
  companyId: string,
  itens: Array<{ id: string; cfop: string | null; cfopEntradaId: string | null }>
) {
  const pendentes = itens.filter((i) => !i.cfopEntradaId && i.cfop)
  if (pendentes.length === 0) return

  const sugestoes = await repositorioEntradaNotas.mapaSugestaoCfopEntradaPorCodigo(
    companyId,
    pendentes.map((i) => i.cfop as string)
  )
  for (const item of pendentes) {
    const sugestao = item.cfop ? sugestoes.get(item.cfop) : undefined
    if (sugestao) {
      await repositorioEntradaNotas.atualizarItem(item.id, { cfopEntradaId: sugestao.id })
    }
  }
}

/**
 * Preenche o CFOP de entrada sugerido no documento CT-e (NfeRecebida.cfopEntradaId)
 * a partir do CFOP do XML (`ide/CFOP`). Nunca sobrescreve escolha manual.
 * Retorna true se gravou sugestão.
 */
async function sugerirCfopEntradaCteSemEscolha(
  companyId: string,
  cte: { id: string; tipoDocumento?: string | null; xmlConteudo?: string | null; cfopEntradaId?: string | null }
): Promise<boolean> {
  if (cte.tipoDocumento != null && cte.tipoDocumento !== 'cte') return false
  if (cte.cfopEntradaId || !cte.xmlConteudo) return false

  const cfopXml = extrairCfopDoXmlCte(cte.xmlConteudo)
  if (!cfopXml) return false

  const sugestoes = await repositorioEntradaNotas.mapaSugestaoCfopEntradaPorCodigo(companyId, [
    cfopXml,
  ])
  const sugestao = sugestoes.get(cfopXml)
  if (!sugestao) return false

  await repositorioEntradaNotas.atualizarNota(cte.id, { cfopEntradaId: sugestao.id })
  return true
}

async function carregarRegras(companyId: string): Promise<RegrasFiscaisJson | null> {
  const cfg = await repositorioFocusNfe.buscarConfigPorEmpresa(companyId)
  if (!cfg?.regrasFiscaisJson) return null
  return sanitizarRegrasFiscais(cfg.regrasFiscaisJson as Partial<DadosRegrasFiscais>)
}

/** Cadastro nunca é liberável por senha — só vínculo/cadastro. */
function podeAvancarCadastro(etapa: ResultadoEtapa): boolean {
  return etapa.status !== 'bloqueante'
}

/**
 * Fiscal: CST/CFOP (exigeManifesto) nunca libera; NCM/origem libera com senha.
 */
function podeAvancarFiscal(etapa: ResultadoEtapa, criticasLiberadas: boolean): boolean {
  if (etapa.status !== 'bloqueante') return true
  if (etapa.exigeManifesto || (etapa.bloqueiosNaoLiberaveis?.length ?? 0) > 0) {
    return false
  }
  return criticasLiberadas
}

/** Negociação: senha de gerente libera críticas negativas. */
function podeAvancarNegociacao(etapa: ResultadoEtapa, criticasLiberadas: boolean): boolean {
  if (etapa.status !== 'bloqueante') return true
  return criticasLiberadas
}

function fiscalExigeManifesto(etapa: ResultadoEtapa | null | undefined): boolean {
  if (!etapa) return false
  if (etapa.exigeManifesto === true || (etapa.bloqueiosNaoLiberaveis?.length ?? 0) > 0) {
    return true
  }
  // Análises gravadas antes de exigeManifesto: detectar pelo texto do bloqueio
  return (etapa.bloqueios ?? []).some(
    (m) => /sem CFOP|sem CST|desconhecimento da opera/i.test(m)
  )
}

function exigeCtePorModFrete(modFrete: string | null | undefined): boolean {
  return (modFrete ?? '').trim() === '1'
}

/** Precisa ratear quando frete é destinatário ou já há CT-e vinculado. */
function exigeRateioFrete(
  modFrete: string | null | undefined,
  qtdCtes: number
): boolean {
  return exigeCtePorModFrete(modFrete) || qtdCtes > 0
}

function regraRateioFreteCadastro(
  regra: string | null | undefined
): string | null {
  const r = (regra ?? '').trim()
  return r || null
}

function podeAvancarFrete(etapa: ResultadoEtapa | null | undefined): boolean {
  if (!etapa) return true
  return etapa.status !== 'bloqueante'
}

function pipelineProntoParaLancar(
  analise: AnaliseJson | null,
  criticasLiberadas: boolean,
  fornecedorPessoaId: string | null
): { ok: true } | { ok: false; mensagem: string } {
  if (!analise) {
    return { ok: false, mensagem: 'Nota sem análise. Clique em Reanalisar antes de lançar.' }
  }
  if (!podeAvancarCadastro(analise.cadastro)) {
    return {
      ok: false,
      mensagem: fornecedorPessoaId
        ? 'Cadastro bloqueante: vincule os produtos sem vínculo antes de lançar.'
        : 'Cadastro bloqueante: cadastre o fornecedor e vincule os produtos antes de lançar.',
    }
  }
  if (fiscalExigeManifesto(analise.fiscal)) {
    return {
      ok: false,
      mensagem:
        'Fiscal com CST/CFOP impeditivo: use desconhecimento da operação ou devolução — não é possível lançar.',
    }
  }
  if (!podeAvancarFiscal(analise.fiscal, criticasLiberadas)) {
    return {
      ok: false,
      mensagem:
        'Fiscal bloqueante (NCM/origem): importe da NF para o produto ou liberar críticas com senha de gerente.',
    }
  }
  if (!podeAvancarNegociacao(analise.negociacao, criticasLiberadas)) {
    return {
      ok: false,
      mensagem:
        'Negociação bloqueante: resolva o pedido/prazo ou liberar críticas com senha de gerente.',
    }
  }
  if (!podeAvancarFrete(analise.frete)) {
    return {
      ok: false,
      mensagem:
        analise.frete?.bloqueios?.[0] ??
        'Frete bloqueante: vincule o CT-e ou cadastre a regra de rateio no fornecedor antes de lançar.',
    }
  }
  return { ok: true }
}

async function lancarContagem(notaId: string, origem: 'automatica' | 'humana') {
  await repositorioEntradaNotas.atualizarNota(notaId, {
    statusEntrada: 'entrada_contagem',
    etapaAtual: 'lancamento',
    origemLancamento: origem,
  })
}

const ORDEM_ETAPAS: EtapaPipeline[] = ['cadastro', 'fiscal', 'negociacao', 'frete']

/** Etapas de retorno válidas por tipo de documento (NFS-e/CTe só têm cadastro). */
function etapasVoltarValidas(tipoDocumento: string | null | undefined): EtapaPipeline[] {
  return tipoDocumento === 'nfse' || tipoDocumento === 'cte' ? ['cadastro'] : ORDEM_ETAPAS
}

/** Posição efetiva da nota no pipeline — finalizada conta como além do fim (permite voltar de qualquer etapa). */
function etapaEfetivaAtual(nota: {
  statusEntrada: string
  etapaAtual: string
  analiseJson: unknown
}): EtapaPipeline | 'lancamento' {
  if (nota.statusEntrada === 'entrada_contagem' || nota.statusEntrada === 'entrada_consolidada') {
    return 'lancamento'
  }
  const motivo = (nota.analiseJson as AnaliseJson | null)?.motivoParada
  if (motivo === 'cadastro' || motivo === 'fiscal' || motivo === 'negociacao' || motivo === 'frete') {
    return motivo
  }
  if (
    nota.etapaAtual === 'cadastro' ||
    nota.etapaAtual === 'fiscal' ||
    nota.etapaAtual === 'negociacao' ||
    nota.etapaAtual === 'frete'
  ) {
    return nota.etapaAtual
  }
  return 'lancamento'
}

/**
 * Volta a nota para uma etapa anterior: reabre se já lançada, limpa o resultado
 * das etapas a partir do destino (recalculadas na reanálise) e para exatamente
 * na etapa escolhida — sem saltar de volta para o bloqueio antigo.
 */
async function voltarEtapa(
  companyId: string,
  notaId: string,
  usuarioId: string,
  etapaDestino: EtapaPipeline
) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada === 'cancelada') {
    throw new ErroDaAplicacao('Nota cancelada — não é possível voltar etapa.', 409)
  }
  if (nota.statusEntrada === 'com_problema' || nota.statusEntrada === 'problema_resolvido') {
    throw new ErroDaAplicacao(
      'Nota com problema — não é possível voltar etapa. Resolva ou desconheça a operação.',
      409
    )
  }

  const etapasValidas = etapasVoltarValidas(nota.tipoDocumento)
  if (!etapasValidas.includes(etapaDestino)) {
    throw new ErroDaAplicacao(
      `Etapa "${etapaDestino}" não existe para este tipo de documento.`,
      400
    )
  }

  const atual = etapaEfetivaAtual(nota)
  const indiceAtual = atual === 'lancamento' ? ORDEM_ETAPAS.length : ORDEM_ETAPAS.indexOf(atual)
  const indiceDestino = ORDEM_ETAPAS.indexOf(etapaDestino)
  if (indiceDestino >= indiceAtual) {
    throw new ErroDaAplicacao(
      `Etapa "${etapaDestino}" não é anterior à etapa atual (${atual}).`,
      400
    )
  }
  const analiseAtual: AnaliseJson = (nota.analiseJson as AnaliseJson | null) ?? {
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    cadastro: etapaVazia(),
    fiscal: etapaVazia(),
    negociacao: etapaVazia(),
    autoLancado: false,
    motivoParada: null,
  }

  const analise: AnaliseJson = {
    ...analiseAtual,
    fiscal: indiceDestino <= ORDEM_ETAPAS.indexOf('fiscal') ? etapaVazia() : analiseAtual.fiscal,
    negociacao:
      indiceDestino <= ORDEM_ETAPAS.indexOf('negociacao') ? etapaVazia() : analiseAtual.negociacao,
    frete: indiceDestino <= ORDEM_ETAPAS.indexOf('frete') ? etapaVazia() : analiseAtual.frete,
    autoLancado: false,
    motivoParada: null,
  }

  const finalizada =
    nota.statusEntrada === 'entrada_contagem' || nota.statusEntrada === 'entrada_consolidada'

  await repositorioEntradaNotas.atualizarNota(notaId, {
    statusEntrada: 'em_analise',
    origemLancamento: finalizada ? null : nota.origemLancamento,
    analiseJson: asJson(analise),
    etapaAtual: etapaDestino,
    criticasLiberadas:
      indiceDestino <= ORDEM_ETAPAS.indexOf('negociacao') ? false : nota.criticasLiberadas,
  })

  for (const item of nota.itens) {
    const dados: { criticaFiscal?: boolean; criticaNegociacao?: boolean; custoFreteRateado?: null } =
      {}
    if (indiceDestino <= ORDEM_ETAPAS.indexOf('fiscal')) dados.criticaFiscal = false
    if (indiceDestino <= ORDEM_ETAPAS.indexOf('negociacao')) dados.criticaNegociacao = false
    if (indiceDestino <= ORDEM_ETAPAS.indexOf('frete')) dados.custoFreteRateado = null
    if (Object.keys(dados).length > 0) {
      await repositorioEntradaNotas.atualizarItem(item.id, dados)
    }
  }

  logFocus('info', 'voltar_etapa', {
    companyId,
    notaId,
    usuarioId,
    etapaDestino,
    eraFinalizada: finalizada,
  })

  if (nota.tipoDocumento === 'nfse' || nota.tipoDocumento === 'cte') {
    return analisarNota(companyId, notaId)
  }
  return analisarNota(companyId, notaId, { pararEm: etapaDestino })
}

/**
 * Roda o pipeline. Se tudo ok (ou críticas liberadas), lança automaticamente para contagem.
 */
/**
 * Documental (NFS-e): só cadastro do emitente; sem fiscal de itens / PO / estoque.
 * Libera para contagem documental se cadastro ok.
 *
 * CTe: cadastro da transportadora + vínculo com NF-e (chave do XML). Não auto-lança
 * sozinho quando há chave referenciada — o frete entra na NF de mercadoria.
 *
 * `importarFocusSeAusente` (default true): Reanalisar/BUSCAR batem Focus pela NF.
 * Abertura do detalhe passa false — só vínculo local.
 */
async function analisarNotaDocumental(
  companyId: string,
  notaId: string,
  tipo: 'nfse' | 'cte',
  opcoesDoc?: { importarFocusSeAusente?: boolean }
): Promise<{
  nota: Record<string, unknown>
  pedidosDisponiveis: Array<{ id: string; numero: number; status: string }>
}> {
  let nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  await repositorioEntradaNotas.atualizarNota(notaId, { statusEntrada: 'em_analise' })

  let falhaImportNfeRef: string | undefined
  if (tipo === 'cte') {
    const importarFocus = opcoesDoc?.importarFocusSeAusente !== false
    const resultadoVinculo = await servicoVinculoCte.tentarVincularCteAutomatico(companyId, notaId, {
      importarFocusSeAusente: importarFocus,
    })
    falhaImportNfeRef = resultadoVinculo.falhaImport
    nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
    if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
    await sugerirCfopEntradaCteSemEscolha(companyId, nota)
    nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
    if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  }

  const cadastro = await analisarCadastro({
    companyId,
    documentoEmitente: nota.documentoEmitente,
    fornecedorPessoaId: nota.fornecedorPessoaId,
    itens: [],
    exigirItens: false,
  })

  await repositorioEntradaNotas.atualizarNota(notaId, {
    fornecedorPessoaId: cadastro.fornecedorPessoaId,
    etapaAtual: 'servico',
  })

  const rotulo = tipo === 'cte' ? 'CTe' : 'NFS-e'
  const analise: AnaliseJson = {
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    cadastro: cadastro.resultado,
    fiscal: {
      status: 'ok',
      avisos: [`${rotulo}: análise fiscal de itens de produto não se aplica.`],
      bloqueios: [],
    },
    negociacao: {
      status: 'ok',
      avisos: [`${rotulo}: sem vínculo de estoque/PO — liberação documental.`],
      bloqueios: [],
    },
    autoLancado: false,
    motivoParada: null,
  }

  if (!podeAvancarCadastro(cadastro.resultado)) {
    analise.motivoParada = 'cadastro'
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'servico',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId, { jaRetentouVinculoCte: true })
  }

  if (tipo === 'cte') {
    // Recarrega vínculos após possível import Focus no início
    nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
    if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

    const vinculos = nota.vinculosComoCte ?? []
    const chaveRef = nota.chaveNfeReferenciada
    if (vinculos.length === 0) {
      analise.motivoParada = 'vinculo_nfe'
      const bloqueioComChave = falhaImportNfeRef
        ? [
            `CTe referencia a NF ${chaveRef?.slice(-8) ?? ''}…. Tentativa automática de importar pela Focus falhou: ${falhaImportNfeRef}`,
          ]
        : chaveRef
          ? [
              `CTe referencia a NF ${chaveRef.slice(-8)}… (chave ${chaveRef}). NF ainda não está no ERP — use Reanalisar / BUSCAR (Focus) ou importe o XML da NF.`,
            ]
          : [
              'CTe sem chave de NF-e no XML. Vincule manualmente pela tela da NF de mercadoria ou aguarde NF com frete destinatário.',
            ]
      analise.negociacao = {
        status: 'bloqueante',
        avisos: [],
        bloqueios: bloqueioComChave,
      }
      await repositorioEntradaNotas.atualizarNota(notaId, {
        analiseJson: asJson(analise),
        etapaAtual: 'servico',
        statusEntrada: 'em_analise',
      })
      return await obterDetalhe(companyId, notaId, { jaRetentouVinculoCte: true })
    }

    // CT-e vinculado: não lança sozinho — despesa/rateio na NF de mercadoria
    analise.negociacao = {
      status: 'ok',
      avisos: [
        `CTe vinculado à NF ${vinculos[0]?.nfeRecebida?.chaveNfe?.slice(-8) ?? ''}… — custo entra na análise da mercadoria.`,
      ],
      bloqueios: [],
    }
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'servico',
      statusEntrada: 'em_analise',
    })
    // Reanalisa a NF vinculada para liberar gate de frete
    for (const v of vinculos) {
      try {
        await analisarNota(companyId, v.nfeRecebidaId)
      } catch {
        /* NF pode estar finalizada */
      }
    }
    return await obterDetalhe(companyId, notaId, { jaRetentouVinculoCte: true })
  }

  analise.autoLancado = true
  await repositorioEntradaNotas.atualizarNota(notaId, {
    analiseJson: asJson(analise),
    etapaAtual: 'servico',
  })
  await lancarContagem(notaId, 'automatica')
  return await obterDetalhe(companyId, notaId)
}

/** @deprecated alias — NFS-e usa analisarNotaDocumental */
async function analisarNotaNfse(companyId: string, notaId: string) {
  return analisarNotaDocumental(companyId, notaId, 'nfse')
}

async function analisarNotaCte(
  companyId: string,
  notaId: string,
  opcoes?: { importarFocusSeAusente?: boolean }
) {
  return analisarNotaDocumental(companyId, notaId, 'cte', opcoes)
}

async function analisarNota(
  companyId: string,
  notaId: string,
  opcoes?: {
    forcarReparseItens?: boolean
    pararEm?: EtapaPipeline
    /** CT-e: default true (Reanalisar). Abertura do detalhe passa false. */
    importarFocusSeAusente?: boolean
  }
): Promise<{
  nota: Record<string, unknown>
  pedidosDisponiveis: Array<{ id: string; numero: number; status: string }>
}> {
  const base = await garantirItensDoXml(companyId, notaId)
  if (
    base.statusEntrada === 'entrada_contagem' ||
    base.statusEntrada === 'entrada_consolidada' ||
    base.statusEntrada === 'cancelada' ||
    base.statusEntrada === 'com_problema' ||
    base.statusEntrada === 'problema_resolvido'
  ) {
    throw new ErroDaAplicacao(
      base.statusEntrada === 'com_problema' || base.statusEntrada === 'problema_resolvido'
        ? 'Nota com problema — use tratativas, solução ou desconhecer operação.'
        : 'Nota já finalizada ou cancelada.',
      409
    )
  }

  if (base.tipoDocumento === 'nfse') {
    return analisarNotaNfse(companyId, notaId)
  }
  if (base.tipoDocumento === 'cte') {
    return analisarNotaCte(companyId, notaId, {
      importarFocusSeAusente: opcoes?.importarFocusSeAusente,
    })
  }

  if (opcoes?.forcarReparseItens && base.xmlConteudo) {
    const itens = extrairItensDoXml(base.xmlConteudo)
    await repositorioEntradaNotas.substituirItensDoXml(notaId, itens)
  }

  let nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  await repositorioEntradaNotas.atualizarNota(notaId, { statusEntrada: 'em_analise' })

  const flagsFornecedor = await obterFlagsFornecedorEntrada(companyId, nota)
  const modoDocumental = resolverModoDocumentalEntrada(flagsFornecedor)

  const cadastro = await analisarCadastro({
    companyId,
    documentoEmitente: nota.documentoEmitente,
    fornecedorPessoaId: nota.fornecedorPessoaId,
    modoDocumental,
    itens: nota.itens.map((i) => ({
      id: i.id,
      gtin: i.gtin,
      codigoProduto: i.codigoProduto,
      produtoId: i.produtoId,
      vinculoModo: i.vinculoModo,
    })),
  })

  for (const item of cadastro.itensAtualizados) {
    await repositorioEntradaNotas.atualizarItem(item.id, {
      produtoId: item.produtoId,
      vinculoModo: item.vinculoModo,
      criticaCadastro: item.criticaCadastro,
    })
  }

  await repositorioEntradaNotas.atualizarNota(notaId, {
    fornecedorPessoaId: cadastro.fornecedorPessoaId,
    etapaAtual: 'cadastro',
  })

  const analise: AnaliseJson = {
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    cadastro: cadastro.resultado,
    fiscal: etapaVazia(),
    negociacao: etapaVazia(),
    autoLancado: false,
    motivoParada: null,
  }

  const cadastroBloqueado = !podeAvancarCadastro(cadastro.resultado)
  if (cadastroBloqueado || opcoes?.pararEm === 'cadastro') {
    analise.motivoParada = cadastroBloqueado ? 'cadastro' : null
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'cadastro',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId)
  }

  nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  const regras = await carregarRegras(companyId)
  const fiscal = analisarFiscalItens({
    regras,
    itens: nota.itens.map((i) => ({
      id: i.id,
      produtoId: i.produtoId,
      ncm: i.ncm,
      cfop: i.cfop,
      cst: i.cst,
      origem: i.origem,
      produtoNcm: i.produto?.ncm ?? null,
      produtoOrigem: i.produto?.codigoOrigem ?? null,
    })),
  })
  for (const item of fiscal.itensCritica) {
    await repositorioEntradaNotas.atualizarItem(item.id, { criticaFiscal: item.criticaFiscal })
  }
  analise.fiscal = fiscal.resultado
  await repositorioEntradaNotas.atualizarNota(notaId, { etapaAtual: 'fiscal' })

  await sugerirCfopEntradaItensSemEscolha(companyId, nota.itens)

  const fiscalBloqueado = !podeAvancarFiscal(fiscal.resultado, nota.criticasLiberadas)
  if (fiscalBloqueado || opcoes?.pararEm === 'fiscal') {
    analise.motivoParada = fiscalBloqueado ? 'fiscal' : null
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'fiscal',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId)
  }

  let pedido = null as Awaited<ReturnType<typeof repositorioEntradaNotas.buscarPedidoComItens>>
  if (nota.pedidoCompraId) {
    pedido = await repositorioEntradaNotas.buscarPedidoComItens(companyId, nota.pedidoCompraId)
  } else if (nota.fornecedorPessoaId && !modoDocumental) {
    const abertos = await repositorioEntradaNotas.listarPedidosAbertosFornecedor(
      companyId,
      nota.fornecedorPessoaId
    )
    if (abertos.length === 1) {
      pedido = abertos[0]
      await repositorioEntradaNotas.atualizarNota(notaId, { pedidoCompraId: pedido.id })
    } else if (abertos.length > 1) {
      // deixa sem pedido — humano escolhe
      pedido = null
    }
  }

  const negociacao = analisarNegociacao({
    itensNf: nota.itens.map((i) => ({
      id: i.id,
      produtoId: i.produtoId,
      quantidade: decimalNum(i.quantidade),
      valorUnitario: decimalNum(i.valorUnitario),
    })),
    pedido: pedido
      ? {
          id: pedido.id,
          numero: pedido.numero,
          condicaoPagamento: pedido.condicaoPagamento,
          prazosPagamento: pedido.prazosPagamento,
          itens: pedido.itens.map((i) => ({
            produtoId: i.produtoId,
            quantidade: decimalNum(i.quantidade) ?? 0,
            precoUnitario: decimalNum(i.precoUnitario) ?? 0,
            nome: i.produto?.nomeVenda,
          })),
        }
      : null,
    prazoNf: nota.prazoPagamentoXml,
    prazoInformadoUsuario: nota.prazoPagamentoTexto,
    modoDocumental,
  })

  for (const item of negociacao.itensCritica) {
    await repositorioEntradaNotas.atualizarItem(item.id, {
      criticaNegociacao: item.criticaNegociacao,
    })
  }
  analise.negociacao = negociacao.resultado
  await repositorioEntradaNotas.atualizarNota(notaId, { etapaAtual: 'negociacao' })

  const negociacaoBloqueada = !podeAvancarNegociacao(negociacao.resultado, nota.criticasLiberadas)
  if (negociacaoBloqueada || opcoes?.pararEm === 'negociacao') {
    analise.motivoParada = negociacaoBloqueada ? 'negociacao' : null
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'negociacao',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId)
  }

  // Gate frete / CT-e (modFrete = 1 destinatário)
  nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  let modFrete = nota.modFrete
  if (!modFrete && nota.xmlConteudo) {
    const camposXml = extrairCamposResumoDoXml(nota.xmlConteudo)
    modFrete = camposXml.modFrete ?? null
    if (modFrete) {
      await repositorioEntradaNotas.atualizarNota(notaId, { modFrete })
    }
  }

  const qtdCtes = (nota.vinculosComoNfe ?? []).length
  if (exigeCtePorModFrete(modFrete) && qtdCtes === 0) {
    analise.frete = {
      status: 'bloqueante',
      avisos: [],
      bloqueios: [
        'Frete por conta do destinatário (modFrete=1): é obrigatório vincular um CT-e. Se não veio no sync, use a aba Frete/CT-e e informe a chave do CT-e (44 dígitos) manualmente.',
      ],
    }
    analise.motivoParada = 'frete'
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'frete',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId)
  }

  const regraRateio = regraRateioFreteCadastro(
    nota.fornecedorPessoa?.papeis?.[0]?.dadosFornecedor?.regraRateioFrete
  )
  if (exigeRateioFrete(modFrete, qtdCtes) && !regraRateio) {
    analise.frete = {
      status: 'bloqueante',
      avisos: [],
      bloqueios: [
        'Cadastre a Regra de rateio do frete (CT-e) no fornecedor antes de continuar. Sem essa regra não é possível ratear o custo do frete nos itens.',
      ],
    }
    analise.motivoParada = 'frete'
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'frete',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId)
  }

  if (exigeCtePorModFrete(modFrete)) {
    analise.frete = {
      status: 'ok',
      avisos: [`${qtdCtes} CT-e(s) vinculado(s) — frete destinatário ok.`],
      bloqueios: [],
    }
  } else {
    analise.frete = {
      status: 'ok',
      avisos: modFrete
        ? [`modFrete=${modFrete} — CT-e não obrigatório.`]
        : ['modFrete ausente no XML — CT-e não exigido.'],
      bloqueios: [],
    }
  }

  await repositorioEntradaNotas.atualizarNota(notaId, { etapaAtual: 'frete' })

  if (opcoes?.pararEm === 'frete') {
    analise.motivoParada = null
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'frete',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId)
  }

  // Auto-lançamento — nunca sem itens parseados
  if (nota.itens.length === 0) {
    analise.autoLancado = false
    analise.motivoParada = 'cadastro'
    analise.cadastro = {
      status: 'bloqueante',
      avisos: [],
      bloqueios: [
        'Nota sem itens parseados do XML. Reimporte o XML ou complete o download na Focus.',
      ],
    }
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'cadastro',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId)
  }

  analise.autoLancado = true
  analise.motivoParada = null
  await aplicarRateioEDespesasFrete(companyId, notaId)
  await lancarContagem(notaId, 'automatica')
  await repositorioEntradaNotas.atualizarNota(notaId, {
    analiseJson: asJson(analise),
    etapaAtual: 'lancamento',
  })
  logFocus('info', 'entrada_auto_contagem', { companyId, notaId, chave: nota.chaveNfe })
  return await obterDetalhe(companyId, notaId)
}

/**
 * Rateia custo dos CT-es vinculados nos itens e registra despesa mínima por CT-e.
 */
async function aplicarRateioEDespesasFrete(companyId: string, notaId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota || nota.tipoDocumento === 'nfse' || nota.tipoDocumento === 'cte') return

  const vinculos = nota.vinculosComoNfe ?? []
  if (vinculos.length === 0) {
    for (const item of nota.itens) {
      await repositorioEntradaNotas.atualizarItem(item.id, { custoFreteRateado: null })
    }
    return
  }

  const valorTotalFrete = vinculos.reduce((acc, v) => {
    const n = decimalNum(v.valorFrete) ?? decimalNum(v.cteRecebida?.valorTotal) ?? 0
    return acc + n
  }, 0)

  const regra = regraRateioFreteCadastro(
    nota.fornecedorPessoa?.papeis?.[0]?.dadosFornecedor?.regraRateioFrete
  )
  if (!regra) {
    throw new ErroDaAplicacao(
      'Cadastre a Regra de rateio do frete (CT-e) no fornecedor antes de lançar.',
      400
    )
  }

  const rateio = ratearCustoFrete({
    regra,
    valorTotalFrete,
    itens: nota.itens.map((i) => ({
      id: i.id,
      valorTotal: decimalNum(i.valorTotal),
      quantidade: decimalNum(i.quantidade),
      pesoKg: decimalNum(i.pesoKg),
      pesoProdutoKg: decimalNum(i.produto?.pesoKg ?? null),
    })),
  })

  for (const item of rateio.itens) {
    await repositorioEntradaNotas.atualizarItem(item.id, {
      custoFreteRateado: item.custoFreteRateado,
    })
  }

  for (const v of vinculos) {
    const valor = decimalNum(v.valorFrete) ?? decimalNum(v.cteRecebida?.valorTotal) ?? 0
    if (valor <= 0) continue
    const pessoaId = v.cteRecebida?.fornecedorPessoaId ?? null
    await clientePrisma.despesaEntradaDocumento.upsert({
      where: {
        nfeRecebidaId_origem: { nfeRecebidaId: v.cteRecebidaId, origem: 'cte' },
      },
      create: {
        id: randomUUID(),
        companyId,
        nfeRecebidaId: v.cteRecebidaId,
        pessoaId,
        valor,
        status: 'lancado',
        origem: 'cte',
        updatedAt: new Date(),
      },
      update: {
        pessoaId,
        valor,
        status: 'lancado',
        updatedAt: new Date(),
      },
    })
  }
}

async function obterDetalhe(
  companyId: string,
  notaId: string,
  opcoes?: { jaRetentouVinculoCte?: boolean; jaReparouItens?: boolean }
): Promise<{
  nota: Record<string, unknown>
  pedidosDisponiveis: Array<{ id: string; numero: number; status: string }>
}> {
  let nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  const statusesAbertos = ['pendente', 'em_analise', 'stand_by']
  if (
    statusesAbertos.includes(nota.statusEntrada) &&
    nota.xmlConteudo &&
    !nota.analiseJson
  ) {
    await processarAposXml(companyId, notaId)
    nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
    if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  }

  if (
    nota.xmlConteudo &&
    nota.itens.length > 0 &&
    (nota.tipoDocumento === 'nfe55' || !nota.tipoDocumento)
  ) {
    await sincronizarItensPendentesDoXml(companyId, notaId)
    nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
    if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  }

  // Nota NFe 55 sem itens (falha de pipeline / sync / XML só resNFe) — repara ao abrir.
  // Inclui notas já lançadas indevidamente sem itens (reabre + reanalisa).
  let avisoReparoXml: string | null = null
  if (
    !opcoes?.jaReparouItens &&
    (nota.tipoDocumento === 'nfe55' || !nota.tipoDocumento) &&
    nota.statusEntrada !== 'cancelada' &&
    nota.itens.length === 0
  ) {
    let itensAdicionados = 0
    if (nota.xmlConteudo) {
      ;({ itensAdicionados } = await sincronizarItensPendentesDoXml(companyId, notaId))
    }
    // XML ausente ou só resumo DistDFe (resNFe): tenta baixar NFe completa na Focus.
    if (itensAdicionados === 0 && (!nota.xmlConteudo || !xmlNfeTemItensParseaveis(nota.xmlConteudo))) {
      const recursos = await obterRecursosEntradaNotas(companyId)
      const atualizadoEm = nota.danfeAtualizadoEm?.getTime() ?? 0
      const cooldownMs = recursos.danfeRateLimitMinutos * 60 * 1000
      const statusCooldown =
        nota.danfeStatus === 'rate_limit' || nota.danfeStatus === 'indisponivel'
      const dentroCooldown =
        statusCooldown && atualizadoEm > 0 && Date.now() - atualizadoEm < cooldownMs

      if (dentroCooldown) {
        const min = Math.max(1, recursos.danfeRateLimitMinutos)
        avisoReparoXml =
          nota.danfeStatus === 'rate_limit'
            ? `Limite Focus excedido recentemente. Aguarde cerca de ${min} minuto(s) e tente de novo, ou use Importar XML na lista.`
            : `Focus indisponível recentemente para este XML. Aguarde cerca de ${min} minuto(s) ou use Importar XML na lista.`
        logFocus('warn', 'entrada_reparo_xml_focus_cooldown', {
          companyId,
          notaId,
          chave: nota.chaveNfe,
          minutos: min,
          danfeStatus: nota.danfeStatus ?? '',
        })
      } else {
        try {
          await clientePrisma.nfeRecebida.update({
            where: { id: notaId },
            data: { nfeCompleta: false },
          })
          const { servicoFocusNfe } = await import('../focus-nfe/servico-focus-nfe.js')
          await servicoFocusNfe.obterXmlNota(companyId, notaId, 'visualizar')
          ;({ itensAdicionados } = await sincronizarItensPendentesDoXml(companyId, notaId))
        } catch (erro) {
          const status =
            erro instanceof ErroDaAplicacao ? erro.statusCode : undefined
          const mensagem = erro instanceof Error ? erro.message : String(erro)
          logFocus('warn', 'entrada_reparo_xml_focus_falhou', {
            companyId,
            notaId,
            chave: nota.chaveNfe,
            mensagem,
          })
          if (status === 429) {
            await repositorioFocusNfe.atualizarDanfe(notaId, {
              danfeStatus: 'rate_limit',
              danfeAtualizadoEm: new Date(),
            })
            const min = Math.max(1, recursos.danfeRateLimitMinutos)
            avisoReparoXml =
              `Limite Focus excedido ao baixar o XML. Aguarde cerca de ${min} minuto(s) ou use Importar XML na lista.`
          } else {
            await repositorioFocusNfe.atualizarDanfe(notaId, {
              danfeStatus: 'indisponivel',
              danfeAtualizadoEm: new Date(),
            })
            avisoReparoXml =
              'Não foi possível completar o XML pela Focus. Tente de novo em instantes ou use Importar XML na lista.'
          }
        }
      }
    }
    if (itensAdicionados > 0) {
      const finalizada =
        nota.statusEntrada === 'entrada_contagem' ||
        nota.statusEntrada === 'entrada_consolidada'
      if (finalizada) {
        await repositorioEntradaNotas.atualizarNota(notaId, {
          statusEntrada: 'em_analise',
          etapaAtual: 'cadastro',
          origemLancamento: null,
        })
        logFocus('warn', 'entrada_reaberta_sem_itens', {
          companyId,
          notaId,
          chave: nota.chaveNfe,
          statusAntes: nota.statusEntrada,
          itensAdicionados,
        })
      }
      return analisarNota(companyId, notaId)
    }
  }

  // CT-e sem vínculo: abertura do detalhe só tenta vínculo LOCAL (sem Focus).
  // Focus fica no Reanalisar / BUSCAR — igual lista com forcarRetryFocus=false.
  // jaRetentouVinculoCte evita loop quando analisarNota retorna via obterDetalhe.
  const semVinculoCte = (nota.vinculosComoCte ?? []).length === 0
  const temChaveRef =
    Boolean(nota.chaveNfeReferenciada) ||
    (nota.tipoDocumento === 'cte' && Boolean(nota.xmlConteudo))
  if (
    !opcoes?.jaRetentouVinculoCte &&
    nota.tipoDocumento === 'cte' &&
    statusesAbertos.includes(nota.statusEntrada) &&
    temChaveRef &&
    semVinculoCte
  ) {
    const vinculoLocal = await servicoVinculoCte.tentarVincularCteAutomatico(companyId, notaId, {
      importarFocusSeAusente: false,
    })
    if (vinculoLocal.vinculado) {
      return analisarNota(companyId, notaId, { importarFocusSeAusente: false })
    }
    nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
    if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
    if (!nota.analiseJson) {
      return analisarNota(companyId, notaId, { importarFocusSeAusente: false })
    }
    // Já tem análise (ex.: vinculo_nfe) — devolve rápido sem martelar Focus.
  }

  // CFOP de entrada do CT-e (próprio documento ou CT-es vinculados à NF)
  let sugeriuCfopCte = false
  if (nota.tipoDocumento === 'cte') {
    sugeriuCfopCte = await sugerirCfopEntradaCteSemEscolha(companyId, nota)
  } else if (nota.tipoDocumento === 'nfe55' || !nota.tipoDocumento) {
    for (const v of nota.vinculosComoNfe ?? []) {
      const cte = v.cteRecebida
      if (!cte) continue
      const ok = await sugerirCfopEntradaCteSemEscolha(companyId, {
        id: cte.id,
        tipoDocumento: 'cte',
        xmlConteudo: cte.xmlConteudo,
        cfopEntradaId: cte.cfopEntradaId,
      })
      if (ok) sugeriuCfopCte = true
    }
  }
  if (sugeriuCfopCte) {
    nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
    if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  }

  let pedidosDisponiveis: Array<{ id: string; numero: number; status: string }> = []
  if (nota.fornecedorPessoaId) {
    const abertos = await repositorioEntradaNotas.listarPedidosAbertosFornecedor(
      companyId,
      nota.fornecedorPessoaId
    )
    pedidosDisponiveis = abertos.map((p) => ({
      id: p.id,
      numero: p.numero,
      status: p.status,
    }))
  }

  const codigosVinculo = nota.fornecedorPessoaId
    ? await repositorioEntradaNotas.mapaCodigoOriginalPorProduto(
        nota.fornecedorPessoaId,
        nota.itens.map((i) => i.produtoId).filter((id): id is string => Boolean(id))
      )
    : new Map<string, string>()

  return {
    nota: {
      id: nota.id,
      chaveNfe: nota.chaveNfe,
      tipoDocumento: nota.tipoDocumento ?? 'nfe55',
      nomeEmitente: nota.nomeEmitente,
      documentoEmitente: nota.documentoEmitente,
      valorTotal: decimalNum(nota.valorTotal),
      dataEmissao: nota.dataEmissao,
      statusEntrada: nota.statusEntrada,
      manifestacaoDestinatario: nota.manifestacaoDestinatario ?? null,
      origem: nota.origem,
      etapaAtual: nota.etapaAtual,
      nfeCompleta: nota.nfeCompleta,
      criticasLiberadas: nota.criticasLiberadas,
      observacaoContato: nota.observacaoContato,
      pedidoCompraId: nota.pedidoCompraId,
      origemLancamento: nota.origemLancamento,
      problemaDesfecho: nota.problemaDesfecho ?? null,
      problemaMarcadoEm: nota.problemaMarcadoEm ?? null,
      problemaResolvidoEm: nota.problemaResolvidoEm ?? null,
      avisoReparoXml,
      tratativas: (nota.tratativas ?? []).map((t) => ({
        id: t.id,
        texto: t.texto,
        createdAt: t.createdAt,
        usuario: t.usuario
          ? { id: t.usuario.id, name: t.usuario.name, email: t.usuario.email }
          : null,
      })),
      prazoPagamentoXml: nota.prazoPagamentoXml,
      prazoPagamentoTexto: nota.prazoPagamentoTexto,
      modFrete: nota.modFrete ?? null,
      chaveNfeReferenciada: nota.chaveNfeReferenciada ?? null,
      cfopXml:
        nota.tipoDocumento === 'cte' && nota.xmlConteudo
          ? extrairCfopDoXmlCte(nota.xmlConteudo)
          : null,
      cfopEntrada:
        nota.tipoDocumento === 'cte' && nota.cfopEntrada
          ? {
              id: nota.cfopEntrada.id,
              codigo: nota.cfopEntrada.codigo,
              nome: nota.cfopEntrada.nome,
            }
          : null,
      sugestaoFinanceiroFrete:
        nota.tipoDocumento === 'cte' && nota.xmlConteudo
          ? extrairSugestaoFinanceiroDoXmlCte(nota.xmlConteudo)
          : null,
      exigeCte: exigeCtePorModFrete(nota.modFrete),
      regraRateioFrete: regraRateioFreteCadastro(
        nota.fornecedorPessoa?.papeis?.[0]?.dadosFornecedor?.regraRateioFrete
      ),
      fornecedor: nota.fornecedorPessoa
        ? (() => {
            const df = nota.fornecedorPessoa.papeis?.[0]?.dadosFornecedor
            const flags: FlagsFornecedorEntrada = {
              tipoRevenda: df?.tipoRevenda ?? false,
              tipoConsumo: df?.tipoConsumo ?? false,
              tipoPrestadorServico: df?.tipoPrestadorServico ?? false,
              exigirItensEntrada: df?.exigirItensEntrada ?? false,
              permitirVinculoManual: df?.permitirVinculoManual ?? false,
            }
            return {
              id: nota.fornecedorPessoa.id,
              nome: nota.fornecedorPessoa.nome,
              cnpj: nota.fornecedorPessoa.cnpj,
              nomeFantasia: nota.fornecedorPessoa.nomeFantasia,
              ...flags,
              modoDocumental: resolverModoDocumentalEntrada(flags),
            }
          })()
        : null,
      analise: sanitizarAnaliseExibicao(nota.tipoDocumento, nota.analiseJson as AnaliseJson | null),
      transporteXml:
        nota.xmlConteudo && (nota.tipoDocumento === 'nfe55' || !nota.tipoDocumento)
          ? extrairDadosTransporteDoXmlNfe(nota.xmlConteudo)
          : null,
      ctesVinculados: (nota.vinculosComoNfe ?? []).map((v) => {
        const cte = v.cteRecebida
        const icms = cte?.xmlConteudo ? extrairIcmsDoXmlCte(cte.xmlConteudo) : null
        const cfop = cte?.xmlConteudo ? extrairCfopDoXmlCte(cte.xmlConteudo) : null
        const sugestaoFinanceiroFrete = cte?.xmlConteudo
          ? extrairSugestaoFinanceiroDoXmlCte(cte.xmlConteudo)
          : null
        const despesaStub = cte?.despesasEntrada?.[0] ?? null
        return {
          id: v.id,
          origemVinculo: v.origemVinculo,
          chaveNfeReferenciada: v.chaveNfeReferenciada,
          valorFrete: decimalNum(v.valorFrete),
          icms,
          cfop,
          cfopEntrada: cte?.cfopEntrada
            ? {
                id: cte.cfopEntrada.id,
                codigo: cte.cfopEntrada.codigo,
                nome: cte.cfopEntrada.nome,
              }
            : null,
          sugestaoFinanceiroFrete,
          financeiro: despesaStub
            ? {
                id: despesaStub.id,
                numeroDocumento: despesaStub.numeroDocumento ?? null,
                vencimento: despesaStub.vencimento
                  ? despesaStub.vencimento.toISOString().slice(0, 10)
                  : null,
                valor: decimalNum(despesaStub.valor),
                status: despesaStub.status,
                parcelas: parcelasJsonParaResposta(despesaStub.parcelas, {
                  numeroDocumento: despesaStub.numeroDocumento ?? null,
                  vencimento: despesaStub.vencimento,
                  valor: decimalNum(despesaStub.valor),
                }),
              }
            : null,
          cte: cte
            ? {
                id: cte.id,
                chaveNfe: cte.chaveNfe,
                nomeEmitente: cte.nomeEmitente,
                documentoEmitente: cte.documentoEmitente,
                valorTotal: decimalNum(cte.valorTotal),
                dataEmissao: cte.dataEmissao,
                statusEntrada: cte.statusEntrada,
              }
            : null,
        }
      }),
      nfesVinculadas: (nota.vinculosComoCte ?? []).map((v) => ({
        id: v.id,
        origemVinculo: v.origemVinculo,
        nfe: v.nfeRecebida
          ? {
              id: v.nfeRecebida.id,
              chaveNfe: v.nfeRecebida.chaveNfe,
              nomeEmitente: v.nfeRecebida.nomeEmitente,
              valorTotal: decimalNum(v.nfeRecebida.valorTotal),
              statusEntrada: v.nfeRecebida.statusEntrada,
            }
          : null,
      })),
      despesasFrete: (nota.despesasEntrada ?? []).map((d) => ({
        id: d.id,
        valor: decimalNum(d.valor),
        status: d.status,
        origem: d.origem,
        pessoaId: d.pessoaId,
        numeroDocumento: d.numeroDocumento ?? null,
        vencimento: d.vencimento ? d.vencimento.toISOString().slice(0, 10) : null,
        parcelas: parcelasJsonParaResposta(d.parcelas, {
          numeroDocumento: d.numeroDocumento ?? null,
          vencimento: d.vencimento,
          valor: decimalNum(d.valor),
        }),
      })),
      itens: nota.itens.map((i) => {
        const cProd = (i.codigoProduto ?? '').trim().toLowerCase()
        const codigoFornecedorVinculo =
          i.produtoId != null ? (codigosVinculo.get(i.produtoId) ?? '').trim() || null : null
        const noVinculoNorm = (codigoFornecedorVinculo ?? '').toLowerCase()
        const codigoOriginalGravado = Boolean(i.produtoId && cProd && noVinculoNorm === cProd)
        const quantidade = decimalNum(i.quantidade)
        const itensPorEmbalagem = resolverItensPorEmbalagem(
          i.produto?.fornecedores,
          nota.fornecedorPessoaId
        )
        const qtdTotalUn =
          quantidade != null ? Math.round(quantidade * itensPorEmbalagem * 1e6) / 1e6 : null
        return {
          id: i.id,
          nItem: i.nItem,
          descricao: i.descricao,
          gtin: i.gtin,
          codigoProduto: i.codigoProduto,
          ncm: i.ncm,
          cfop: i.cfop,
          cst: i.cst,
          origem: i.origem,
          unidade: i.unidade,
          quantidade,
          valorUnitario: decimalNum(i.valorUnitario),
          valorTotal: decimalNum(i.valorTotal),
          pesoKg: decimalNum(i.pesoKg),
          custoFreteRateado: decimalNum(i.custoFreteRateado),
          produtoId: i.produtoId,
          vinculoModo: i.vinculoModo,
          criticaCadastro: i.criticaCadastro,
          criticaFiscal: i.criticaFiscal,
          criticaNegociacao: i.criticaNegociacao,
          codigoOriginalGravado,
          codigoFornecedorVinculo,
          itensPorEmbalagem,
          qtdTotalUn,
          cfopEntrada: i.cfopEntrada
            ? { id: i.cfopEntrada.id, codigo: i.cfopEntrada.codigo, nome: i.cfopEntrada.nome }
            : null,
          produto: i.produto
            ? {
                id: i.produto.id,
                nomeVenda: i.produto.nomeVenda,
                sku: i.produto.sku,
                codigoBarras: i.produto.codigoBarras,
                marca: i.produto.marca,
                unidade: i.produto.unidade,
                ncm: i.produto.ncm,
                codigoOrigem: i.produto.codigoOrigem,
              }
            : null,
        }
      }),
    },
    pedidosDisponiveis,
  }
}

/** Remove aviso legado de "sem itens" em documentos documentais (NFS-e / CTe). */
function sanitizarAnaliseExibicao(
  tipoDocumento: string | null | undefined,
  analise: AnaliseJson | null
): AnaliseJson | null {
  if (!analise || (tipoDocumento !== 'nfse' && tipoDocumento !== 'cte')) return analise
  const avisoItens = 'Nota sem itens parseados do XML'
  const avisos = (analise.cadastro?.avisos ?? []).filter((a) => !a.includes(avisoItens))
  const bloqueios = analise.cadastro?.bloqueios ?? []
  const statusCadastro =
    bloqueios.length > 0 ? 'bloqueante' : avisos.length > 0 ? 'aviso' : 'ok'
  return {
    ...analise,
    cadastro: {
      ...analise.cadastro,
      status: statusCadastro,
      avisos,
      bloqueios,
    },
  }
}

/**
 * Recalcula só o cadastro (fornecedor + vínculo de itens) e para exatamente aí —
 * não roda fiscal/negociação/frete. Usado após vincular/desvincular **um** item
 * isolado, para não religar automaticamente os demais itens da nota (o usuário
 * concilia um a um; só o Reanalisar roda o pipeline completo de novo).
 */
async function recalcularSomenteCadastro(companyId: string, notaId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  const flagsFornecedor = await obterFlagsFornecedorEntrada(companyId, nota)
  const modoDocumental = resolverModoDocumentalEntrada(flagsFornecedor)

  const cadastro = await analisarCadastro({
    companyId,
    documentoEmitente: nota.documentoEmitente,
    fornecedorPessoaId: nota.fornecedorPessoaId,
    modoDocumental,
    itens: nota.itens.map((i) => ({
      id: i.id,
      gtin: i.gtin,
      codigoProduto: i.codigoProduto,
      produtoId: i.produtoId,
      vinculoModo: i.vinculoModo,
    })),
  })

  for (const item of cadastro.itensAtualizados) {
    await repositorioEntradaNotas.atualizarItem(item.id, {
      produtoId: item.produtoId,
      vinculoModo: item.vinculoModo,
      criticaCadastro: item.criticaCadastro,
    })
  }

  const analiseAtual: AnaliseJson = (nota.analiseJson as AnaliseJson | null) ?? {
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    cadastro: etapaVazia(),
    fiscal: etapaVazia(),
    negociacao: etapaVazia(),
    autoLancado: false,
    motivoParada: null,
  }
  const analise: AnaliseJson = {
    ...analiseAtual,
    cadastro: cadastro.resultado,
    autoLancado: false,
    motivoParada: podeAvancarCadastro(cadastro.resultado) ? null : 'cadastro',
  }

  await repositorioEntradaNotas.atualizarNota(notaId, {
    fornecedorPessoaId: cadastro.fornecedorPessoaId,
    statusEntrada: 'em_analise',
    origemLancamento: null,
    analiseJson: asJson(analise),
    etapaAtual: 'cadastro',
  })

  return obterDetalhe(companyId, notaId)
}

async function vincularItem(
  companyId: string,
  notaId: string,
  itemId: string,
  produtoId: string
) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada === 'cancelada') {
    throw new ErroDaAplicacao('Nota cancelada — não é possível vincular produto.', 409)
  }
  const item = nota.itens.find((i) => i.id === itemId)
  if (!item) throw new ErroDaAplicacao('Item não encontrado', 404)
  if (item.produtoId) {
    throw new ErroDaAplicacao(
      'Vínculo travado — item já conciliado. Corrija o cadastro do produto se houver divergência.',
      409
    )
  }

  const produto = await clientePrisma.produto.findFirst({
    where: { id: produtoId, companyId },
    select: { id: true },
  })
  if (!produto) throw new ErroDaAplicacao('Produto não encontrado', 404)

  await repositorioEntradaNotas.atualizarItem(itemId, {
    produtoId,
    vinculoModo: 'manual',
    criticaCadastro: false,
  })

  return recalcularSomenteCadastro(companyId, notaId)
}

/**
 * Endpoint legado: desvincular na entrada está desativado.
 * Itens já vinculados ficam travados — correção de divergência no cadastro do produto.
 */
async function desvincularItem(companyId: string, notaId: string, itemId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada === 'cancelada') {
    throw new ErroDaAplicacao('Nota cancelada — não é possível desvincular produto.', 409)
  }
  const item = nota.itens.find((i) => i.id === itemId)
  if (!item) throw new ErroDaAplicacao('Item não encontrado', 404)
  if (item.produtoId) {
    throw new ErroDaAplicacao(
      'Vínculo travado — não é possível desvincular na entrada. Corrija o cadastro do produto.',
      409
    )
  }

  throw new ErroDaAplicacao('Item sem vínculo de produto para desvincular.', 400)
}

async function gravarCodigoOriginal(companyId: string, notaId: string, itemId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (!nota.fornecedorPessoaId) {
    throw new ErroDaAplicacao('Vincule o fornecedor antes de gravar o código original.', 400)
  }
  const item = nota.itens.find((i) => i.id === itemId)
  if (!item?.produtoId) throw new ErroDaAplicacao('Item sem produto vinculado', 400)
  if (!item.codigoProduto) throw new ErroDaAplicacao('Item sem cProd na NF', 400)

  await repositorioEntradaNotas.gravarCodigoOriginalVinculo(
    item.produtoId,
    nota.fornecedorPessoaId,
    item.codigoProduto
  )
  return { sucesso: true, mensagem: 'Código original gravado no vínculo produto × fornecedor.' }
}

async function importarFiscalProduto(
  companyId: string,
  notaId: string,
  itemId: string,
  campos: { ncm?: boolean; origem?: boolean }
) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  const item = nota.itens.find((i) => i.id === itemId)
  if (!item?.produtoId) throw new ErroDaAplicacao('Item sem produto vinculado', 400)

  await repositorioEntradaNotas.atualizarFiscalProduto(item.produtoId, companyId, {
    ncm: campos.ncm ? item.ncm : undefined,
    codigoOrigem: campos.origem ? item.origem : undefined,
  })
  return analisarNota(companyId, notaId)
}

/**
 * Troca manualmente o CFOP de entrada de um item (aba Fiscal). Não roda o pipeline
 * inteiro nem muda a regra de bloqueio de CST/CFOP — é só a classificação de entrada.
 */
async function definirCfopEntrada(
  companyId: string,
  notaId: string,
  itemId: string,
  cfopId: string
) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  const item = nota.itens.find((i) => i.id === itemId)
  if (!item) throw new ErroDaAplicacao('Item não encontrado', 404)

  const cfop = await repositorioEntradaNotas.buscarCfopEntradaAtivo(companyId, cfopId)
  if (!cfop) {
    throw new ErroDaAplicacao('CFOP de entrada não encontrado, inativo ou de saída.', 400)
  }

  await repositorioEntradaNotas.atualizarItem(itemId, { cfopEntradaId: cfop.id })
  return obterDetalhe(companyId, notaId)
}

/**
 * Troca manualmente o CFOP de entrada do documento CT-e (aba Frete/CT-e).
 * Não roda o pipeline nem altera gate de frete — só classificação de entrada.
 */
async function definirCfopEntradaCte(companyId: string, cteId: string, cfopId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, cteId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.tipoDocumento !== 'cte') {
    throw new ErroDaAplicacao('CFOP de entrada do frete só se aplica a documentos CT-e.', 400)
  }

  const cfop = await repositorioEntradaNotas.buscarCfopEntradaAtivo(companyId, cfopId)
  if (!cfop) {
    throw new ErroDaAplicacao('CFOP de entrada não encontrado, inativo ou de saída.', 400)
  }

  await repositorioEntradaNotas.atualizarNota(cteId, { cfopEntradaId: cfop.id })
  return obterDetalhe(companyId, cteId)
}

async function liberarCriticas(companyId: string, notaId: string, usuarioId: string, senha: string) {
  if (!senha?.trim()) {
    throw new ErroDaAplicacao(
      'Senha de gerente obrigatória para liberar críticas (divergência NCM/origem ou negociação).',
      400
    )
  }
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  const analise = nota.analiseJson as AnaliseJson | null
  if (analise?.cadastro?.status === 'bloqueante') {
    throw new ErroDaAplicacao(
      nota.fornecedorPessoaId
        ? 'Cadastro bloqueante não pode ser liberado por senha. Vincule os produtos sem vínculo, depois reanalise.'
        : 'Cadastro bloqueante não pode ser liberado por senha. Cadastre o fornecedor e vincule os produtos, depois reanalise.',
      400
    )
  }
  if (fiscalExigeManifesto(analise?.fiscal)) {
    throw new ErroDaAplicacao(
      'CST/CFOP impeditivo não pode ser liberado por senha. Use desconhecimento da operação ou devolução.',
      400
    )
  }

  const ok = await servicoDeAutenticacao.verificarSenhaDoUsuario(usuarioId, senha)
  if (!ok) throw new ErroDaAplicacao('Senha inválida.', 403)
  await repositorioEntradaNotas.atualizarNota(notaId, { criticasLiberadas: true })
  return analisarNota(companyId, notaId)
}

async function cancelarLiberacaoCriticas(companyId: string, notaId: string) {
  await repositorioEntradaNotas.atualizarNota(notaId, { criticasLiberadas: false })
  return analisarNota(companyId, notaId)
}

async function contatoFornecedor(companyId: string, notaId: string, observacao: string) {
  await repositorioEntradaNotas.atualizarNota(notaId, {
    statusEntrada: 'stand_by',
    observacaoContato: observacao,
    etapaAtual: 'negociacao',
  })
  return obterDetalhe(companyId, notaId)
}

async function definirPedido(companyId: string, notaId: string, pedidoCompraId: string) {
  const pedido = await repositorioEntradaNotas.buscarPedidoComItens(companyId, pedidoCompraId)
  if (!pedido) throw new ErroDaAplicacao('Pedido não encontrado', 404)
  await repositorioEntradaNotas.atualizarNota(notaId, { pedidoCompraId })
  return analisarNota(companyId, notaId)
}

async function definirPrazo(companyId: string, notaId: string, prazo: string) {
  await repositorioEntradaNotas.atualizarNota(notaId, { prazoPagamentoTexto: prazo })
  return analisarNota(companyId, notaId)
}

async function manifestar(
  companyId: string,
  notaId: string,
  tipo: 'desconhecimento' | 'nao_realizada',
  justificativa?: string,
  usuarioId?: string,
  senha?: string
) {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada === 'problema_resolvido') {
    throw new ErroDaAplicacao('Nota com problema já resolvida — não é possível manifestar.', 409)
  }
  if (
    nota.statusEntrada === 'entrada_contagem' ||
    nota.statusEntrada === 'entrada_consolidada' ||
    nota.statusEntrada === 'cancelada'
  ) {
    throw new ErroDaAplicacao('Nota já finalizada ou cancelada.', 409)
  }

  if (tipo === 'desconhecimento') {
    if (!senha?.trim()) {
      throw new ErroDaAplicacao('Senha obrigatória para desconhecer a operação.', 400)
    }
    if (!usuarioId) throw new ErroDaAplicacao('Usuário não autenticado', 401)
    const ok = await servicoDeAutenticacao.verificarSenhaDoUsuario(usuarioId, senha)
    if (!ok) throw new ErroDaAplicacao('Senha inválida.', 403)
  }

  const cfg = await repositorioFocusNfe.buscarConfigPorEmpresa(companyId)
  if (!cfg?.apiToken) throw new ErroDaAplicacao('Configure o token Focus NFe', 400)

  const tipoApi =
    tipo === 'desconhecimento' ? 'desconhecimento_da_operacao' : 'operacao_nao_realizada'

  await clienteFocusNfe.manifestar(
    cfg.apiToken,
    cfg.homologacao,
    nota.chaveNfe,
    tipoApi,
    justificativa
  )

  const vinhaComProblema = nota.statusEntrada === 'com_problema'
  await repositorioEntradaNotas.atualizarNota(notaId, {
    statusEntrada: 'cancelada',
    manifestacaoDestinatario: tipoApi,
    etapaAtual: 'lancamento',
    ...(tipo === 'desconhecimento' && vinhaComProblema
      ? {
          problemaDesfecho: 'desconhecimento',
          problemaResolvidoEm: new Date(),
        }
      : {}),
  })
  return obterDetalhe(companyId, notaId)
}

const STATUS_BLOQUEADOS_MARCAR_PROBLEMA = [
  'entrada_contagem',
  'entrada_consolidada',
  'cancelada',
  'problema_resolvido',
] as const

async function marcarProblema(companyId: string, notaId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada === 'com_problema') {
    return obterDetalhe(companyId, notaId)
  }
  if (
    (STATUS_BLOQUEADOS_MARCAR_PROBLEMA as readonly string[]).includes(nota.statusEntrada)
  ) {
    throw new ErroDaAplicacao(
      'Não é possível marcar esta nota com problema no status atual.',
      409
    )
  }

  await repositorioEntradaNotas.atualizarNota(notaId, {
    statusEntrada: 'com_problema',
    problemaMarcadoEm: new Date(),
    problemaDesfecho: null,
    problemaResolvidoEm: null,
  })
  return obterDetalhe(companyId, notaId)
}

async function listarTratativas(companyId: string, notaId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  const tratativas = await repositorioEntradaNotas.listarTratativas(companyId, notaId)
  return {
    tratativas: tratativas.map((t) => ({
      id: t.id,
      texto: t.texto,
      createdAt: t.createdAt,
      usuario: t.usuario
        ? { id: t.usuario.id, name: t.usuario.name, email: t.usuario.email }
        : null,
    })),
  }
}

async function adicionarTratativa(
  companyId: string,
  notaId: string,
  usuarioId: string,
  texto: string
) {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada !== 'com_problema' && nota.statusEntrada !== 'problema_resolvido') {
    throw new ErroDaAplicacao(
      'Tratativas só podem ser registradas em notas com problema.',
      409
    )
  }
  if (nota.statusEntrada === 'problema_resolvido') {
    throw new ErroDaAplicacao(
      'Nota com problema já resolvida — tratativas ficam somente para consulta.',
      409
    )
  }

  await repositorioEntradaNotas.criarTratativa({
    companyId,
    nfeRecebidaId: notaId,
    usuarioId,
    texto: texto.trim(),
  })
  return obterDetalhe(companyId, notaId)
}

async function resolverProblema(
  companyId: string,
  notaId: string,
  desfecho: 'solucao'
) {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada !== 'com_problema') {
    throw new ErroDaAplicacao(
      'Só é possível registrar solução em nota no painel Com problemas.',
      409
    )
  }
  if (desfecho !== 'solucao') {
    throw new ErroDaAplicacao('Desfecho inválido.', 400)
  }

  await repositorioEntradaNotas.atualizarNota(notaId, {
    statusEntrada: 'problema_resolvido',
    problemaDesfecho: 'solucao',
    problemaResolvidoEm: new Date(),
  })
  return obterDetalhe(companyId, notaId)
}

async function descancelar(companyId: string, notaId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada !== 'cancelada') {
    throw new ErroDaAplicacao('Nota não está cancelada.', 409)
  }

  await repositorioEntradaNotas.atualizarNota(notaId, {
    statusEntrada: 'em_analise',
    manifestacaoDestinatario: null,
  })
  return analisarNota(companyId, notaId)
}

async function lancar(
  companyId: string,
  notaId: string,
  usuarioId: string,
  modo: 'contagem' | 'consolidar',
  senha?: string
) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (
    nota.statusEntrada === 'entrada_contagem' ||
    nota.statusEntrada === 'entrada_consolidada'
  ) {
    throw new ErroDaAplicacao('Nota já lançada.', 409)
  }
  if (nota.statusEntrada === 'cancelada') {
    throw new ErroDaAplicacao('Nota cancelada — não é possível lançar.', 409)
  }
  if (nota.statusEntrada === 'com_problema' || nota.statusEntrada === 'problema_resolvido') {
    throw new ErroDaAplicacao(
      'Nota com problema — não é possível lançar. Resolva ou desconheça a operação.',
      409
    )
  }
  if (
    (nota.tipoDocumento === 'nfe55' || !nota.tipoDocumento) &&
    nota.itens.length === 0
  ) {
    throw new ErroDaAplicacao(
      'Nota sem itens parseados do XML. Reimporte o XML ou complete o download na Focus antes de lançar.',
      400
    )
  }

  const gate = pipelineProntoParaLancar(
    nota.analiseJson as AnaliseJson | null,
    nota.criticasLiberadas,
    nota.fornecedorPessoaId
  )
  if (!gate.ok) {
    throw new ErroDaAplicacao(gate.mensagem, 400)
  }

  if (modo === 'consolidar') {
    if (!senha) throw new ErroDaAplicacao('Senha de gerente obrigatória para consolidar estoque.', 400)
    const ok = await servicoDeAutenticacao.verificarSenhaDoUsuario(usuarioId, senha)
    if (!ok) throw new ErroDaAplicacao('Senha inválida.', 403)
    await aplicarRateioEDespesasFrete(companyId, notaId)
    await repositorioEntradaNotas.atualizarNota(notaId, {
      statusEntrada: 'entrada_consolidada',
      etapaAtual: 'lancamento',
      origemLancamento: 'humana',
    })
  } else {
    await aplicarRateioEDespesasFrete(companyId, notaId)
    await lancarContagem(notaId, 'humana')
  }

  return obterDetalhe(companyId, notaId)
}

/**
 * Após import/sync com XML: persiste itens e tenta pipeline automático.
 */
async function processarAposXml(companyId: string, notaId: string) {
  try {
    const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
    if (!nota?.xmlConteudo) return
    if (
      nota.statusEntrada === 'entrada_contagem' ||
      nota.statusEntrada === 'entrada_consolidada' ||
      nota.statusEntrada === 'cancelada' ||
      nota.statusEntrada === 'com_problema' ||
      nota.statusEntrada === 'problema_resolvido'
    ) {
      return
    }

    if (nota.tipoDocumento === 'cte') {
      await servicoVinculoCte.tentarVincularCteAutomatico(companyId, notaId, {
        importarFocusSeAusente: true,
      })
      await analisarNota(companyId, notaId)
      return
    }

    if (nota.tipoDocumento === 'nfse') {
      await analisarNota(companyId, notaId)
      return
    }

    const xml = normalizarXmlNfe(nota.xmlConteudo)
    const campos = extrairCamposResumoDoXml(xml)
    const itens = extrairItensDoXml(xml)
    await repositorioEntradaNotas.substituirItensDoXml(notaId, itens)
    await repositorioEntradaNotas.atualizarNota(notaId, {
      prazoPagamentoXml: campos.prazoPagamentoXml,
      modFrete: campos.modFrete ?? null,
    })
    await servicoVinculoCte.tentarVincularNfesPendentesAoCte(companyId, notaId)
    await analisarNota(companyId, notaId)
  } catch (erro) {
    logFocus('warn', 'pipeline_apos_xml_falhou', {
      companyId,
      notaId,
      mensagem: erro instanceof Error ? erro.message : String(erro),
    })
  }
}

async function vincularCte(
  companyId: string,
  notaId: string,
  body: { chaveCte?: string; cteId?: string }
) {
  await servicoVinculoCte.vincularCteManual(companyId, notaId, body)
  return analisarNota(companyId, notaId)
}

async function desvincularCte(companyId: string, notaId: string, vinculoId: string) {
  await servicoVinculoCte.desvincularCte(companyId, notaId, vinculoId)
  return analisarNota(companyId, notaId)
}

/**
 * Stub financeiro do frete (prévia contas a pagar): N duplicatas
 * (número, vencimento e valor) em DespesaEntradaDocumento — sem gerar título/AP.
 * Soma das parcelas deve bater com o Valor Frete (total do transporte).
 */
const TOLERANCIA_PARCELAS_FRETE = 0.01

type ParcelaFinanceiroFrete = {
  numeroDocumento?: string | null
  vencimento?: string | null
  valor: number
}

function parseVencimentoParcela(raw: string | null | undefined): Date | null {
  if (raw == null || !String(raw).trim()) return null
  const s = String(raw).trim()
  const d = new Date(s.length === 10 ? `${s}T12:00:00` : s)
  if (Number.isNaN(d.getTime())) {
    throw new ErroDaAplicacao('Data de vencimento inválida', 400)
  }
  return d
}

function normalizarParcelasFinanceiroFrete(
  dados: {
    parcelas?: ParcelaFinanceiroFrete[]
    numeroDocumento?: string | null
    vencimento?: string | null
    valor?: number
  }
): Array<{ numeroDocumento: string | null; vencimento: Date | null; valor: number }> {
  const origem =
    dados.parcelas != null && dados.parcelas.length > 0
      ? dados.parcelas
      : [
          {
            numeroDocumento: dados.numeroDocumento ?? null,
            vencimento: dados.vencimento ?? null,
            valor: Number(dados.valor),
          },
        ]

  const normalizadas: Array<{
    numeroDocumento: string | null
    vencimento: Date | null
    valor: number
  }> = []

  for (const p of origem) {
    const valor = Number(p.valor)
    if (!Number.isFinite(valor) || valor < 0) {
      throw new ErroDaAplicacao('Valor de parcela inválido', 400)
    }
    if (valor <= 0) {
      throw new ErroDaAplicacao('Informe o valor (R$) de cada parcela', 400)
    }
    normalizadas.push({
      numeroDocumento:
        p.numeroDocumento != null ? String(p.numeroDocumento).trim() || null : null,
      vencimento: parseVencimentoParcela(p.vencimento),
      valor: Math.round(valor * 100) / 100,
    })
  }

  if (normalizadas.length > 1) {
    for (const p of normalizadas) {
      if (!p.vencimento) {
        throw new ErroDaAplicacao(
          'Informe a data de vencimento de cada parcela quando houver mais de uma',
          400
        )
      }
    }
  }

  return normalizadas
}

function parcelasJsonParaResposta(
  parcelas: unknown,
  fallback: {
    numeroDocumento: string | null
    vencimento: Date | null
    valor: number | null
  }
): Array<{
  numeroDocumento: string | null
  vencimento: string | null
  valor: number | null
}> {
  if (Array.isArray(parcelas) && parcelas.length > 0) {
    return parcelas.map((p) => {
      const row = p as {
        numeroDocumento?: string | null
        vencimento?: string | Date | null
        valor?: number | null
      }
      let venc: string | null = null
      if (row.vencimento != null && String(row.vencimento).trim()) {
        const raw = String(row.vencimento)
        venc = raw.length >= 10 ? raw.slice(0, 10) : raw
      }
      return {
        numeroDocumento: row.numeroDocumento ?? null,
        vencimento: venc,
        valor: row.valor != null ? Number(row.valor) : null,
      }
    })
  }
  return [
    {
      numeroDocumento: fallback.numeroDocumento,
      vencimento: fallback.vencimento
        ? fallback.vencimento.toISOString().slice(0, 10)
        : null,
      valor: fallback.valor,
    },
  ]
}

function resolverTotalTransporteFrete(nota: {
  tipoDocumento: string | null
  valorTotal: unknown
  xmlConteudo: string | null
  vinculosComoNfe?: Array<{
    valorFrete: unknown
    cteRecebida?: { valorTotal: unknown } | null
  }> | null
}): number {
  if (nota.tipoDocumento === 'cte') {
    return decimalNum(nota.valorTotal as { toNumber?: () => number } | number | null) ?? 0
  }
  const vinculos = nota.vinculosComoNfe ?? []
  const somaCtes = vinculos.reduce((acc, v) => {
    const n =
      decimalNum(v.valorFrete as { toNumber?: () => number } | number | null) ??
      decimalNum(v.cteRecebida?.valorTotal as { toNumber?: () => number } | number | null) ??
      0
    return acc + (Number.isFinite(n) ? n : 0)
  }, 0)
  if (somaCtes > 0) return Math.round(somaCtes * 100) / 100
  if (nota.xmlConteudo && (nota.tipoDocumento === 'nfe55' || !nota.tipoDocumento)) {
    const transp = extrairDadosTransporteDoXmlNfe(nota.xmlConteudo)
    const freteNf = transp?.valorFreteNf
    return freteNf != null && Number.isFinite(freteNf) ? Math.round(freteNf * 100) / 100 : 0
  }
  return 0
}

async function salvarFinanceiroFrete(
  companyId: string,
  notaId: string,
  dados: {
    cteId?: string
    parcelas?: ParcelaFinanceiroFrete[]
    numeroDocumento?: string | null
    vencimento?: string | null
    valor?: number
  }
) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.tipoDocumento === 'nfse') {
    throw new ErroDaAplicacao('Financeiro de frete não se aplica a NFS-e', 400)
  }

  const statusesBloqueados = ['cancelada', 'com_problema', 'problema_resolvido']
  if (statusesBloqueados.includes(nota.statusEntrada)) {
    throw new ErroDaAplicacao('Nota fora do fluxo de entrada', 400)
  }

  let cteId = dados.cteId?.trim() || ''
  if (!cteId) {
    if (nota.tipoDocumento === 'cte') {
      cteId = nota.id
    } else {
      cteId = nota.vinculosComoNfe?.[0]?.cteRecebidaId ?? ''
    }
  }
  if (!cteId) throw new ErroDaAplicacao('Vincule um CT-e antes de gravar o financeiro do frete', 400)

  if (nota.tipoDocumento !== 'cte') {
    const existeCte = nota.vinculosComoNfe?.find((v) => v.cteRecebidaId === cteId)
    if (!existeCte) {
      const existe = await clientePrisma.nfeRecebida.findFirst({
        where: { id: cteId, companyId, tipoDocumento: 'cte' },
        select: { id: true },
      })
      if (!existe) throw new ErroDaAplicacao('CT-e não encontrado', 404)
      throw new ErroDaAplicacao('CT-e não está vinculado a esta NF', 400)
    }
  }

  const parcelas = normalizarParcelasFinanceiroFrete(dados)
  const soma = Math.round(parcelas.reduce((s, p) => s + p.valor, 0) * 100) / 100
  const totalTransporte = resolverTotalTransporteFrete(nota)
  if (totalTransporte <= 0) {
    throw new ErroDaAplicacao('Valor Frete (total do transporte) não encontrado na nota', 400)
  }
  if (Math.abs(soma - totalTransporte) > TOLERANCIA_PARCELAS_FRETE) {
    throw new ErroDaAplicacao(
      `Soma das duplicatas (${soma.toFixed(2)}) difere do Valor Frete / total do transporte (${totalTransporte.toFixed(2)})`,
      400
    )
  }

  const pessoaId =
    nota.tipoDocumento === 'cte'
      ? nota.fornecedorPessoaId
      : (nota.vinculosComoNfe?.find((v) => v.cteRecebidaId === cteId)?.cteRecebida
          ?.fornecedorPessoaId ?? null)

  const primeira = parcelas[0]!
  const parcelasJson = parcelas.map((p) => ({
    numeroDocumento: p.numeroDocumento,
    vencimento: p.vencimento ? p.vencimento.toISOString().slice(0, 10) : null,
    valor: p.valor,
  }))

  await clientePrisma.despesaEntradaDocumento.upsert({
    where: {
      nfeRecebidaId_origem: { nfeRecebidaId: cteId, origem: 'cte' },
    },
    create: {
      id: randomUUID(),
      companyId,
      nfeRecebidaId: cteId,
      pessoaId,
      valor: soma,
      status: 'pendente',
      origem: 'cte',
      numeroDocumento: primeira.numeroDocumento,
      vencimento: primeira.vencimento,
      parcelas: parcelasJson as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
    update: {
      pessoaId,
      valor: soma,
      numeroDocumento: primeira.numeroDocumento,
      vencimento: primeira.vencimento,
      parcelas: parcelasJson as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  })

  return obterDetalhe(companyId, notaId)
}

/**
 * Após cadastrar fornecedor: reanalisa NFs em aberto do mesmo CNPJ/CPF
 * (vincula fornecedor e segue o pipeline sem clique em Reanalisar).
 */
async function reanalisarNotasPendentesPorDocumento(companyId: string, documento: string) {
  const notas = await repositorioEntradaNotas.listarNotasPendentesPorDocumento(
    companyId,
    documento
  )
  let ok = 0
  for (const nota of notas) {
    try {
      await analisarNota(companyId, nota.id)
      ok += 1
    } catch (erro) {
      logFocus('warn', 'reanalise_apos_fornecedor_falhou', {
        companyId,
        notaId: nota.id,
        mensagem: erro instanceof Error ? erro.message : String(erro),
      })
    }
  }
  return ok
}

/**
 * Notas já puxadas sem fornecedor: se o CNPJ/CPF do emitente já existe no cadastro,
 * roda o pipeline (vincula e avança) — sem clique em Reanalisar.
 */
async function vincularFornecedoresNasNotasPendentes(companyId: string) {
  const notas = await repositorioEntradaNotas.listarNotasPendentesSemFornecedor(companyId)
  const porDoc = new Map<string, string[]>()
  for (const nota of notas) {
    const doc = normalizarDocumento(nota.documentoEmitente ?? '')
    if (!doc) continue
    const ids = porDoc.get(doc) ?? []
    ids.push(nota.id)
    porDoc.set(doc, ids)
  }

  let vinculadas = 0
  for (const [doc, ids] of porDoc) {
    const fornecedor = await repositorioEntradaNotas.buscarFornecedorPorCnpj(companyId, doc)
    if (!fornecedor) continue
    for (const id of ids) {
      try {
        await analisarNota(companyId, id)
        vinculadas += 1
      } catch (erro) {
        logFocus('warn', 'vinculo_fornecedor_nota_falhou', {
          companyId,
          notaId: id,
          mensagem: erro instanceof Error ? erro.message : String(erro),
        })
      }
    }
  }

  if (vinculadas > 0) {
    logFocus('info', 'vinculo_fornecedores_pendentes', { companyId, vinculadas })
  }
  return vinculadas
}

/** CT-es sem vínculo: liga NF local; Focus só se houver chave de NF e ela ainda não existir. */
async function processarVinculosCtePendentes(
  companyId: string,
  opcoes?: { importarFocusSeAusente?: boolean; forcarRetryFocus?: boolean }
) {
  return servicoVinculoCte.processarVinculosCtePendentes(companyId, opcoes)
}

async function listarCtesAguardandoNf(companyId: string) {
  return servicoVinculoCte.listarCtesAguardandoNf(companyId)
}

export const servicoEntradaNotas = {
  analisarNota,
  obterDetalhe,
  vincularItem,
  desvincularItem,
  voltarEtapa,
  gravarCodigoOriginal,
  importarFiscalProduto,
  definirCfopEntrada,
  definirCfopEntradaCte,
  liberarCriticas,
  cancelarLiberacaoCriticas,
  contatoFornecedor,
  definirPedido,
  definirPrazo,
  manifestar,
  marcarProblema,
  listarTratativas,
  adicionarTratativa,
  resolverProblema,
  descancelar,
  lancar,
  processarAposXml,
  sincronizarItensPendentesDoXml,
  reanalisarNotasPendentesPorDocumento,
  vincularFornecedoresNasNotasPendentes,
  processarVinculosCtePendentes,
  listarCtesAguardandoNf,
  vincularCte,
  desvincularCte,
  salvarFinanceiroFrete,
}
