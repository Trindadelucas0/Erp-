/**
 * Serviço — Contagem de entrada cega (logística).
 * qtdEsperada nunca vai para a API de leitura/bip.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  normalizarCodigoBarrasGtin,
  variantesCodigoBarrasParaBusca,
} from '../../compartilhado/validacoes/codigo-barras-gtin.js'
import { podeIniciarContagemLogistica } from '../entrada-notas/status-entrada-contagem.js'
import { repositorioContagens } from './repositorio-contagens.js'

function decimalNum(valor: unknown): number | null {
  if (valor == null) return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  if (typeof valor === 'string' && valor.trim() !== '') {
    const n = Number(valor)
    return Number.isFinite(n) ? n : null
  }
  if (typeof valor === 'object' && valor !== null && 'toNumber' in valor) {
    try {
      const n = (valor as { toNumber: () => number }).toNumber()
      return Number.isFinite(n) ? n : null
    } catch {
      return null
    }
  }
  return null
}

function arredondarQtd(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

/** Mesma regra do consolidar / pedido: multiplicadorEntrada do vínculo; default 1. */
function resolverItensPorEmbalagem(
  fornecedores: Array<{ fornecedorPessoaId: string; multiplicadorEntrada: unknown }> | undefined,
  fornecedorPessoaId: string | null | undefined
): number {
  if (!fornecedorPessoaId || !fornecedores?.length) return 1
  const vinculo = fornecedores.find((f) => f.fornecedorPessoaId === fornecedorPessoaId)
  const valor = decimalNum(vinculo?.multiplicadorEntrada)
  return valor != null && Number.isFinite(valor) && valor > 0 ? valor : 1
}

function extrairSerieNumeroChave(chave: string): { serie: string | null; numero: string | null } {
  const digitos = chave.replace(/\D/g, '')
  if (digitos.length !== 44) return { serie: null, numero: null }
  const serie = String(Number(digitos.slice(22, 25)))
  const numero = String(Number(digitos.slice(25, 34)))
  return { serie, numero }
}

function mapearNotaCega(nota: {
  id: string
  chaveNfe: string
  nomeEmitente: string | null
  documentoEmitente: string | null
  dataEmissao: Date | null
  statusEntrada?: string
}) {
  const { serie, numero } = extrairSerieNumeroChave(nota.chaveNfe)
  return {
    id: nota.id,
    chaveNfe: nota.chaveNfe,
    nomeEmitente: nota.nomeEmitente,
    documentoEmitente: nota.documentoEmitente,
    dataEmissao: nota.dataEmissao,
    serie,
    numero,
    ...(nota.statusEntrada != null ? { statusEntrada: nota.statusEntrada } : {}),
  }
}

function limparNomeExibicaoLegado(nome: string, sku: string | null): string {
  if (!sku) return nome
  const sufixo = ` (${sku})`
  if (nome.endsWith(sufixo)) return nome.slice(0, -sufixo.length).trimEnd()
  return nome
}

function mapearItemCego(item: {
  id: string
  produtoId: string
  nomeExibicao: string
  codigoBarras: string | null
  codigoOriginal: string | null
  marca: string | null
  unidade: string | null
  qtdEmbalagemPadrao: unknown
  qtdContada: unknown
  statusItem: string
  produto?: { sku?: string | null } | null
}) {
  const sku = item.produto?.sku?.trim() || null
  return {
    id: item.id,
    produtoId: item.produtoId,
    sku,
    nomeExibicao: limparNomeExibicaoLegado(item.nomeExibicao, sku),
    codigoBarras: item.codigoBarras,
    codigoOriginal: item.codigoOriginal,
    marca: item.marca,
    unidade: item.unidade,
    qtdEmbalagemPadrao: decimalNum(item.qtdEmbalagemPadrao),
    qtdContada: decimalNum(item.qtdContada) ?? 0,
    statusItem: item.statusItem,
  }
}

function sessaoEditavel(sessao: { status: string; baixadaEm?: Date | null }): boolean {
  if (sessao.baixadaEm) return false
  return sessao.status === 'aberta' || sessao.status === 'em_andamento'
}

