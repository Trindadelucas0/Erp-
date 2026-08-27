/**
 * Serviço — Contagem de entrada cega (logística).
 * qtdEsperada nunca vai para a API de leitura/bip.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import {
  normalizarCodigoBarrasGtin,
  variantesCodigoBarrasParaBusca,
} from '../../compartilhado/validacoes/codigo-barras-gtin.js'
import { podeIniciarContagemLogistica } from '../entrada-notas/status-entrada-contagem.js'
import { resolverUnidadeEntrada } from '../pedidos-compra/resolver-item-fornecedor.js'
import {
  repositorioContagens,
  type ItemRevisaoCega,
} from './repositorio-contagens.js'

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

/**
 * Converte incremento de bip (unidade de venda / master) para unidade de compra.
 * peça: +1 / multiplicador; master: +qtdMaster / multiplicador.
 */
function converterIncrementoBipParaCompra(incrementoVenda: number, multiplicador: number): number {
  const mult = multiplicador > 0 ? multiplicador : 1
  return arredondarQtd(incrementoVenda / mult)
}

function nomeUnidadeFallback(sigla: string | null | undefined): string {
  const s = sigla?.trim() || 'UN'
  return s
}

function formatarDescricaoEmbalagem(params: {
  multiplicador: number
  nomeUnidadeCompra: string
  nomeUnidadeVenda: string
}): string | null {
  if (!(params.multiplicador > 1)) return null
  const compra = params.nomeUnidadeCompra.trim().toLowerCase() || 'embalagem'
  const venda = params.nomeUnidadeVenda.trim().toLowerCase() || 'unidade'
  const qtd = Number.isInteger(params.multiplicador)
    ? String(params.multiplicador)
    : String(params.multiplicador)
  return `1 ${compra} com ${qtd} ${venda}`
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
  unidadeNome?: string | null
  descricaoEmbalagem?: string | null
  qtdEmbalagemPadrao: unknown
  qtdContada: unknown
  statusItem: string
  produto?: { sku?: string | null } | null
}) {
  const sku = item.produto?.sku?.trim() || null
  const unidade = item.unidade?.trim() || 'UN'
  return {
    id: item.id,
    produtoId: item.produtoId,
    sku,
    nomeExibicao: limparNomeExibicaoLegado(item.nomeExibicao, sku),
    codigoBarras: item.codigoBarras,
    codigoOriginal: item.codigoOriginal,
    marca: item.marca,
    unidade,
    unidadeNome: item.unidadeNome?.trim() || nomeUnidadeFallback(unidade),
    descricaoEmbalagem: item.descricaoEmbalagem ?? null,
    qtdEmbalagemPadrao: decimalNum(item.qtdEmbalagemPadrao),
    qtdContada: decimalNum(item.qtdContada) ?? 0,
    statusItem: item.statusItem,
  }
}

type VinculoProduto = {
  fornecedorPessoaId: string
  unidadeEntrada?: string | null
  multiplicadorEntrada?: unknown
  codigoFornecedor?: string | null
}

