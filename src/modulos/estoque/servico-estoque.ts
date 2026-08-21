/**
 * Serviço único de escrita do estoque + consultas do Kardex.
 * Regra de ouro: saldo só muda via registrarMovimentoEstoque (append-only).
 */
import { randomUUID } from 'node:crypto'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { repositorioDeEstoque } from './repositorio-estoque.js'
import {
  aplicarDeltaNaDimensao,
  arredondarQtd,
  calcularQtdDisponivel,
  decimalParaNumero,
  deltaDisponivelDoMovimento,
  DIMENSOES_VISAO_DISPONIVEL,
  dimensaoEhValida,
  documentoPessoa,
  montarOcorrencia,
  nomeParceiro,
  rotuloTipoMovimento,
  saldosComDisponivel,
  tipoEstoqueVisaoEhValido,
  type DimensaoEstoque,
  type TipoEstoqueVisao,
} from './tipos-estoque.js'

export type EntradaRegistrarMovimento = {
  companyId: string
  produtoId: string
  dimensao: DimensaoEstoque
  tipoMovimento: string
  quantidade: number
  origem: string
  origemId?: string | null
  chaveIdempotencia: string
  observacao?: string | null
  usuarioId?: string | null
  pessoaId?: string | null
  precoCusto?: number | null
}

type ProdutoKardexRow = NonNullable<
  Awaited<ReturnType<typeof repositorioDeEstoque.buscarProdutoEstoque>>
>

function mapearFornecedores(produto: ProdutoKardexRow) {
  return (produto.fornecedores ?? []).map((f) => ({
    id: f.id,
    fornecedorPessoaId: f.fornecedorPessoaId,
    nome: f.fornecedor.nome,
    nomeFantasia: f.fornecedor.nomeFantasia,
    documento: documentoPessoa(f.fornecedor),
    codigoFornecedor: f.codigoFornecedor,
    unidadeEntrada: f.unidadeEntrada,
    multiploEntrada: f.multiploEntrada != null ? decimalParaNumero(f.multiploEntrada) : null,
    multiplicadorEntrada:
      f.multiplicadorEntrada != null ? decimalParaNumero(f.multiplicadorEntrada) : null,
    ordem: f.ordem,
  }))
}

function mapearProdutoKardex(produto: ProdutoKardexRow) {
  return {
    id: produto.id,
    sku: produto.sku,
    nomeVenda: produto.nomeVenda,
    nomeCompra: produto.nomeCompra,
    marca: produto.marca,
    unidade: produto.unidade,
    codigoBarras: produto.codigoBarras,
    ncm: produto.ncm,
    codigoOrigem: produto.codigoOrigem,
    multiploVenda: decimalParaNumero(produto.multiploVenda),
    precoCusto:
      produto.precoCusto != null ? decimalParaNumero(produto.precoCusto) : null,
    controlaEstoque: produto.controlaEstoque,
    permiteEstoqueNegativo: produto.permiteEstoqueNegativo,
    bloqueadoVenda: produto.bloqueadoVenda,
    ativo: produto.ativo,
  }
}