function mapearSessaoLista(
  sessao: {
    id: string
    status: string
    iniciadoEm: Date | null
    finalizadoEm?: Date | null
    usuario?: { id: string; name: string } | null
    notas: Array<{ nfeRecebida: Parameters<typeof mapearNotaCega>[0] }>
  },
  comFinalizado: boolean
) {
  return {
    id: sessao.id,
    status: sessao.status,
    iniciadoEm: sessao.iniciadoEm,
    ...(comFinalizado ? { finalizadoEm: sessao.finalizadoEm ?? null } : {}),
    operadorNome: sessao.usuario?.name?.trim() || '—',
    entradas: sessao.notas.map((n) => mapearNotaCega(n.nfeRecebida)),
  }
}

async function listarDisponiveis(companyId: string) {
  const [{ notas, ignoradas }, sessoesBrutas, historicoBruto] = await Promise.all([
    repositorioContagens.listarNotasDisponiveis(companyId),
    repositorioContagens.listarSessoesAtivas(companyId),
    repositorioContagens.listarHistoricoRecente(companyId, 20),
  ])
  return {
    notas: notas.map(mapearNotaCega),
    ignoradas: ignoradas.map((n) => ({
      ...mapearNotaCega(n),
      motivo: n.motivo,
    })),
    sessoesAtivas: sessoesBrutas.map((sessao) => mapearSessaoLista(sessao, false)),
    historicoRecente: historicoBruto.map((sessao) => mapearSessaoLista(sessao, true)),
  }
}

async function criar(companyId: string, usuarioId: string, nfeRecebidaIds: string[]) {
  const idsUnicos = [...new Set(nfeRecebidaIds)]
  if (idsUnicos.length === 0) {
    throw new ErroDaAplicacao('Selecione ao menos uma entrada', 400)
  }

  const ocupadas = await repositorioContagens.notasEmSessaoAtiva(companyId, idsUnicos)
  if (ocupadas.length > 0) {
    throw new ErroDaAplicacao(
      'Uma ou mais entradas já estão em contagem ativa. Cancele a outra sessão ou escolha outras notas.',
      409
    )
  }

  const notas = await repositorioContagens.buscarNotasParaSessao(companyId, idsUnicos)
  if (notas.length !== idsUnicos.length) {
    throw new ErroDaAplicacao('Uma ou mais entradas não foram encontradas', 404)
  }

  for (const nota of notas) {
    if (!podeIniciarContagemLogistica(nota.statusEntrada)) {
      throw new ErroDaAplicacao(
        `Entrada ${nota.chaveNfe} não está liberada para contagem (status: ${nota.statusEntrada}).`,
        409
      )
    }
    if (nota.tipoDocumento === 'nfse' || nota.tipoDocumento === 'cte') {
      throw new ErroDaAplicacao('Contagem física só se aplica a NFe 55 de produto.', 400)
    }
    if (!nota.itens.some((i) => i.produtoId)) {
      throw new ErroDaAplicacao(
        `Entrada ${nota.chaveNfe} não tem itens vinculados a produto — não pode ir para contagem cega.`,
        400
      )
    }
  }

  type Agregado = {
    produtoId: string
    nomeExibicao: string
    codigoBarras: string | null
    codigoOriginal: string | null
    marca: string | null
    unidade: string | null
    qtdEmbalagemPadrao: number | null
    qtdEsperada: number
  }

  const porProduto = new Map<string, Agregado>()

  for (const nota of notas) {
    for (const item of nota.itens) {
      if (!item.produtoId || !item.produto) continue
      const produto = item.produto
      const qtdNf = decimalNum(item.quantidade)
      if (qtdNf == null || qtdNf <= 0) continue

      const fator = resolverItensPorEmbalagem(produto.fornecedores, nota.fornecedorPessoaId)
      const qtdVenda = arredondarQtd(qtdNf * fator)

      const vinculo = produto.fornecedores.find(
        (f) => f.fornecedorPessoaId === nota.fornecedorPessoaId
      )
      const master = produto.embalagensMaster[0]
      const qtdMaster = decimalNum(master?.quantidade)

      const existente = porProduto.get(item.produtoId)
      if (existente) {
        existente.qtdEsperada = arredondarQtd(existente.qtdEsperada + qtdVenda)
        if (!existente.codigoOriginal && vinculo?.codigoFornecedor) {
          existente.codigoOriginal = vinculo.codigoFornecedor
        }
        continue
      }

      porProduto.set(item.produtoId, {
        produtoId: item.produtoId,
        nomeExibicao: produto.nomeVenda,
        codigoBarras: produto.codigoBarras,
        codigoOriginal: vinculo?.codigoFornecedor ?? item.codigoProduto ?? null,
        marca: produto.marca || null,
        unidade: produto.unidade || item.unidade || 'UN',
        qtdEmbalagemPadrao: qtdMaster != null && qtdMaster > 0 ? qtdMaster : 1,
        qtdEsperada: qtdVenda,
      })
    }
  }

  const itens = [...porProduto.values()]
  if (itens.length === 0) {
    throw new ErroDaAplicacao(
      'Nenhum item com quantidade válida para montar a contagem.',
      400
    )
  }

  const sessao = await repositorioContagens.criarSessao({
    companyId,
    usuarioId,
    nfeRecebidaIds: idsUnicos,
    itens,
  })

  return obterDetalhe(companyId, sessao.id)
}