function escolherVinculoProduto(
  fornecedores: VinculoProduto[] | undefined,
  fornecedorIdsNotas: string[]
): VinculoProduto | undefined {
  if (!fornecedores?.length || fornecedorIdsNotas.length === 0) return undefined
  for (const fid of fornecedorIdsNotas) {
    const v = fornecedores.find((f) => f.fornecedorPessoaId === fid)
    if (v) return v
  }
  return undefined
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

function montarSnapshotItens(
  itens: Array<{
    produtoId: string
    nomeExibicao: string
    qtdContada: unknown
    statusItem: string
    produto?: { sku?: string | null } | null
  }>
): ItemRevisaoCega[] {
  return itens.map((item) => {
    const sku = item.produto?.sku?.trim() || null
    return {
      produtoId: item.produtoId,
      nomeExibicao: limparNomeExibicaoLegado(item.nomeExibicao, sku),
      sku,
      qtdContada: decimalNum(item.qtdContada) ?? 0,
      statusItem: item.statusItem,
    }
  })
}

function mapearRevisao(rev: {
  id: string
  acao: string
  observacao: string | null
  itensJson: unknown
  criadoEm: Date
  usuario: { id: string; name: string }
}) {
  const itens = Array.isArray(rev.itensJson) ? rev.itensJson : []
  return {
    id: rev.id,
    acao: rev.acao,
    observacao: rev.observacao,
    criadoEm: rev.criadoEm,
    operadorNome: rev.usuario.name?.trim() || '—',
    itens: itens as ItemRevisaoCega[],
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

      // Contagem cega: esperado = quantidade da NF (unidade de compra), sem × multiplicador.
      const qtdCompra = arredondarQtd(qtdNf)

      const vinculo = produto.fornecedores.find(
        (f) => f.fornecedorPessoaId === nota.fornecedorPessoaId
      )
      const unidadeCompra = resolverUnidadeEntrada(
        {
          fornecedorPessoaId: vinculo?.fornecedorPessoaId ?? '',
          codigoFornecedor: vinculo?.codigoFornecedor ?? null,
          unidadeEntrada: vinculo?.unidadeEntrada ?? null,
        },
        produto.unidade || item.unidade || 'UN'
      )
      const master = produto.embalagensMaster[0]
      const qtdMaster = decimalNum(master?.quantidade)

      const existente = porProduto.get(item.produtoId)
      if (existente) {
        existente.qtdEsperada = arredondarQtd(existente.qtdEsperada + qtdCompra)
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
        unidade: unidadeCompra,
        qtdEmbalagemPadrao: qtdMaster != null && qtdMaster > 0 ? qtdMaster : 1,
        qtdEsperada: qtdCompra,
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

  await registrarAuditoria({
    usuarioId,
    acao: 'criar',
    entidade: 'contagem_entrada',
    entidadeId: sessao.id,
    valoresDepois: { nfeRecebidaIds: idsUnicos, qtdItens: itens.length },
  })

  return obterDetalhe(companyId, sessao.id)
}

async function enriquecerItensComUnidadeCompra(
  companyId: string,
  sessao: NonNullable<Awaited<ReturnType<typeof repositorioContagens.buscarSessaoCompleta>>>
) {
  const fornecedorIds = sessao.notas
    .map((n) => n.nfeRecebida.fornecedorPessoaId)
    .filter((id): id is string => Boolean(id))

  const siglas = new Set<string>()
  for (const item of sessao.itens) {
    const vinculo = escolherVinculoProduto(item.produto?.fornecedores, fornecedorIds)
    const unidadeVenda = item.produto?.unidade?.trim() || item.unidade || 'UN'
    const unidadeCompra = resolverUnidadeEntrada(
      vinculo
        ? {
            fornecedorPessoaId: vinculo.fornecedorPessoaId,
            codigoFornecedor: null,
            unidadeEntrada: vinculo.unidadeEntrada ?? null,
          }
        : undefined,
      unidadeVenda
    )
    siglas.add(unidadeCompra.trim().toUpperCase())
    siglas.add(unidadeVenda.trim().toUpperCase())
  }

  const nomes = await repositorioContagens.listarNomesUnidades(companyId, [...siglas])

  return sessao.itens.map((item) => {
    const vinculo = escolherVinculoProduto(item.produto?.fornecedores, fornecedorIds)
    const unidadeVenda = item.produto?.unidade?.trim() || item.unidade || 'UN'
    const unidadeCompra = resolverUnidadeEntrada(
      vinculo
        ? {
            fornecedorPessoaId: vinculo.fornecedorPessoaId,
            codigoFornecedor: null,
            unidadeEntrada: vinculo.unidadeEntrada ?? null,
          }
        : undefined,
      unidadeVenda
    )
    const mult = resolverItensPorEmbalagem(
      item.produto?.fornecedores,
      vinculo?.fornecedorPessoaId ?? fornecedorIds[0]
    )
    const nomeCompra =
      nomes.get(unidadeCompra.trim().toUpperCase()) || nomeUnidadeFallback(unidadeCompra)
    const nomeVenda =
      nomes.get(unidadeVenda.trim().toUpperCase()) || nomeUnidadeFallback(unidadeVenda)

    return mapearItemCego({
      ...item,
      unidade: unidadeCompra,
      unidadeNome: nomeCompra,
      descricaoEmbalagem: formatarDescricaoEmbalagem({
        multiplicador: mult,
        nomeUnidadeCompra: nomeCompra,
        nomeUnidadeVenda: nomeVenda,
      }),
    })
  })
}

/**
 * Sessões abertas/em andamento com contagem zerada: recalcula qtdEsperada = soma qtd NF
 * (legado tinha qtd NF × multiplicador). Se já digitou, não mexe.
 */
async function recalcularEsperadoSeZerado(
  sessao: NonNullable<Awaited<ReturnType<typeof repositorioContagens.buscarSessaoCompleta>>>
) {
  if (!sessaoEditavel(sessao)) return
  const algumaContada = sessao.itens.some((i) => (decimalNum(i.qtdContada) ?? 0) > 0)
  if (algumaContada) return

  const porProduto = new Map<string, number>()
  for (const vinculoNota of sessao.notas) {
    for (const itemNf of vinculoNota.nfeRecebida.itens ?? []) {
      if (!itemNf.produtoId) continue
      const qtd = decimalNum(itemNf.quantidade)
      if (qtd == null || qtd <= 0) continue
      porProduto.set(
        itemNf.produtoId,
        arredondarQtd((porProduto.get(itemNf.produtoId) ?? 0) + qtd)
      )
    }
  }

  const updates: Array<{ id: string; qtdEsperada: number }> = []
  for (const item of sessao.itens) {
    const nova = porProduto.get(item.produtoId)
    if (nova == null) continue
    const atual = decimalNum(item.qtdEsperada) ?? 0
    if (arredondarQtd(atual) !== arredondarQtd(nova)) {
      updates.push({ id: item.id, qtdEsperada: nova })
      ;(item as { qtdEsperada: unknown }).qtdEsperada = nova
    }
  }
  if (updates.length > 0) {
    await repositorioContagens.atualizarQtdEsperadaItens(updates)
  }
}

async function obterDetalhe(companyId: string, id: string) {
  const sessao = await repositorioContagens.buscarSessaoCompleta(companyId, id)
  if (!sessao) throw new ErroDaAplicacao('Contagem não encontrada', 404)
  await recalcularEsperadoSeZerado(sessao)
  const itens = await enriquecerItensComUnidadeCompra(companyId, sessao)
  return {
    id: sessao.id,
    status: sessao.status,
    iniciadoEm: sessao.iniciadoEm,
    finalizadoEm: sessao.finalizadoEm,
    observacao: sessao.observacao,
    baixadaEm: sessao.baixadaEm,
    versao: sessao.versao,
    entradas: sessao.notas.map((n) => mapearNotaCega(n.nfeRecebida)),
    itens,
    revisoes: (sessao.revisoes ?? []).map(mapearRevisao),
  }
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

function exigirVersao(versao: number | undefined): number {
  if (versao == null || !Number.isInteger(versao) || versao < 1) {
    throw new ErroDaAplicacao('Informe a versão atual da contagem.', 400)
  }
  return versao
}

async function bipar(
  companyId: string,
  sessaoId: string,
  codigoBarras: string,
  versao: number
) {
  const versaoEsperada = exigirVersao(versao)
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

  const fornecedorIds = sessao.notas
    .map((n) => n.nfeRecebida.fornecedorPessoaId)
    .filter((id): id is string => Boolean(id))
  const vinculo = escolherVinculoProduto(item.produto?.fornecedores, fornecedorIds)
  const multiplicador = resolverItensPorEmbalagem(
    item.produto?.fornecedores,
    vinculo?.fornecedorPessoaId ?? fornecedorIds[0]
  )
  const incrementoCompra = converterIncrementoBipParaCompra(match.incremento, multiplicador)

  const atual = decimalNum(item.qtdContada) ?? 0
  const nova = arredondarQtd(atual + incrementoCompra)
  const r = await repositorioContagens.atualizarQtdContadaComVersao({
    sessaoId,
    itemId: item.id,
    qtdContada: nova,
    versaoEsperada,
  })
  if (!r.ok) {
    throw new ErroDaAplicacao(repositorioContagens.MSG_CONCORRENCIA, 409)
  }

  const itensEnriquecidos = await enriquecerItensComUnidadeCompra(companyId, {
    ...sessao,
    itens: sessao.itens.map((i) =>
      i.id === item.id ? { ...i, qtdContada: nova, statusItem: 'pendente' } : i
    ),
  })
  const itemMapeado = itensEnriquecidos.find((i) => i.id === item.id)!

  return {
    item: itemMapeado,
    incremento: incrementoCompra,
    tipoBip: match.tipo,
    versao: versaoEsperada + 1,
  }
}

async function atualizarQtdManual(
  companyId: string,
  sessaoId: string,
  itemId: string,
  qtdContada: number,
  versao: number
) {
  const versaoEsperada = exigirVersao(versao)
  const sessao = await repositorioContagens.buscarSessaoCompleta(companyId, sessaoId)
  if (!sessao) throw new ErroDaAplicacao('Contagem não encontrada', 404)
  if (!sessaoEditavel(sessao)) {
    throw new ErroDaAplicacao('Esta contagem já foi finalizada ou cancelada.', 409)
  }

  const item = sessao.itens.find((i) => i.id === itemId)
  if (!item) throw new ErroDaAplicacao('Item não encontrado nesta contagem', 404)

  const nova = arredondarQtd(qtdContada)
  const r = await repositorioContagens.atualizarQtdContadaComVersao({
    sessaoId,
    itemId: item.id,
    qtdContada: nova,
    versaoEsperada,
  })
  if (!r.ok) {
    throw new ErroDaAplicacao(repositorioContagens.MSG_CONCORRENCIA, 409)
  }

  const itensEnriquecidos = await enriquecerItensComUnidadeCompra(companyId, {
    ...sessao,
    itens: sessao.itens.map((i) =>
      i.id === item.id ? { ...i, qtdContada: nova, statusItem: 'pendente' } : i
    ),
  })
  const itemMapeado = itensEnriquecidos.find((i) => i.id === item.id)!

  return {
    item: itemMapeado,
    versao: versaoEsperada + 1,
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

/**
 * Gravar rascunho: persiste observação + cópia; sessão continua editável.
 * Opcionalmente compara e avisa divergentes sem finalizar.
 */
async function gravar(
  companyId: string,
  sessaoId: string,
  usuarioId: string,
  opcoes: {
    observacao?: string | null
    versao: number
    /** Quantidades da tela (flush antes de gravar) — se informado, aplica no mesmo ato */
    itensQtd?: Array<{ itemId: string; qtdContada: number }>
  }
) {
  const versaoEsperada = exigirVersao(opcoes.versao)
  const sessao = await repositorioContagens.buscarSessaoCompleta(companyId, sessaoId)
  if (!sessao) throw new ErroDaAplicacao('Contagem não encontrada', 404)
  if (!sessaoEditavel(sessao)) {
    throw new ErroDaAplicacao('Esta contagem já foi finalizada ou cancelada.', 409)
  }

  const qtdPorItem = new Map(
    (opcoes.itensQtd ?? []).map((l) => [l.itemId, arredondarQtd(l.qtdContada)])
  )
  const itensParaComparar = sessao.itens.map((item) => ({
    ...item,
    qtdContada: qtdPorItem.has(item.id)
      ? qtdPorItem.get(item.id)!
      : item.qtdContada,
  }))

  const { divergentes, updates } = compararItens(itensParaComparar)
  const snapshot = montarSnapshotItens(
    itensParaComparar.map((item) => {
      const st = updates.find((u) => u.id === item.id)?.statusItem ?? item.statusItem
      return { ...item, statusItem: st }
    })
  )

  const itensQtdNorm =
    opcoes.itensQtd?.map((l) => ({
      itemId: l.itemId,
      qtdContada: arredondarQtd(l.qtdContada),
    })) ?? undefined

  const r = await repositorioContagens.gravarRascunho({
    sessaoId,
    versaoEsperada,
    observacao: opcoes.observacao,
    usuarioId,
    itensSnapshot: snapshot,
    itensQtd: itensQtdNorm,
  })
  if (!r.ok) {
    throw new ErroDaAplicacao(repositorioContagens.MSG_CONCORRENCIA, 409)
  }

  await registrarAuditoria({
    usuarioId,
    acao: 'gravar',
    entidade: 'contagem_entrada',
    entidadeId: sessaoId,
    valoresDepois: {
      observacao: opcoes.observacao ?? null,
      divergentes,
      qtdItens: snapshot.length,
    },
  })

  const detalhe = await obterDetalhe(companyId, sessaoId)
  return {
    ok: divergentes.length === 0,
    divergentes,
    mensagem:
      divergentes.length === 0
        ? 'Contagem gravada. Você pode continuar editando ou Finalizar quando terminar.'
        : 'Contagem gravada com itens divergentes (sem revelar quantidade). Reconte ou use Finalizar quando concluir.',
    sessao: detalhe,
  }
}

/**
 * Finalizar: o que o antigo Gravar fazia — trava logística e libera Baixar no admin.
 */
async function finalizar(
  companyId: string,
  sessaoId: string,
  usuarioId: string,
  opcoes: {
    confirmarDivergencia?: boolean
    observacao?: string | null
    versao: number
    itensQtd?: Array<{ itemId: string; qtdContada: number }>
  }
) {
  const versaoEsperada = exigirVersao(opcoes.versao)
  const sessao = await repositorioContagens.buscarSessaoCompleta(companyId, sessaoId)
  if (!sessao) throw new ErroDaAplicacao('Contagem não encontrada', 404)
  if (!sessaoEditavel(sessao)) {
    throw new ErroDaAplicacao('Esta contagem já foi finalizada ou cancelada.', 409)
  }

  const qtdPorItem = new Map(
    (opcoes.itensQtd ?? []).map((l) => [l.itemId, arredondarQtd(l.qtdContada)])
  )
  const itensParaComparar = sessao.itens.map((item) => ({
    ...item,
    qtdContada: qtdPorItem.has(item.id)
      ? qtdPorItem.get(item.id)!
      : item.qtdContada,
  }))

  const { divergentes, updates } = compararItens(itensParaComparar)
  const nfeIds = sessao.notas.map((n) => n.nfeRecebidaId)
  const snapshot = montarSnapshotItens(
    itensParaComparar.map((item) => {
      const st = updates.find((u) => u.id === item.id)?.statusItem ?? item.statusItem
      return { ...item, statusItem: st }
    })
  )
  const itensQtdNorm =
    opcoes.itensQtd?.map((l) => ({
      itemId: l.itemId,
      qtdContada: arredondarQtd(l.qtdContada),
    })) ?? undefined

  if (divergentes.length === 0) {
    const r = await repositorioContagens.finalizarSessaoOk({
      sessaoId,
      nfeRecebidaIds: nfeIds,
      itemUpdates: updates,
      observacao: opcoes.observacao,
      versaoEsperada,
      usuarioId,
      itensSnapshot: snapshot,
      itensQtd: itensQtdNorm,
    })
    if (!r.ok) {
      throw new ErroDaAplicacao(repositorioContagens.MSG_CONCORRENCIA, 409)
    }
    await registrarAuditoria({
      usuarioId,
      acao: 'finalizar',
      entidade: 'contagem_entrada',
      entidadeId: sessaoId,
      valoresDepois: { status: 'ok' },
    })
    const detalhe = await obterDetalhe(companyId, sessaoId)
    return {
      ok: true as const,
      divergentes: [] as string[],
      mensagem: 'Contagem finalizada. Entradas liberadas para baixar / consolidar estoque.',
      sessao: detalhe,
    }
  }

  if (!opcoes.confirmarDivergencia) {
    return {
      ok: false as const,
      divergentes,
      mensagem:
        'Contagem divergente nos itens listados. Reconte sem revelar a quantidade da nota. Se persistir, finalize com confirmação para deixar pendente no administrativo.',
      sessao: await obterDetalhe(companyId, sessaoId),
    }
  }

  const r = await repositorioContagens.finalizarSessaoDivergente({
    sessaoId,
    nfeRecebidaIds: nfeIds,
    itemUpdates: updates,
    observacao: opcoes.observacao,
    versaoEsperada,
    usuarioId,
    itensSnapshot: snapshot,
    itensQtd: itensQtdNorm,
  })
  if (!r.ok) {
    throw new ErroDaAplicacao(repositorioContagens.MSG_CONCORRENCIA, 409)
  }

  await registrarAuditoria({
    usuarioId,
    acao: 'finalizar',
    entidade: 'contagem_entrada',
    entidadeId: sessaoId,
    valoresDepois: { status: 'divergente', divergentes },
  })

  return {
    ok: false as const,
    divergentes,
    mensagem:
      'Contagem finalizada com divergência. Entradas ficaram pendentes para correção administrativa. Consolidar estoque permanece bloqueado.',
    sessao: await obterDetalhe(companyId, sessaoId),
  }
}

async function cancelar(
  companyId: string,
  sessaoId: string,
  usuarioId: string,
  versao: number
) {
  const versaoEsperada = exigirVersao(versao)
  const sessao = await repositorioContagens.buscarSessaoCompleta(companyId, sessaoId)
  if (!sessao) throw new ErroDaAplicacao('Contagem não encontrada', 404)
  if (!sessaoEditavel(sessao)) {
    throw new ErroDaAplicacao('Esta contagem já foi finalizada ou cancelada.', 409)
  }

  const nfeIds = sessao.notas.map((n) => n.nfeRecebidaId)
  const snapshot = montarSnapshotItens(sessao.itens)
  const r = await repositorioContagens.cancelarSessao({
    sessaoId,
    nfeRecebidaIds: nfeIds,
    versaoEsperada,
    usuarioId,
    itensSnapshot: snapshot,
    observacao: sessao.observacao,
  })
  if (!r.ok) {
    throw new ErroDaAplicacao(repositorioContagens.MSG_CONCORRENCIA, 409)
  }

  await registrarAuditoria({
    usuarioId,
    acao: 'cancelar',
    entidade: 'contagem_entrada',
    entidadeId: sessaoId,
  })

  return { ok: true, mensagem: 'Contagem cancelada. Entradas voltaram para Liberadas p/ contagem.' }
}

/** Exposto para testes unitários sem banco. */
export const contagemCegaInterno = {
  resolverItensPorEmbalagem,
  resolverBipNaSessao,
  converterIncrementoBipParaCompra,
  formatarDescricaoEmbalagem,
  compararItens,
  arredondarQtd,
  extrairSerieNumeroChave,
  montarSnapshotItens,
}

export const servicoContagens = {
  listarDisponiveis,
  criar,
  obterDetalhe,
  bipar,
  atualizarQtdManual,
  gravar,
  finalizar,
  cancelar,
}