function mapearMovimento(row: {
  id: string
  dimensao: string
  tipoMovimento: string
  quantidade: unknown
  saldoDepois: unknown
  precoCusto?: unknown
  origem: string
  origemId: string | null
  chaveIdempotencia: string
  observacao: string | null
  usuarioId: string | null
  pessoaId?: string | null
  createdAt: Date
}) {
  return {
    id: row.id,
    dimensao: row.dimensao,
    tipoMovimento: row.tipoMovimento,
    tipoRotulo: rotuloTipoMovimento(row.tipoMovimento),
    quantidade: decimalParaNumero(row.quantidade),
    saldoDepois: decimalParaNumero(row.saldoDepois),
    precoCusto:
      row.precoCusto != null ? decimalParaNumero(row.precoCusto) : null,
    origem: row.origem,
    origemId: row.origemId,
    chaveIdempotencia: row.chaveIdempotencia,
    observacao: row.observacao,
    usuarioId: row.usuarioId,
    pessoaId: row.pessoaId ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

async function registrarMovimentoEstoque(entrada: EntradaRegistrarMovimento) {
  if (!dimensaoEhValida(entrada.dimensao)) {
    throw new ErroDaAplicacao('Dimensão de estoque inválida', 400)
  }
  if (!entrada.tipoMovimento?.trim()) {
    throw new ErroDaAplicacao('tipoMovimento é obrigatório', 400)
  }
  if (!entrada.origem?.trim()) {
    throw new ErroDaAplicacao('origem é obrigatória', 400)
  }
  if (!entrada.chaveIdempotencia?.trim()) {
    throw new ErroDaAplicacao('chaveIdempotencia é obrigatória', 400)
  }

  const quantidade = arredondarQtd(Number(entrada.quantidade))
  if (!Number.isFinite(quantidade) || quantidade === 0) {
    throw new ErroDaAplicacao('quantidade deve ser um número diferente de zero', 400)
  }

  const produto = await repositorioDeEstoque.buscarProdutoEstoque(
    entrada.companyId,
    entrada.produtoId
  )
  if (!produto) {
    throw new ErroDaAplicacao('Produto não encontrado', 404)
  }
  if (!produto.controlaEstoque) {
    throw new ErroDaAplicacao('Produto não controla estoque', 400)
  }

  const existente = await repositorioDeEstoque.buscarMovimentoPorChave(
    entrada.companyId,
    entrada.chaveIdempotencia
  )
  if (existente) {
    const saldo = await repositorioDeEstoque.buscarSaldo(
      entrada.companyId,
      entrada.produtoId
    )
    return {
      idempotente: true as const,
      movimento: mapearMovimento(existente),
      saldos: saldosComDisponivel(
        saldo
          ? repositorioDeEstoque.mapearSaldos(saldo)
          : { qtdFisica: 0, qtdReservada: 0, qtdBloqueada: 0, qtdFiscal: 0 }
      ),
    }
  }

  return repositorioDeEstoque.clientePrisma.$transaction(async (tx) => {
    const deNovo = await repositorioDeEstoque.buscarMovimentoPorChave(
      entrada.companyId,
      entrada.chaveIdempotencia,
      tx
    )
    if (deNovo) {
      const saldoAtual = await repositorioDeEstoque.obterOuCriarSaldo(
        entrada.companyId,
        entrada.produtoId,
        tx
      )
      return {
        idempotente: true as const,
        movimento: mapearMovimento(deNovo),
        saldos: saldosComDisponivel(repositorioDeEstoque.mapearSaldos(saldoAtual)),
      }
    }

    const saldoRow = await repositorioDeEstoque.obterOuCriarSaldo(
      entrada.companyId,
      entrada.produtoId,
      tx
    )
    const saldosAntes = repositorioDeEstoque.mapearSaldos(saldoRow)
    const { saldosNovos, saldoDepois } = aplicarDeltaNaDimensao(
      saldosAntes,
      entrada.dimensao,
      quantidade
    )

    if (!produto.permiteEstoqueNegativo) {
      if (saldosNovos.qtdFisica < 0) {
        throw new ErroDaAplicacao(
          'Movimento deixaria o estoque físico negativo',
          400
        )
      }
      const disponivelNovo = calcularQtdDisponivel(saldosNovos)
      if (disponivelNovo < 0) {
        throw new ErroDaAplicacao(
          'Movimento deixaria o estoque disponível negativo',
          400
        )
      }
      if (saldosNovos.qtdReservada < 0 || saldosNovos.qtdBloqueada < 0) {
        throw new ErroDaAplicacao(
          'Movimento deixaria reserva/bloqueio negativo',
          400
        )
      }
    }

    const movimento = await repositorioDeEstoque.criarMovimento(tx, {
      companyId: entrada.companyId,
      produtoId: entrada.produtoId,
      dimensao: entrada.dimensao,
      tipoMovimento: entrada.tipoMovimento.trim(),
      quantidade,
      saldoDepois,
      origem: entrada.origem.trim(),
      origemId: entrada.origemId,
      chaveIdempotencia: entrada.chaveIdempotencia.trim(),
      observacao: entrada.observacao,
      usuarioId: entrada.usuarioId,
      pessoaId: entrada.pessoaId,
      precoCusto: entrada.precoCusto ?? null,
    })

    const saldoAtualizado = await repositorioDeEstoque.atualizarSaldo(
      tx,
      saldoRow.id,
      saldosNovos
    )

    return {
      idempotente: false as const,
      movimento: mapearMovimento(movimento),
      saldos: saldosComDisponivel(repositorioDeEstoque.mapearSaldos(saldoAtualizado)),
    }
  })
}

export type ItemBloqueioAtivoProduto = {
  nfeRecebidaId: string
  chaveNfe: string
  nomeEmitente: string | null
  quantidade: number
  motivo: string
  bloqueadoEm: string
}

export type BloqueioAtivoProduto = {
  qtdBloqueada: number
  itens: ItemBloqueioAtivoProduto[]
}

const PREFIXO_OBS_BLOQUEIO = 'Bloqueio por divergência na contagem — '

function motivoDeObservacaoBloqueio(observacao: string | null | undefined): string | null {
  const obs = observacao?.trim()
  if (!obs) return null
  if (obs.startsWith(PREFIXO_OBS_BLOQUEIO)) {
    const resto = obs.slice(PREFIXO_OBS_BLOQUEIO.length).trim()
    return resto || obs
  }
  return obs
}

/** Extrai o itemId da chave `nfe:{notaId}:item:{itemId}:bloqueio`. */
function extrairItemIdChaveBloqueio(chaveIdempotencia: string): string | null {
  const m = /^nfe:[^:]+:item:([^:]+):bloqueio$/.exec(chaveIdempotencia.trim())
  return m?.[1] ?? null
}

/**
 * Desfaz os movimentos de bloqueio reais da nota (quantidade espelhada).
 * Se já houver desbloqueio parcial (chave idempotente), lança só o residual.
 */
async function desbloquearMovimentosDivergenciaNota(entrada: {
  companyId: string
  notaId: string
  usuarioId: string
  observacao: string
}): Promise<{ movimentos: number }> {
  const movimentos = await repositorioDeEstoque.listarMovimentosPorOrigem(
    entrada.companyId,
    'nfe_divergencia',
    entrada.notaId
  )
  const bloqueios = movimentos.filter(
    (m) => m.dimensao === 'bloqueio' && m.tipoMovimento === 'bloqueio'
  )
  if (bloqueios.length === 0) {
    throw new ErroDaAplicacao(
      'Não há estoque bloqueado nesta nota para desbloquear.',
      409
    )
  }

  const desbloqueiosPorItem = new Map<string, number>()
  for (const mov of movimentos) {
    if (mov.dimensao !== 'bloqueio' || mov.tipoMovimento !== 'desbloqueio') continue
    const itemId =
      extrairItemIdChaveDesbloqueio(mov.chaveIdempotencia) ?? mov.produtoId
    const qtd = Math.abs(arredondarQtd(decimalParaNumero(mov.quantidade)))
    desbloqueiosPorItem.set(
      itemId,
      arredondarQtd((desbloqueiosPorItem.get(itemId) ?? 0) + qtd)
    )
  }

  let gravados = 0
  for (const mov of bloqueios) {
    const qtdBloqueio = Math.abs(arredondarQtd(decimalParaNumero(mov.quantidade)))
    if (qtdBloqueio <= 0) continue
    const itemId = extrairItemIdChaveBloqueio(mov.chaveIdempotencia) ?? mov.produtoId
    const jaLiberado = desbloqueiosPorItem.get(itemId) ?? 0
    const residual = arredondarQtd(qtdBloqueio - jaLiberado)
    if (residual <= 0) continue

    const chaveIdempotencia =
      jaLiberado > 0
        ? `nfe:${entrada.notaId}:item:${itemId}:desbloqueio:resto`
        : `nfe:${entrada.notaId}:item:${itemId}:desbloqueio`

    await registrarMovimentoEstoque({
      companyId: entrada.companyId,
      produtoId: mov.produtoId,
      dimensao: 'bloqueio',
      tipoMovimento: 'desbloqueio',
      quantidade: -residual,
      origem: 'nfe_divergencia',
      origemId: entrada.notaId,
      chaveIdempotencia,
      observacao: entrada.observacao,
      usuarioId: entrada.usuarioId,
    })
    desbloqueiosPorItem.set(itemId, arredondarQtd(jaLiberado + residual))
    gravados += 1
  }

  if (gravados === 0) {
    throw new ErroDaAplicacao('Estoque já foi desbloqueado.', 409)
  }
  return { movimentos: gravados }
}

/** Extrai itemId de `nfe:{notaId}:item:{itemId}:desbloqueio` ou `...:desbloqueio:resto`. */
function extrairItemIdChaveDesbloqueio(chaveIdempotencia: string): string | null {
  const m = /^nfe:[^:]+:item:([^:]+):desbloqueio(?::resto)?$/.exec(
    chaveIdempotencia.trim()
  )
  return m?.[1] ?? null
}

/** Bloqueios ainda ativos do produto (qtdBloqueada > 0) — para aviso no Kardex. */
async function montarBloqueioAtivoProduto(
  companyId: string,
  produtoId: string,
  qtdBloqueada: number
): Promise<BloqueioAtivoProduto | null> {
  if (qtdBloqueada <= 0) return null

  const movimentos = await repositorioDeEstoque.listarMovimentosBloqueioPorProduto(
    companyId,
    produtoId
  )
  type Acc = {
    origemId: string
    quantidade: number
    bloqueadoEm: Date | null
    desbloqueadoEm: Date | null
    observacao: string | null
  }
  const mapa = new Map<string, Acc>()

  for (const mov of movimentos) {
    if (!mov.origemId) continue
    let acc = mapa.get(mov.origemId)
    if (!acc) {
      acc = {
        origemId: mov.origemId,
        quantidade: 0,
        bloqueadoEm: null,
        desbloqueadoEm: null,
        observacao: null,
      }
      mapa.set(mov.origemId, acc)
    }
    const qtdAbs = Math.abs(arredondarQtd(decimalParaNumero(mov.quantidade)))
    if (mov.tipoMovimento === 'bloqueio') {
      acc.quantidade = arredondarQtd(acc.quantidade + qtdAbs)
      if (!acc.bloqueadoEm || mov.createdAt < acc.bloqueadoEm) {
        acc.bloqueadoEm = mov.createdAt
      }
      if (mov.observacao?.trim()) acc.observacao = mov.observacao.trim()
    } else if (mov.tipoMovimento === 'desbloqueio') {
      acc.quantidade = arredondarQtd(acc.quantidade - qtdAbs)
      if (!acc.desbloqueadoEm || mov.createdAt > acc.desbloqueadoEm) {
        acc.desbloqueadoEm = mov.createdAt
      }
    }
  }

  // Quantidade líquida > 0 = ainda retido (desbloqueio parcial ou falho não zera).
  const ativos = [...mapa.values()].filter((a) => a.quantidade > 0)
  if (ativos.length === 0) {
    return {
      qtdBloqueada: arredondarQtd(qtdBloqueada),
      itens: [],
    }
  }

  const ids = ativos.map((a) => a.origemId)
  const notas = await repositorioDeEstoque.clientePrisma.nfeRecebida.findMany({
    where: { companyId, id: { in: ids } },
    select: {
      id: true,
      chaveNfe: true,
      nomeEmitente: true,
      analiseJson: true,
    },
  })
  const mapaNota = new Map(notas.map((n) => [n.id, n]))

  const itens: ItemBloqueioAtivoProduto[] = ativos.map((a) => {
    const nota = mapaNota.get(a.origemId)
    const gestao = (nota?.analiseJson as {
      divergenciaGestao?: { bloqueioExplicacao?: string }
    } | null)?.divergenciaGestao
    const motivo =
      gestao?.bloqueioExplicacao?.trim() ||
      motivoDeObservacaoBloqueio(a.observacao) ||
      'Bloqueio por divergência na contagem.'
    return {
      nfeRecebidaId: a.origemId,
      chaveNfe: nota?.chaveNfe ?? '—',
      nomeEmitente: nota?.nomeEmitente ?? null,
      quantidade: a.quantidade,
      motivo,
      bloqueadoEm: a.bloqueadoEm?.toISOString() ?? new Date().toISOString(),
    }
  })

  itens.sort((x, y) => y.bloqueadoEm.localeCompare(x.bloqueadoEm))

  return {
    qtdBloqueada: arredondarQtd(qtdBloqueada),
    itens,
  }
}

async function obterSaldosAtuais(companyId: string, produtoId: string) {
  const produto = await repositorioDeEstoque.buscarProdutoEstoque(companyId, produtoId)
  if (!produto) throw new ErroDaAplicacao('Produto não encontrado', 404)

  const produtoDto = mapearProdutoKardex(produto)
  const fornecedores = mapearFornecedores(produto)

  if (!produto.controlaEstoque) {
    return {
      produto: produtoDto,
      fornecedores,
      saldos: saldosComDisponivel({
        qtdFisica: 0,
        qtdReservada: 0,
        qtdBloqueada: 0,
        qtdFiscal: 0,
      }),
      bloqueioAtivo: null as BloqueioAtivoProduto | null,
    }
  }

  let saldo = await repositorioDeEstoque.buscarSaldo(companyId, produtoId)
  if (!saldo) {
    saldo = await repositorioDeEstoque.garantirSaldoZero(companyId, produtoId)
  }

  const saldos = saldosComDisponivel(repositorioDeEstoque.mapearSaldos(saldo))
  const bloqueioAtivo = await montarBloqueioAtivoProduto(
    companyId,
    produtoId,
    saldos.qtdBloqueada
  )

  return {
    produto: produtoDto,
    fornecedores,
    saldos,
    bloqueioAtivo,
  }
}

async function resolverSaldoInicialDimensao(
  companyId: string,
  produtoId: string,
  antesDe: Date,
  dimensao: DimensaoEstoque
): Promise<number> {
  const ultimo = await repositorioDeEstoque.buscarUltimoMovimentoAntes({
    companyId,
    produtoId,
    antesDe,
    dimensao,
  })
  return ultimo ? decimalParaNumero(ultimo.saldoDepois) : 0
}

async function resolverSaldoInicialVisao(
  companyId: string,
  produtoId: string,
  antesDe: Date,
  tipoEstoque: TipoEstoqueVisao
): Promise<number> {
  if (tipoEstoque === 'fisico') {
    return resolverSaldoInicialDimensao(companyId, produtoId, antesDe, 'fisico')
  }
  if (tipoEstoque === 'fiscal') {
    return resolverSaldoInicialDimensao(companyId, produtoId, antesDe, 'fiscal')
  }
  const fisica = await resolverSaldoInicialDimensao(companyId, produtoId, antesDe, 'fisico')
  const reservada = await resolverSaldoInicialDimensao(
    companyId,
    produtoId,
    antesDe,
    'reserva'
  )
  const bloqueada = await resolverSaldoInicialDimensao(
    companyId,
    produtoId,
    antesDe,
    'bloqueio'
  )
  return calcularQtdDisponivel({
    qtdFisica: fisica,
    qtdReservada: reservada,
    qtdBloqueada: bloqueada,
  })
}

function dimensoesDaVisao(tipoEstoque: TipoEstoqueVisao): DimensaoEstoque[] {
  if (tipoEstoque === 'fisico') return ['fisico']
  if (tipoEstoque === 'fiscal') return ['fiscal']
  return DIMENSOES_VISAO_DISPONIVEL
}

async function obterKardex(dados: {
  companyId: string
  produtoId: string
  de: Date
  ate: Date
  tipoEstoque: TipoEstoqueVisao
}) {
  if (!tipoEstoqueVisaoEhValido(dados.tipoEstoque)) {
    throw new ErroDaAplicacao(
      'tipoEstoque inválido (disponivel|fisico|fiscal)',
      400
    )
  }
  if (dados.de > dados.ate) {
    throw new ErroDaAplicacao('Período inválido: De deve ser ≤ Até', 400)
  }

  const atuais = await obterSaldosAtuais(dados.companyId, dados.produtoId)
  const dimensoes = dimensoesDaVisao(dados.tipoEstoque)
  const saldoInicial = await resolverSaldoInicialVisao(
    dados.companyId,
    dados.produtoId,
    dados.de,
    dados.tipoEstoque
  )

  const movimentos = await repositorioDeEstoque.listarMovimentosPeriodo({
    companyId: dados.companyId,
    produtoId: dados.produtoId,
    de: dados.de,
    ate: dados.ate,
    dimensoes,
  })

  let saldoCorrente = saldoInicial
  let totalEntrada = 0
  let totalSaida = 0
  const agregacao = new Map<
    string,
    { tipoMovimento: string; tipoRotulo: string; entradas: number; saidas: number; saldo: number }
  >()

  const unidade = atuais.produto.unidade

  const linhas = movimentos.map((mov) => {
    const quantidade = decimalParaNumero(mov.quantidade)
    const dimensao = mov.dimensao as DimensaoEstoque

    let saldoLinha: number
    if (dados.tipoEstoque === 'disponivel') {
      saldoCorrente = arredondarQtd(
        saldoCorrente + deltaDisponivelDoMovimento(dimensao, quantidade)
      )
      saldoLinha = saldoCorrente
    } else {
      saldoLinha = decimalParaNumero(mov.saldoDepois)
      saldoCorrente = saldoLinha
    }

    const qtdEntrada = quantidade > 0 ? quantidade : 0
    const qtdSaida = quantidade < 0 ? Math.abs(quantidade) : 0
    totalEntrada = arredondarQtd(totalEntrada + qtdEntrada)
    totalSaida = arredondarQtd(totalSaida + qtdSaida)

    const chaveTipo = mov.tipoMovimento
    const agg = agregacao.get(chaveTipo) ?? {
      tipoMovimento: mov.tipoMovimento,
      tipoRotulo: rotuloTipoMovimento(mov.tipoMovimento),
      entradas: 0,
      saidas: 0,
      saldo: 0,
    }
    agg.entradas = arredondarQtd(agg.entradas + qtdEntrada)
    agg.saidas = arredondarQtd(agg.saidas + qtdSaida)
    agg.saldo = arredondarQtd(agg.entradas - agg.saidas)
    agregacao.set(chaveTipo, agg)

    const parceiroNome = mov.pessoa ? nomeParceiro(mov.pessoa) : null
    const parceiroDocumento = mov.pessoa ? documentoPessoa(mov.pessoa) : null

    return {
      id: mov.id,
      data: mov.createdAt.toISOString(),
      tipo: rotuloTipoMovimento(mov.tipoMovimento),
      tipoMovimento: mov.tipoMovimento,
      movimento: mov.id.slice(0, 8).toUpperCase(),
      ocorrencia: montarOcorrencia({
        tipoMovimento: mov.tipoMovimento,
        dimensao: mov.dimensao,
        origem: mov.origem,
      }),
      parceiroNome,
      parceiroDocumento,
      motivo: mov.observacao?.trim() || null,
      qtdEntrada: qtdEntrada || null,
      qtdSaida: qtdSaida || null,
      saldo: saldoLinha,
      precoCusto:
        mov.precoCusto != null ? decimalParaNumero(mov.precoCusto) : null,
      unidade,
      dimensao: mov.dimensao,
      origem: mov.origem,
      origemId: mov.origemId,
      observacao: mov.observacao,
      usuarioId: mov.usuarioId,
      usuarioNome: mov.usuario?.name ?? null,
      pessoaId: mov.pessoaId,
    }
  })

  const saldoFinal =
    linhas.length > 0 ? linhas[linhas.length - 1]!.saldo : saldoInicial

  return {
    produto: atuais.produto,
    fornecedores: atuais.fornecedores,
    tipoEstoque: dados.tipoEstoque,
    periodo: { de: dados.de.toISOString(), ate: dados.ate.toISOString() },
    saldos: atuais.saldos,
    bloqueioAtivo: atuais.bloqueioAtivo,
    saldoInicial,
    saldoFinal,
    totais: { entrada: totalEntrada, saida: totalSaida },
    linhas,
    resumoPorTipo: [
      {
        tipoMovimento: '__saldo_inicial',
        tipoRotulo: 'Saldo inicial',
        entradas: 0,
        saidas: 0,
        saldo: saldoInicial,
      },
      ...[...agregacao.values()],
      {
        tipoMovimento: '__saldo_final',
        tipoRotulo: 'Saldo final',
        entradas: totalEntrada,
        saidas: totalSaida,
        saldo: saldoFinal,
      },
    ],
  }
}

async function listarResumo(companyId: string, q?: string, limite?: number) {
  const produtos = await repositorioDeEstoque.listarSaldosComProduto({
    companyId,
    q,
    limite,
  })

  const itens = []
  for (const p of produtos) {
    let saldo = p.estoqueSaldo
    if (!saldo) {
      saldo = await repositorioDeEstoque.garantirSaldoZero(companyId, p.id)
    }
    const saldos = saldosComDisponivel(repositorioDeEstoque.mapearSaldos(saldo))
    itens.push({
      produtoId: p.id,
      sku: p.sku,
      nomeVenda: p.nomeVenda,
      unidade: p.unidade,
      marca: p.marca,
      ativo: p.ativo,
      ...saldos,
    })
  }

  return { itens }
}

async function ajusteInventario(dados: {
  companyId: string
  produtoId: string
  usuarioId: string
  observacao: string
  quantidadeNova?: number
  delta?: number
  fornecedorPessoaId?: string | null
  /** Se `undefined`, usa snapshot do produto; se `null` ou número, grava esse valor. */
  precoCusto?: number | null
}) {
  const observacao = dados.observacao?.trim()
  if (!observacao) {
    throw new ErroDaAplicacao('Observação é obrigatória no ajuste de inventário', 400)
  }

  const atuais = await obterSaldosAtuais(dados.companyId, dados.produtoId)
  if (!atuais.produto.controlaEstoque) {
    throw new ErroDaAplicacao('Produto não controla estoque', 400)
  }

  let pessoaId: string | null = null
  if (dados.fornecedorPessoaId?.trim()) {
    const vinculo = await repositorioDeEstoque.fornecedorVinculadoAoProduto(
      dados.produtoId,
      dados.fornecedorPessoaId.trim(),
      dados.companyId
    )
    if (!vinculo) {
      throw new ErroDaAplicacao(
        'Fornecedor não está vinculado a este produto',
        400
      )
    }
    pessoaId = dados.fornecedorPessoaId.trim()
  }

  const fisicoAtual = atuais.saldos.qtdFisica
  let delta: number

  if (dados.quantidadeNova != null && Number.isFinite(Number(dados.quantidadeNova))) {
    delta = arredondarQtd(Number(dados.quantidadeNova) - fisicoAtual)
  } else if (dados.delta != null && Number.isFinite(Number(dados.delta))) {
    delta = arredondarQtd(Number(dados.delta))
  } else {
    throw new ErroDaAplicacao(
      'Informe quantidadeNova ou delta para o ajuste de inventário',
      400
    )
  }

  if (delta === 0) {
    throw new ErroDaAplicacao('Ajuste sem alteração de quantidade', 400)
  }

  const chaveIdempotencia = `inventario:${randomUUID()}`
  const precoCusto =
    dados.precoCusto !== undefined ? dados.precoCusto : atuais.produto.precoCusto

  if (precoCusto != null && (!Number.isFinite(precoCusto) || precoCusto < 0)) {
    throw new ErroDaAplicacao('precoCusto inválido', 400)
  }

  const resultado = await registrarMovimentoEstoque({
    companyId: dados.companyId,
    produtoId: dados.produtoId,
    dimensao: 'fisico',
    tipoMovimento: 'inventario',
    quantidade: delta,
    origem: 'inventario',
    origemId: null,
    chaveIdempotencia,
    observacao,
    usuarioId: dados.usuarioId,
    pessoaId,
    precoCusto,
  })

  return {
    ...resultado,
    fiscalInalterado: resultado.saldos.qtdFiscal === atuais.saldos.qtdFiscal,
    fisicoAnterior: fisicoAtual,
    delta,
    precoCustoGravado: precoCusto,
    avisoSemCusto: precoCusto == null,
  }
}

export type LinhaEntradaNotaFiscal = {
  itemId: string
  produtoId: string
  quantidadeEstoque: number
  precoCusto: number | null
  nomeVenda?: string | null
}

export type ResultadoEntradaNotaFiscal = {
  movimentou: boolean
  itensProcessados: number
  itensIgnorados: number
  movimentosGravados: number
  produtos: Array<{ produtoId: string; nomeVenda: string; quantidade: number }>
}

/**
 * Lança estoque físico + fiscal a partir da consolidação de uma NFe.
 * Idempotente por item/dimensão (chaves nfe:{notaId}:item:{itemId}:{dim}).
 */
async function aplicarEntradaNotaFiscal(dados: {
  companyId: string
  notaId: string
  usuarioId: string
  pessoaId?: string | null
  linhas: LinhaEntradaNotaFiscal[]
}): Promise<ResultadoEntradaNotaFiscal> {
  let itensProcessados = 0
  let itensIgnorados = 0
  let movimentosGravados = 0
  const produtosMap = new Map<string, { produtoId: string; nomeVenda: string; quantidade: number }>()

  for (const linha of dados.linhas) {
    const produto = await repositorioDeEstoque.buscarProdutoEstoque(
      dados.companyId,
      linha.produtoId
    )
    if (!produto || !produto.controlaEstoque) {
      itensIgnorados += 1
      continue
    }

    const quantidade = arredondarQtd(Number(linha.quantidadeEstoque))
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      throw new ErroDaAplicacao(
        `Quantidade inválida para entrada de estoque do item ${linha.itemId}`,
        400
      )
    }

    const precoCusto = linha.precoCusto
    if (precoCusto != null && (!Number.isFinite(precoCusto) || precoCusto < 0)) {
      throw new ErroDaAplicacao(
        `precoCusto inválido para entrada de estoque do item ${linha.itemId}`,
        400
      )
    }

    const base = {
      companyId: dados.companyId,
      produtoId: linha.produtoId,
      tipoMovimento: 'entrada_nf',
      quantidade,
      origem: 'nfe',
      origemId: dados.notaId,
      observacao: null as string | null,
      usuarioId: dados.usuarioId,
      pessoaId: dados.pessoaId ?? null,
      precoCusto,
    }

    const fisico = await registrarMovimentoEstoque({
      ...base,
      dimensao: 'fisico',
      chaveIdempotencia: `nfe:${dados.notaId}:item:${linha.itemId}:fisico`,
    })
    const fiscal = await registrarMovimentoEstoque({
      ...base,
      dimensao: 'fiscal',
      chaveIdempotencia: `nfe:${dados.notaId}:item:${linha.itemId}:fiscal`,
    })

    if (!fisico.idempotente) movimentosGravados += 1
    if (!fiscal.idempotente) movimentosGravados += 1
    itensProcessados += 1

    const nomeVenda = (linha.nomeVenda ?? produto.nomeVenda ?? '').trim() || produto.nomeVenda
    const existente = produtosMap.get(linha.produtoId)
    if (existente) {
      existente.quantidade = arredondarQtd(existente.quantidade + quantidade)
    } else {
      produtosMap.set(linha.produtoId, {
        produtoId: linha.produtoId,
        nomeVenda,
        quantidade,
      })
    }
  }

  return {
    movimentou: itensProcessados > 0,
    itensProcessados,
    itensIgnorados,
    movimentosGravados,
    produtos: [...produtosMap.values()],
  }
}

async function existeMovimentoOrigemNfe(companyId: string, notaId: string): Promise<boolean> {
  return repositorioDeEstoque.existeMovimentoPorOrigem(companyId, 'nfe', notaId)
}

/**
 * Resume movimentos de entrada NF já gravados (para reabrir detalhe consolidado).
 * Agrega por produto usando a dimensão físico (quantidade de estoque).
 */
async function obterResumoEntradaNotaFiscal(
  companyId: string,
  notaId: string
): Promise<ResultadoEntradaNotaFiscal> {
  const movimentos = await repositorioDeEstoque.listarMovimentosPorOrigem(
    companyId,
    'nfe',
    notaId
  )
  if (movimentos.length === 0) {
    return {
      movimentou: false,
      itensProcessados: 0,
      itensIgnorados: 0,
      movimentosGravados: 0,
      produtos: [],
    }
  }

  const produtosMap = new Map<string, { produtoId: string; nomeVenda: string; quantidade: number }>()
  let movimentosFisicos = 0

  for (const mov of movimentos) {
    if (mov.dimensao !== 'fisico') continue
    movimentosFisicos += 1
    const qtd = arredondarQtd(decimalParaNumero(mov.quantidade))
    const existente = produtosMap.get(mov.produtoId)
    if (existente) {
      existente.quantidade = arredondarQtd(existente.quantidade + qtd)
    } else {
      produtosMap.set(mov.produtoId, {
        produtoId: mov.produtoId,
        nomeVenda: mov.produto?.nomeVenda?.trim() || mov.produtoId,
        quantidade: qtd,
      })
    }
  }

  const produtos = [...produtosMap.values()]
  return {
    movimentou: produtos.length > 0,
    itensProcessados: produtos.length,
    itensIgnorados: 0,
    movimentosGravados: movimentosFisicos,
    produtos,
  }
}

export type ItemBloqueadoDivergencia = {
  produtoId: string
  sku: string | null
  nomeVenda: string
  unidade: string | null
  quantidadeBloqueada: number
  status: 'bloqueado' | 'desbloqueado'
  bloqueadoEm: string | null
  desbloqueadoEm: string | null
}

/** Itens retidos por Bloquear estoque após divergência de contagem (§7.17). */
async function obterItensBloqueadosDivergencia(
  companyId: string,
  notaId: string,
  opts?: { desbloqueioEmNota?: string | null }
): Promise<{
  itens: ItemBloqueadoDivergencia[]
  totais: { itens: number; aindaBloqueados: number; desbloqueados: number }
}> {
  const movimentos = await repositorioDeEstoque.listarMovimentosPorOrigem(
    companyId,
    'nfe_divergencia',
    notaId
  )
  type Acc = {
    produtoId: string
    sku: string | null
    nomeVenda: string
    unidade: string | null
    quantidadeBloqueada: number
    quantidadeLiquida: number
    bloqueadoEm: Date | null
    desbloqueadoEm: Date | null
  }
  const mapa = new Map<string, Acc>()

  for (const mov of movimentos) {
    if (mov.dimensao !== 'bloqueio') continue
    const qtdAbs = Math.abs(arredondarQtd(decimalParaNumero(mov.quantidade)))
    let acc = mapa.get(mov.produtoId)
    if (!acc) {
      acc = {
        produtoId: mov.produtoId,
        sku: mov.produto?.sku?.trim() || null,
        nomeVenda: mov.produto?.nomeVenda?.trim() || mov.produtoId,
        unidade: mov.produto?.unidade?.trim() || null,
        quantidadeBloqueada: 0,
        quantidadeLiquida: 0,
        bloqueadoEm: null,
        desbloqueadoEm: null,
      }
      mapa.set(mov.produtoId, acc)
    }
    if (mov.tipoMovimento === 'bloqueio') {
      acc.quantidadeBloqueada = arredondarQtd(acc.quantidadeBloqueada + qtdAbs)
      acc.quantidadeLiquida = arredondarQtd(acc.quantidadeLiquida + qtdAbs)
      if (!acc.bloqueadoEm || mov.createdAt < acc.bloqueadoEm) {
        acc.bloqueadoEm = mov.createdAt
      }
    } else if (mov.tipoMovimento === 'desbloqueio') {
      acc.quantidadeLiquida = arredondarQtd(acc.quantidadeLiquida - qtdAbs)
      if (!acc.desbloqueadoEm || mov.createdAt > acc.desbloqueadoEm) {
        acc.desbloqueadoEm = mov.createdAt
      }
    }
  }

  const desbloqueioNotaIso = opts?.desbloqueioEmNota?.trim() || null

  const itens: ItemBloqueadoDivergencia[] = [...mapa.values()]
    .filter((a) => a.quantidadeBloqueada > 0)
    .map((a) => {
      const desbloqueadoEm =
        a.desbloqueadoEm?.toISOString() ?? desbloqueioNotaIso
      const liberado =
        Boolean(desbloqueadoEm) && a.quantidadeLiquida <= 0
      return {
        produtoId: a.produtoId,
        sku: a.sku,
        nomeVenda: a.nomeVenda,
        unidade: a.unidade,
        quantidadeBloqueada: a.quantidadeBloqueada,
        status: liberado ? ('desbloqueado' as const) : ('bloqueado' as const),
        bloqueadoEm: a.bloqueadoEm?.toISOString() ?? null,
        desbloqueadoEm: liberado ? desbloqueadoEm : a.desbloqueadoEm?.toISOString() ?? null,
      }
    })
    .sort((a, b) => a.nomeVenda.localeCompare(b.nomeVenda, 'pt-BR'))

  return {
    itens,
    totais: {
      itens: itens.length,
      aindaBloqueados: itens.filter((i) => i.status === 'bloqueado').length,
      desbloqueados: itens.filter((i) => i.status === 'desbloqueado').length,
    },
  }
}

export const servicoDeEstoque = {
  registrarMovimentoEstoque,
  obterSaldosAtuais,
  obterKardex,
  listarResumo,
  ajusteInventario,
  aplicarEntradaNotaFiscal,
  existeMovimentoOrigemNfe,
  obterResumoEntradaNotaFiscal,
  obterItensBloqueadosDivergencia,
  desbloquearMovimentosDivergenciaNota,
}

export const _testesEstoque = {
  aplicarDeltaNaDimensao,
  calcularQtdDisponivel,
  deltaDisponivelDoMovimento,
  arredondarQtd,
  saldosComDisponivel,
  montarOcorrencia,
}