function montarDetalheCego(sessao: Awaited<ReturnType<typeof repositorioContagens.buscarSessaoCompleta>>) {
  if (!sessao) throw new ErroDaAplicacao('Contagem não encontrada', 404)
  return {
    id: sessao.id,
    status: sessao.status,
    iniciadoEm: sessao.iniciadoEm,
    finalizadoEm: sessao.finalizadoEm,
    observacao: sessao.observacao,
    baixadaEm: sessao.baixadaEm,
    entradas: sessao.notas.map((n) => mapearNotaCega(n.nfeRecebida)),
    itens: sessao.itens.map(mapearItemCego),
  }
}

async function obterDetalhe(companyId: string, id: string) {
  const sessao = await repositorioContagens.buscarSessaoCompleta(companyId, id)
  return montarDetalheCego(sessao)
}

type MatchBip =
  | { tipo: 'unidade'; produtoId: string; incremento: number }
  | { tipo: 'master'; produtoId: string; incremento: number }

function resolverBipNaSessao(
  codigoInformado: string,
  itens: Array<{
    produtoId: string
    produto: {
      codigoBarras: string | null
      embalagensMaster: Array<{ codigoBarras: string | null; quantidade: unknown }>
    }
  }>
): MatchBip | null {
  const variantes = variantesCodigoBarrasParaBusca(codigoInformado)
  if (variantes.length === 0) return null

  for (const item of itens) {
    const barrasProduto = item.produto.codigoBarras
      ? variantesCodigoBarrasParaBusca(item.produto.codigoBarras)
      : []
    for (const v of variantes) {
      if (barrasProduto.includes(v) || barrasProduto.includes(normalizarCodigoBarrasGtin(v))) {
        return { tipo: 'unidade', produtoId: item.produtoId, incremento: 1 }
      }
    }
  }

  for (const item of itens) {
    for (const master of item.produto.embalagensMaster) {
      if (!master.codigoBarras) continue
      const barrasMaster = variantesCodigoBarrasParaBusca(master.codigoBarras)
      for (const v of variantes) {
        if (barrasMaster.includes(v) || barrasMaster.includes(normalizarCodigoBarrasGtin(v))) {
          const qtd = decimalNum(master.quantidade)
          if (qtd == null || qtd <= 0) {
            return { tipo: 'master', produtoId: item.produtoId, incremento: 1 }
          }
          return { tipo: 'master', produtoId: item.produtoId, incremento: qtd }
        }
      }
    }
  }

  return null
}

async function bipar(companyId: string, sessaoId: string, codigoBarras: string) {
  const sessao = await repositorioContagens.buscarSessaoCompleta(companyId, sessaoId)
  if (!sessao) throw new ErroDaAplicacao('Contagem não encontrada', 404)
  if (!sessaoEditavel(sessao)) {
    throw new ErroDaAplicacao('Esta contagem já foi finalizada ou cancelada.', 409)
  }

  const match = resolverBipNaSessao(codigoBarras, sessao.itens)
  if (!match) {
    throw new ErroDaAplicacao(
      'Código de barras não corresponde a nenhum produto desta contagem.',
      404
    )
  }

  const item = sessao.itens.find((i) => i.produtoId === match.produtoId)
  if (!item) throw new ErroDaAplicacao('Item não encontrado na sessão', 404)

  const atual = decimalNum(item.qtdContada) ?? 0
  const nova = arredondarQtd(atual + match.incremento)
  await repositorioContagens.atualizarQtdContada(item.id, nova)

  return {
    item: {
      ...mapearItemCego({ ...item, qtdContada: nova, statusItem: 'pendente' }),
    },
    incremento: match.incremento,
    tipoBip: match.tipo,
  }
}

async function atualizarQtdManual(
  companyId: string,
  sessaoId: string,
  itemId: string,
  qtdContada: number
) {
  const sessao = await repositorioContagens.buscarSessaoCompleta(companyId, sessaoId)
  if (!sessao) throw new ErroDaAplicacao('Contagem não encontrada', 404)
  if (!sessaoEditavel(sessao)) {
    throw new ErroDaAplicacao('Esta contagem já foi finalizada ou cancelada.', 409)
  }

  const item = sessao.itens.find((i) => i.id === itemId)
  if (!item) throw new ErroDaAplicacao('Item não encontrado nesta contagem', 404)

  const nova = arredondarQtd(qtdContada)
  await repositorioContagens.atualizarQtdContada(item.id, nova)

  return {
    item: mapearItemCego({ ...item, qtdContada: nova, statusItem: 'pendente' }),
  }
}

function compararItens(
  itens: Array<{ id: string; nomeExibicao: string; qtdEsperada: unknown; qtdContada: unknown }>
) {
  const divergentes: string[] = []
  const updates: Array<{ id: string; statusItem: string }> = []

  for (const item of itens) {
    const esperada = decimalNum(item.qtdEsperada) ?? 0
    const contada = decimalNum(item.qtdContada) ?? 0
    const ok = arredondarQtd(esperada) === arredondarQtd(contada)
    updates.push({ id: item.id, statusItem: ok ? 'ok' : 'divergente' })
    if (!ok) divergentes.push(item.nomeExibicao)
  }

  return { divergentes, updates }
}

async function gravar(
  companyId: string,
  sessaoId: string,
  opcoes: { confirmarDivergencia?: boolean; observacao?: string | null }
) {
  const sessao = await repositorioContagens.buscarSessaoCompleta(companyId, sessaoId)
  if (!sessao) throw new ErroDaAplicacao('Contagem não encontrada', 404)
  if (!sessaoEditavel(sessao)) {
    throw new ErroDaAplicacao('Esta contagem já foi finalizada ou cancelada.', 409)
  }

  const { divergentes, updates } = compararItens(sessao.itens)
  const nfeIds = sessao.notas.map((n) => n.nfeRecebidaId)

  if (divergentes.length === 0) {
    await repositorioContagens.finalizarSessaoOk({
      sessaoId,
      nfeRecebidaIds: nfeIds,
      itemUpdates: updates,
      observacao: opcoes.observacao,
    })
    const detalhe = await obterDetalhe(companyId, sessaoId)
    return {
      ok: true as const,
      divergentes: [] as string[],
      mensagem: 'Contagem conferida. Entradas liberadas para consolidar estoque.',
      sessao: detalhe,
    }
  }

  if (!opcoes.confirmarDivergencia) {
    return {
      ok: false as const,
      divergentes,
      mensagem:
        'Contagem divergente nos itens listados. Reconte sem revelar a quantidade da nota. Se persistir, grave com confirmação para deixar pendente no administrativo.',
      sessao: await obterDetalhe(companyId, sessaoId),
    }
  }

  await repositorioContagens.finalizarSessaoDivergente({
    sessaoId,
    nfeRecebidaIds: nfeIds,
    itemUpdates: updates,
    observacao: opcoes.observacao,
  })

  return {
    ok: false as const,
    divergentes,
    mensagem:
      'Contagem gravada com divergência. Entradas ficaram pendentes para correção administrativa. Consolidar estoque permanece bloqueado.',
    sessao: await obterDetalhe(companyId, sessaoId),
  }
}

async function cancelar(companyId: string, sessaoId: string) {
  const sessao = await repositorioContagens.buscarSessaoCompleta(companyId, sessaoId)
  if (!sessao) throw new ErroDaAplicacao('Contagem não encontrada', 404)
  if (!sessaoEditavel(sessao)) {
    throw new ErroDaAplicacao('Esta contagem já foi finalizada ou cancelada.', 409)
  }

  const nfeIds = sessao.notas.map((n) => n.nfeRecebidaId)
  await repositorioContagens.cancelarSessao({ sessaoId, nfeRecebidaIds: nfeIds })
  return { ok: true, mensagem: 'Contagem cancelada. Entradas voltaram para Liberadas p/ contagem.' }
}

/** Exposto para testes unitários sem banco. */
export const contagemCegaInterno = {
  resolverItensPorEmbalagem,
  resolverBipNaSessao,
  compararItens,
  arredondarQtd,
  extrairSerieNumeroChave,
}

export const servicoContagens = {
  listarDisponiveis,
  criar,
  obterDetalhe,
  bipar,
  atualizarQtdManual,
  gravar,
  cancelar,
}
