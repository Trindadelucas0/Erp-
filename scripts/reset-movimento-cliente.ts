/**
 * Zera o movimento do ERP e mantém cadastro, usuários e notas com
 * createdAt >= 2026-10-01T03:00:00.000Z (meia-noite de 01/10/2026 em Brasília),
 * mais o outro lado de NfeCteVinculo.
 *
 * Dry-run (padrão, só conta):
 *   npx tsx scripts/reset-movimento-cliente.ts
 *
 * Aplicar (exige dump existente com tamanho > 0):
 *   npx tsx scripts/reset-movimento-cliente.ts --aplicar <arquivo.dump>
 *
 * Não grava cursor da Focus. Não rebaixa ContaPagarCodigoSeq.
 */
import './carregar-url-do-banco.js'
import { PrismaClient, type Prisma } from '@prisma/client'
import { existsSync, statSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import path from 'node:path'

const CORTE = new Date('2026-10-01T03:00:00.000Z')
const LOTE = 400
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Db = Prisma.TransactionClient | PrismaClient

type Foto = {
  produto: number
  pessoa: number
  user: number
  cfop: number
  planoFinanceiro: number
  enderecoWms: number
  company: number
  recorrenciaFinanceira: number
  focus: { companyId: string; nfe: number; nfse: number; cte: number }[]
  seqPagar: { companyId: string; proximo: number }[]
}

type Plano = {
  notasMantidas: number
  notasRemovidas: number
  notasMantidasPorVinculo: number
  contasPagarMantidas: number
  contasPagarRemovidas: number
  contasReceber: number
  orcamentos: number
  vendas: number
  pedidosMantidos: number
  pedidosRemovidos: number
  movimentosMantidos: number
  movimentosRemovidos: number
  requisicoesMantidas: number
  requisicoesRemovidas: number
  contagensMantidas: number
  contagensRemovidas: number
  creditosRemovidos: number
  pendenciasMantidas: number
  jobs: number
  focusJobs: number
  zapsign: number
  logs: number
  arquivos: number
  idsNotasMantidas: string[]
  idsNotasPorVinculo: string[]
  idsNotasSaindo: string[]
  idsContasPagarSaindo: string[]
  idsPedidosMantidos: string[]
  idsPedidosSaindo: string[]
  idsCreditosSaindo: string[]
  idsRequisicoesSaindo: string[]
  idsMovimentosSaindo: string[]
  idsContagensSaindo: string[]
  pastas: string[]
  arquivosAbsolutos: string[]
  minMantida: string | null
  maxMantida: string | null
  minRemovida: string | null
  maxRemovida: string | null
}

const prisma = new PrismaClient()

function falhar(mensagem: string, codigo = 1): never {
  console.error(`[reset-movimento] ${mensagem}`)
  process.exit(codigo)
}

function lerArgs(argv: string[]) {
  let aplicar = false
  let dump: string | null = null
  let aceitarZero = false
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--aplicar') {
      aplicar = true
      const proximo = argv[i + 1]
      if (proximo && !proximo.startsWith('--')) {
        dump = proximo
        i += 1
      }
    } else if (arg.startsWith('--aplicar=')) {
      aplicar = true
      dump = arg.slice('--aplicar='.length)
    } else if (arg === '--aceitar-zero-notas') {
      aceitarZero = true
    } else {
      falhar(`argumento desconhecido: ${arg}`)
    }
  }
  return { aplicar, dump, aceitarZero }
}

function validarDump(caminho: string | null): string {
  if (!caminho) {
    falhar('ABORT: --aplicar exige o caminho de um dump existente')
  }
  const absoluto = path.resolve(caminho)
  if (!existsSync(absoluto)) {
    falhar('ABORT: arquivo de dump nao encontrado')
  }
  const stat = statSync(absoluto)
  if (!stat.isFile() || stat.size <= 0) {
    falhar('ABORT: dump vazio ou invalido')
  }
  console.log(`[reset-movimento] dump_bytes=${stat.size}`)
  return absoluto
}

function emPartes(ids: string[]): string[][] {
  const partes: string[][] = []
  for (let i = 0; i < ids.length; i += LOTE) partes.push(ids.slice(i, i + LOTE))
  return partes
}

async function apagarOnde(
  ids: string[],
  fn: (lote: string[]) => Promise<unknown>
): Promise<void> {
  for (const lote of emPartes(ids)) {
    if (lote.length > 0) await fn(lote)
  }
}

function extremo(datas: Date[], qual: 'min' | 'max'): string | null {
  if (datas.length === 0) return null
  const ordenadas = [...datas].sort((a, b) => a.getTime() - b.getTime())
  const escolhida = qual === 'min' ? ordenadas[0] : ordenadas[ordenadas.length - 1]
  return escolhida.toISOString()
}

function sobUploads(absoluto: string): boolean {
  const raiz = path.resolve(process.cwd(), 'uploads')
  const normalizado = path.resolve(absoluto)
  return normalizado === raiz || normalizado.startsWith(raiz + path.sep)
}

function pastaDeId(tipo: string, id: string): string | null {
  if (!UUID.test(id)) return null
  const pasta = path.resolve(process.cwd(), 'uploads', tipo, id)
  return sobUploads(pasta) ? pasta : null
}

function arquivoDanfe(companyId: string, notaId: string, relativo: string | null): string[] {
  const saida: string[] = []
  if (UUID.test(companyId) && UUID.test(notaId)) {
    const convencional = path.resolve(
      process.cwd(),
      'uploads',
      'nfe-recebidas',
      companyId,
      `${notaId}.pdf`
    )
    if (sobUploads(convencional)) saida.push(convencional)
  }
  if (!relativo) return saida
  const partes = relativo.replace(/\\/g, '/').split('/').filter((p) => p && p !== '.' && p !== '..')
  if (partes.length === 0 || partes[0] !== 'uploads') return saida
  const absoluto = path.resolve(process.cwd(), ...partes)
  if (sobUploads(absoluto)) saida.push(absoluto)
  return saida
}

async function fotografar(db: Db): Promise<Foto> {
  const [produto, pessoa, user, cfop, planoFinanceiro, enderecoWms, company, recorrenciaFinanceira, focus, seqPagar] =
    await Promise.all([
      db.produto.count(),
      db.pessoa.count(),
      db.user.count(),
      db.cfop.count(),
      db.planoFinanceiro.count(),
      db.enderecoWms.count(),
      db.company.count(),
      db.recorrenciaFinanceira.count(),
      db.configuracaoFocusNfe.findMany({
        select: {
          companyId: true,
          ultimaVersaoNfeRecebida: true,
          ultimaVersaoNfseRecebida: true,
          ultimaVersaoCteRecebida: true,
        },
        orderBy: { companyId: 'asc' },
      }),
      db.contaPagarCodigoSeq.findMany({
        select: { companyId: true, proximo: true },
        orderBy: { companyId: 'asc' },
      }),
    ])

  return {
    produto,
    pessoa,
    user,
    cfop,
    planoFinanceiro,
    enderecoWms,
    company,
    recorrenciaFinanceira,
    focus: focus.map((linha) => ({
      companyId: linha.companyId,
      nfe: linha.ultimaVersaoNfeRecebida,
      nfse: linha.ultimaVersaoNfseRecebida,
      cte: linha.ultimaVersaoCteRecebida,
    })),
    seqPagar,
  }
}

async function montarPlano(db: Db): Promise<Plano> {
  const notas = await db.nfeRecebida.findMany({
    select: {
      id: true,
      companyId: true,
      createdAt: true,
      danfeCaminho: true,
      pedidoCompraId: true,
    },
  })
  const vinculos = await db.nfeCteVinculo.findMany({
    select: { nfeRecebidaId: true, cteRecebidaId: true },
  })
  const idsExistentes = new Set(notas.map((nota) => nota.id))
  const mantidas = new Set(
    notas.filter((nota) => nota.createdAt.getTime() >= CORTE.getTime()).map((nota) => nota.id)
  )
  let mudou = true
  while (mudou) {
    mudou = false
    for (const vinculo of vinculos) {
      const nfeDentro = mantidas.has(vinculo.nfeRecebidaId)
      const cteDentro = mantidas.has(vinculo.cteRecebidaId)
      if (nfeDentro && !cteDentro && idsExistentes.has(vinculo.cteRecebidaId)) {
        mantidas.add(vinculo.cteRecebidaId)
        mudou = true
      }
      if (cteDentro && !nfeDentro && idsExistentes.has(vinculo.nfeRecebidaId)) {
        mantidas.add(vinculo.nfeRecebidaId)
        mudou = true
      }
    }
  }

  for (const vinculo of vinculos) {
    const nfeDentro = mantidas.has(vinculo.nfeRecebidaId)
    const cteDentro = mantidas.has(vinculo.cteRecebidaId)
    if (nfeDentro !== cteDentro) {
      throw new Error('Vinculo CT-e/NFe com um lado dentro e outro fora do conjunto mantido')
    }
  }

  const notasMantidas = notas.filter((nota) => mantidas.has(nota.id))
  const notasSaindo = notas.filter((nota) => !mantidas.has(nota.id))
  const idsPorVinculo = notasMantidas
    .filter((nota) => nota.createdAt.getTime() < CORTE.getTime())
    .map((nota) => nota.id)

  const pedidosMantidos = new Set(
    notasMantidas.map((nota) => nota.pedidoCompraId).filter((id): id is string => Boolean(id))
  )

  const [contasPagar, contasReceber, orcamentos, vendas, pedidos, creditos, reservas, movimentosCredito, pendencias, requisicoes, movimentos, contagens, notasContagem, jobs, focusJobs, zapsign, logs] =
    await Promise.all([
      db.contaPagar.findMany({ select: { id: true, nfeRecebidaId: true } }),
      db.contaReceber.count(),
      db.orcamento.count(),
      db.vendaCaixa.count(),
      db.pedidoCompra.findMany({ select: { id: true, creditoFornecedorId: true } }),
      db.creditoFornecedor.findMany({ select: { id: true } }),
      db.creditoReservaPedido.findMany({
        select: { creditoFornecedorId: true, pedidoCompraId: true },
      }),
      db.creditoFornecedorMovimento.findMany({
        select: { creditoFornecedorId: true, pedidoCompraId: true },
      }),
      db.pendenciaFornecedor.count(),
      db.requisicaoWms.findMany({ select: { id: true, nfeRecebidaId: true } }),
      db.estoqueMovimento.findMany({ select: { id: true, origem: true, origemId: true } }),
      db.contagemEntrada.findMany({ select: { id: true } }),
      db.contagemEntradaNota.findMany({
        select: { contagemEntradaId: true, nfeRecebidaId: true },
      }),
      db.job.count(),
      db.focusNfeJob.count(),
      db.zapsignDocumento.count(),
      db.logDeAuditoria.count(),
    ])

  const contasPagarSaindo = contasPagar.filter(
    (conta) => !conta.nfeRecebidaId || !mantidas.has(conta.nfeRecebidaId)
  )
  const pedidosSaindo = pedidos.filter((pedido) => !pedidosMantidos.has(pedido.id))
  const idsPedidosSaindo = new Set(pedidosSaindo.map((pedido) => pedido.id))

  const ligacoes = new Map<string, Set<string>>()
  function ligar(creditoId: string, pedidoId: string | null) {
    if (!pedidoId) return
    const atual = ligacoes.get(creditoId) ?? new Set<string>()
    atual.add(pedidoId)
    ligacoes.set(creditoId, atual)
  }
  for (const pedido of pedidos) {
    if (pedido.creditoFornecedorId) ligar(pedido.creditoFornecedorId, pedido.id)
  }
  for (const reserva of reservas) ligar(reserva.creditoFornecedorId, reserva.pedidoCompraId)
  for (const movimento of movimentosCredito) {
    ligar(movimento.creditoFornecedorId, movimento.pedidoCompraId)
  }

  const creditosSaindo = creditos.filter((credito) => {
    const pedidosDoCredito = ligacoes.get(credito.id)
    if (!pedidosDoCredito || pedidosDoCredito.size === 0) return false
    for (const pedidoId of pedidosDoCredito) {
      if (pedidosMantidos.has(pedidoId)) return false
    }
    return true
  })

  const requisicoesSaindo = requisicoes.filter(
    (requisicao) => !requisicao.nfeRecebidaId || !mantidas.has(requisicao.nfeRecebidaId)
  )
  const movimentosSaindo = movimentos.filter((movimento) => {
    const origemNota =
      (movimento.origem === 'nfe' || movimento.origem === 'nfe_divergencia') &&
      Boolean(movimento.origemId) &&
      mantidas.has(movimento.origemId as string)
    return !origemNota
  })

  const contagensComNotaMantida = new Set(
    notasContagem
      .filter((nota) => mantidas.has(nota.nfeRecebidaId))
      .map((nota) => nota.contagemEntradaId)
  )
  const contagensSaindo = contagens.filter((contagem) => !contagensComNotaMantida.has(contagem.id))

  const pastas = new Set<string>()
  const arquivos = new Set<string>()
  for (const nota of notasSaindo) {
    const pasta = pastaDeId('entrada-notas', nota.id)
    if (pasta) pastas.add(pasta)
    for (const arquivo of arquivoDanfe(nota.companyId, nota.id, nota.danfeCaminho)) {
      arquivos.add(arquivo)
    }
  }
  for (const conta of contasPagarSaindo) {
    const pasta = pastaDeId('contas-a-pagar', conta.id)
    if (pasta) pastas.add(pasta)
  }
  const receberIds = await db.contaReceber.findMany({ select: { id: true } })
  for (const conta of receberIds) {
    const pasta = pastaDeId('contas-a-receber', conta.id)
    if (pasta) pastas.add(pasta)
  }
  for (const pedido of pedidosSaindo) {
    const pasta = pastaDeId('portal-fornecedor', pedido.id)
    if (pasta) pastas.add(pasta)
  }

  return {
    notasMantidas: notasMantidas.length,
    notasRemovidas: notasSaindo.length,
    notasMantidasPorVinculo: idsPorVinculo.length,
    contasPagarMantidas: contasPagar.length - contasPagarSaindo.length,
    contasPagarRemovidas: contasPagarSaindo.length,
    contasReceber,
    orcamentos,
    vendas,
    pedidosMantidos: pedidos.filter((pedido) => pedidosMantidos.has(pedido.id)).length,
    pedidosRemovidos: pedidosSaindo.length,
    movimentosMantidos: movimentos.length - movimentosSaindo.length,
    movimentosRemovidos: movimentosSaindo.length,
    requisicoesMantidas: requisicoes.length - requisicoesSaindo.length,
    requisicoesRemovidas: requisicoesSaindo.length,
    contagensMantidas: contagens.length - contagensSaindo.length,
    contagensRemovidas: contagensSaindo.length,
    creditosRemovidos: creditosSaindo.length,
    pendenciasMantidas: pendencias,
    jobs,
    focusJobs,
    zapsign,
    logs,
    arquivos: pastas.size + arquivos.size,
    idsNotasMantidas: [...mantidas],
    idsNotasPorVinculo: idsPorVinculo,
    idsNotasSaindo: notasSaindo.map((nota) => nota.id),
    idsContasPagarSaindo: contasPagarSaindo.map((conta) => conta.id),
    idsPedidosMantidos: [...pedidosMantidos],
    idsPedidosSaindo: [...idsPedidosSaindo],
    idsCreditosSaindo: creditosSaindo.map((credito) => credito.id),
    idsRequisicoesSaindo: requisicoesSaindo.map((requisicao) => requisicao.id),
    idsMovimentosSaindo: movimentosSaindo.map((movimento) => movimento.id),
    idsContagensSaindo: contagensSaindo.map((contagem) => contagem.id),
    pastas: [...pastas],
    arquivosAbsolutos: [...arquivos],
    minMantida: extremo(
      notasMantidas.map((nota) => nota.createdAt),
      'min'
    ),
    maxMantida: extremo(
      notasMantidas.map((nota) => nota.createdAt),
      'max'
    ),
    minRemovida: extremo(
      notasSaindo.map((nota) => nota.createdAt),
      'min'
    ),
    maxRemovida: extremo(
      notasSaindo.map((nota) => nota.createdAt),
      'max'
    ),
  }
}

function resumoPublico(plano: Plano, foto: Foto, modo: string) {
  return {
    modo,
    corte: CORTE.toISOString(),
    host: process.env.DB_HOST ?? null,
    banco: process.env.DB_NAME ?? null,
    notasMantidas: plano.notasMantidas,
    notasRemovidas: plano.notasRemovidas,
    notasMantidasPorVinculo: plano.notasMantidasPorVinculo,
    minMantida: plano.minMantida,
    maxMantida: plano.maxMantida,
    minRemovida: plano.minRemovida,
    maxRemovida: plano.maxRemovida,
    contasPagarMantidas: plano.contasPagarMantidas,
    contasPagarRemovidas: plano.contasPagarRemovidas,
    contasReceber: plano.contasReceber,
    orcamentos: plano.orcamentos,
    vendas: plano.vendas,
    pedidosMantidos: plano.pedidosMantidos,
    pedidosRemovidos: plano.pedidosRemovidos,
    movimentosMantidos: plano.movimentosMantidos,
    movimentosRemovidos: plano.movimentosRemovidos,
    requisicoesMantidas: plano.requisicoesMantidas,
    requisicoesRemovidas: plano.requisicoesRemovidas,
    contagensMantidas: plano.contagensMantidas,
    contagensRemovidas: plano.contagensRemovidas,
    creditosRemovidos: plano.creditosRemovidos,
    pendenciasMantidas: plano.pendenciasMantidas,
    jobs: plano.jobs,
    focusJobs: plano.focusJobs,
    zapsign: plano.zapsign,
    logs: plano.logs,
    arquivosAlvo: plano.arquivos,
    produtos: foto.produto,
    pessoas: foto.pessoa,
    usuarios: foto.user,
    cfops: foto.cfop,
    planosFinanceiros: foto.planoFinanceiro,
    enderecosWms: foto.enderecoWms,
    focus: foto.focus,
  }
}

async function apagarMovimento(db: Db, plano: Plano): Promise<void> {
  console.log('[reset-movimento] apagando contas a pagar fora das notas mantidas')
  await apagarOnde(plano.idsContasPagarSaindo, (lote) =>
    db.contaPagarBaixa.deleteMany({ where: { parcela: { contaPagarId: { in: lote } } } })
  )
  await apagarOnde(plano.idsContasPagarSaindo, (lote) =>
    db.contaPagarParcela.deleteMany({ where: { contaPagarId: { in: lote } } })
  )
  await apagarOnde(plano.idsContasPagarSaindo, (lote) =>
    db.contaPagarAnexo.deleteMany({ where: { contaPagarId: { in: lote } } })
  )
  await apagarOnde(plano.idsContasPagarSaindo, (lote) =>
    db.contaPagar.deleteMany({ where: { id: { in: lote } } })
  )

  console.log('[reset-movimento] apagando contas a receber')
  await db.contaReceberBaixa.deleteMany({})
  await db.contaReceberParcela.deleteMany({})
  await db.contaReceberAnexo.deleteMany({})
  await db.contaReceber.deleteMany({})

  console.log('[reset-movimento] apagando filhos das notas que saem')
  await apagarOnde(plano.idsNotasSaindo, (lote) =>
    db.nfeCteVinculo.deleteMany({
      where: { OR: [{ nfeRecebidaId: { in: lote } }, { cteRecebidaId: { in: lote } }] },
    })
  )
  await apagarOnde(plano.idsNotasSaindo, (lote) =>
    db.nfeRecebidaItem.deleteMany({ where: { nfeRecebidaId: { in: lote } } })
  )
  await apagarOnde(plano.idsNotasSaindo, (lote) =>
    db.nfeRecebidaAnexo.deleteMany({ where: { nfeRecebidaId: { in: lote } } })
  )
  await apagarOnde(plano.idsNotasSaindo, (lote) =>
    db.nfeRecebidaTratativa.deleteMany({ where: { nfeRecebidaId: { in: lote } } })
  )
  await apagarOnde(plano.idsNotasSaindo, (lote) =>
    db.despesaEntradaDocumento.deleteMany({ where: { nfeRecebidaId: { in: lote } } })
  )
  await apagarOnde(plano.idsNotasSaindo, (lote) =>
    db.contagemEntradaNota.deleteMany({ where: { nfeRecebidaId: { in: lote } } })
  )

  console.log('[reset-movimento] apagando contagens sem nota mantida')
  await apagarOnde(plano.idsContagensSaindo, (lote) =>
    db.contagemEntradaRevisao.deleteMany({ where: { contagemEntradaId: { in: lote } } })
  )
  await apagarOnde(plano.idsContagensSaindo, (lote) =>
    db.contagemEntradaItem.deleteMany({ where: { contagemEntradaId: { in: lote } } })
  )
  await apagarOnde(plano.idsContagensSaindo, (lote) =>
    db.contagemEntradaNota.deleteMany({ where: { contagemEntradaId: { in: lote } } })
  )
  await apagarOnde(plano.idsContagensSaindo, (lote) =>
    db.contagemEntrada.deleteMany({ where: { id: { in: lote } } })
  )

  console.log('[reset-movimento] apagando requisicoes fora das notas mantidas')
  await apagarOnde(plano.idsRequisicoesSaindo, (lote) =>
    db.requisicaoWmsEvento.deleteMany({ where: { requisicaoId: { in: lote } } })
  )
  await apagarOnde(plano.idsRequisicoesSaindo, (lote) =>
    db.requisicaoWms.deleteMany({ where: { id: { in: lote } } })
  )

  console.log('[reset-movimento] apagando movimentos de estoque fora do pacote')
  await apagarOnde(plano.idsMovimentosSaindo, (lote) =>
    db.estoqueMovimento.deleteMany({ where: { id: { in: lote } } })
  )

  console.log('[reset-movimento] apagando notas fora do corte')
  await apagarOnde(plano.idsNotasSaindo, (lote) =>
    db.nfeRecebida.deleteMany({ where: { id: { in: lote } } })
  )

  console.log('[reset-movimento] apagando vendas e orcamentos')
  await db.vendaCaixaItem.deleteMany({})
  await db.vendaCaixa.deleteMany({})
  await db.orcamentoItem.deleteMany({})
  await db.orcamento.deleteMany({})

  console.log('[reset-movimento] apagando pedidos sem nota mantida e creditos ligados so a eles')
  await apagarOnde(plano.idsCreditosSaindo, (lote) =>
    db.creditoFornecedor.deleteMany({ where: { id: { in: lote } } })
  )
  await apagarOnde(plano.idsPedidosSaindo, (lote) =>
    db.creditoFornecedorMovimento.updateMany({
      where: { pedidoCompraId: { in: lote } },
      data: { pedidoCompraId: null },
    })
  )
  await apagarOnde(plano.idsPedidosSaindo, (lote) =>
    db.creditoReservaPedido.deleteMany({ where: { pedidoCompraId: { in: lote } } })
  )
  await apagarOnde(plano.idsPedidosSaindo, (lote) =>
    db.pedidoCompra.updateMany({
      where: { copiadoDeId: { in: lote } },
      data: { copiadoDeId: null },
    })
  )
  await apagarOnde(plano.idsPedidosSaindo, (lote) =>
    db.pedidoCompraItem.deleteMany({ where: { pedidoCompraId: { in: lote } } })
  )
  await apagarOnde(plano.idsPedidosSaindo, (lote) =>
    db.pedidoCompraAcessoPortal.deleteMany({ where: { pedidoCompraId: { in: lote } } })
  )
  await apagarOnde(plano.idsPedidosSaindo, (lote) =>
    db.pedidoCompraAnexoFornecedor.deleteMany({ where: { pedidoCompraId: { in: lote } } })
  )
  await apagarOnde(plano.idsPedidosSaindo, (lote) =>
    db.pedidoCompra.deleteMany({ where: { id: { in: lote } } })
  )

  console.log('[reset-movimento] apagando jobs, zapsign e auditoria')
  await db.job.deleteMany({})
  await db.focusNfeJob.deleteMany({})
  await db.zapsignDocumento.deleteMany({})
  await db.logDeAuditoria.deleteMany({})
}

async function recalcularEstoque(db: Db): Promise<void> {
  console.log('[reset-movimento] reescrevendo saldo do estoque')
  await db.$executeRaw`
    UPDATE "EstoqueMovimento" AS m
    SET "saldoDepois" = o.saldo
    FROM (
      SELECT
        id,
        CAST(
          SUM(quantidade) OVER (
            PARTITION BY "produtoId", dimensao
            ORDER BY "createdAt" ASC, id ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) AS DECIMAL(18, 4)
        ) AS saldo
      FROM "EstoqueMovimento"
    ) AS o
    WHERE m.id = o.id
  `

  await db.$executeRaw`
    UPDATE "EstoqueSaldo" AS s
    SET
      "qtdFisica" = COALESCE(x.fisico, 0),
      "qtdFiscal" = COALESCE(x.fiscal, 0),
      "qtdReservada" = COALESCE(x.reserva, 0),
      "qtdBloqueada" = COALESCE(x.bloqueio, 0),
      "updatedAt" = NOW()
    FROM (
      SELECT
        "produtoId",
        SUM(CASE WHEN dimensao = 'fisico' THEN quantidade ELSE 0 END) AS fisico,
        SUM(CASE WHEN dimensao = 'fiscal' THEN quantidade ELSE 0 END) AS fiscal,
        SUM(CASE WHEN dimensao = 'reserva' THEN quantidade ELSE 0 END) AS reserva,
        SUM(CASE WHEN dimensao = 'bloqueio' THEN quantidade ELSE 0 END) AS bloqueio
      FROM "EstoqueMovimento"
      GROUP BY "produtoId"
    ) AS x
    WHERE s."produtoId" = x."produtoId"
  `

  await db.$executeRaw`
    UPDATE "EstoqueSaldo" AS s
    SET
      "qtdFisica" = 0,
      "qtdFiscal" = 0,
      "qtdReservada" = 0,
      "qtdBloqueada" = 0,
      "updatedAt" = NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM "EstoqueMovimento" AS m WHERE m."produtoId" = s."produtoId"
    )
  `

  await db.$executeRaw`
    INSERT INTO "EstoqueSaldo" (
      "id",
      "companyId",
      "produtoId",
      "qtdFisica",
      "qtdFiscal",
      "qtdReservada",
      "qtdBloqueada",
      "createdAt",
      "updatedAt"
    )
    SELECT
      gen_random_uuid()::text,
      p."companyId",
      p.id,
      COALESCE(SUM(CASE WHEN m.dimensao = 'fisico' THEN m.quantidade ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN m.dimensao = 'fiscal' THEN m.quantidade ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN m.dimensao = 'reserva' THEN m.quantidade ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN m.dimensao = 'bloqueio' THEN m.quantidade ELSE 0 END), 0),
      NOW(),
      NOW()
    FROM "Produto" AS p
    JOIN "EstoqueMovimento" AS m ON m."produtoId" = p.id
    WHERE NOT EXISTS (
      SELECT 1 FROM "EstoqueSaldo" AS s WHERE s."produtoId" = p.id
    )
    GROUP BY p.id, p."companyId"
  `
}

async function verificar(db: Db, plano: Plano, antes: Foto): Promise<void> {
  const depois = await fotografar(db)
  const campos: (keyof Pick<
    Foto,
    | 'produto'
    | 'pessoa'
    | 'user'
    | 'cfop'
    | 'planoFinanceiro'
    | 'enderecoWms'
    | 'company'
    | 'recorrenciaFinanceira'
  >)[] = [
    'produto',
    'pessoa',
    'user',
    'cfop',
    'planoFinanceiro',
    'enderecoWms',
    'company',
    'recorrenciaFinanceira',
  ]
  for (const campo of campos) {
    if (antes[campo] !== depois[campo]) {
      throw new Error(`Cadastro mudou: ${campo} ${antes[campo]} -> ${depois[campo]}`)
    }
  }
  if (JSON.stringify(antes.focus) !== JSON.stringify(depois.focus)) {
    throw new Error('Cursor da Focus mudou')
  }
  for (const seq of antes.seqPagar) {
    const atual = depois.seqPagar.find((linha) => linha.companyId === seq.companyId)
    if (!atual || atual.proximo < seq.proximo) {
      throw new Error('ContaPagarCodigoSeq foi rebaixada')
    }
  }

  const [orcamentos, vendas, receber, contasPagar, notas] = await Promise.all([
    db.orcamento.count(),
    db.vendaCaixa.count(),
    db.contaReceber.count(),
    db.contaPagar.findMany({ select: { nfeRecebidaId: true } }),
    db.nfeRecebida.findMany({ select: { id: true, createdAt: true } }),
  ])
  if (orcamentos !== 0 || vendas !== 0 || receber !== 0) {
    throw new Error(
      `Movimento restante: orcamentos=${orcamentos} vendas=${vendas} receber=${receber}`
    )
  }

  const mantidas = new Set(plano.idsNotasMantidas)
  const porVinculo = new Set(plano.idsNotasPorVinculo)
  if (notas.length !== mantidas.size) {
    throw new Error(`Notas restantes ${notas.length} diferente do conjunto ${mantidas.size}`)
  }
  for (const nota of notas) {
    if (!mantidas.has(nota.id)) throw new Error('Nota restante fora do conjunto mantido')
    if (nota.createdAt.getTime() < CORTE.getTime() && !porVinculo.has(nota.id)) {
      throw new Error('Nota anterior ao corte sem vinculo mantido')
    }
  }
  for (const conta of contasPagar) {
    if (!conta.nfeRecebidaId || !mantidas.has(conta.nfeRecebidaId)) {
      throw new Error('Conta a pagar restante sem nota mantida')
    }
  }

  const divergencias = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n
    FROM "EstoqueSaldo" AS s
    WHERE s."qtdFisica" IS DISTINCT FROM COALESCE((
      SELECT SUM(quantidade) FROM "EstoqueMovimento" AS m
      WHERE m."produtoId" = s."produtoId" AND m.dimensao = 'fisico'
    ), 0)
    OR s."qtdFiscal" IS DISTINCT FROM COALESCE((
      SELECT SUM(quantidade) FROM "EstoqueMovimento" AS m
      WHERE m."produtoId" = s."produtoId" AND m.dimensao = 'fiscal'
    ), 0)
    OR s."qtdReservada" IS DISTINCT FROM COALESCE((
      SELECT SUM(quantidade) FROM "EstoqueMovimento" AS m
      WHERE m."produtoId" = s."produtoId" AND m.dimensao = 'reserva'
    ), 0)
    OR s."qtdBloqueada" IS DISTINCT FROM COALESCE((
      SELECT SUM(quantidade) FROM "EstoqueMovimento" AS m
      WHERE m."produtoId" = s."produtoId" AND m.dimensao = 'bloqueio'
    ), 0)
  `
  const semSaldo = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n
    FROM (
      SELECT "produtoId" FROM "EstoqueMovimento" GROUP BY "produtoId"
    ) AS m
    WHERE NOT EXISTS (
      SELECT 1 FROM "EstoqueSaldo" AS s WHERE s."produtoId" = m."produtoId"
    )
  `
  if (Number(divergencias[0]?.n ?? 0) !== 0 || Number(semSaldo[0]?.n ?? 0) !== 0) {
    throw new Error('Saldo de estoque nao fechou com a soma dos movimentos')
  }
}

async function apagarArquivos(plano: Plano): Promise<{ removidos: number; ausentes: number }> {
  let removidos = 0
  let ausentes = 0
  for (const alvo of [...plano.pastas, ...plano.arquivosAbsolutos]) {
    if (!sobUploads(alvo)) continue
    if (!existsSync(alvo)) {
      ausentes += 1
      continue
    }
    await rm(alvo, { recursive: true, force: true })
    removidos += 1
  }
  return { removidos, ausentes }
}

async function main() {
  const args = lerArgs(process.argv.slice(2))
  console.log(
    `[reset-movimento] corte=${CORTE.toISOString()} host=${process.env.DB_HOST ?? ''} banco=${process.env.DB_NAME ?? ''}`
  )

  if (args.aplicar) {
    validarDump(args.dump)
  }

  const notasAntes = await prisma.nfeRecebida.count()
  const foto = await fotografar(prisma)
  const plano = await montarPlano(prisma)
  const notasDepoisLeitura = await prisma.nfeRecebida.count()
  if (notasAntes !== notasDepoisLeitura) {
    falhar('A leitura alterou a contagem de notas')
  }

  console.log(`RESUMO_JSON=${JSON.stringify(resumoPublico(plano, foto, args.aplicar ? 'aplicar' : 'dry-run'))}`)

  if (!args.aplicar) {
    console.log('[reset-movimento] dry-run: nenhuma escrita')
    if (plano.notasMantidas === 0) {
      falhar('ABORT: 0 notas mantidas no dry-run. Nada foi apagado.', 2)
    }
    return
  }

  if (plano.notasMantidas === 0 && !args.aceitarZero) {
    falhar('ABORT: 0 notas mantidas. Nada foi apagado.', 2)
  }

  const resultado = await prisma.$transaction(
    async (tx) => {
      const fotoTx = await fotografar(tx)
      const planoTx = await montarPlano(tx)
      if (planoTx.notasMantidas === 0 && !args.aceitarZero) {
        throw new Error('ABORT_ZERO_NOTAS')
      }
      if (planoTx.notasMantidas !== plano.notasMantidas) {
        throw new Error(
          `Conjunto mudou entre a leitura e a transacao: ${plano.notasMantidas} -> ${planoTx.notasMantidas}`
        )
      }
      await apagarMovimento(tx, planoTx)
      await recalcularEstoque(tx)
      await verificar(tx, planoTx, fotoTx)
      return planoTx
    },
    { timeout: 1_200_000, maxWait: 120_000 }
  )

  const disco = await apagarArquivos(resultado)
  console.log(
    `[reset-movimento] arquivos_removidos=${disco.removidos} arquivos_ausentes=${disco.ausentes}`
  )
  const fotoFinal = await fotografar(prisma)
  console.log(
    `VERIFICACAO_JSON=${JSON.stringify({
      orcamentos: 0,
      vendas: 0,
      contasReceber: 0,
      notasMantidas: resultado.notasMantidas,
      contasPagarMantidas: resultado.contasPagarMantidas,
      produtos: fotoFinal.produto,
      pessoas: fotoFinal.pessoa,
      usuarios: fotoFinal.user,
      focus: fotoFinal.focus,
    })}`
  )
  console.log('[reset-movimento] aplicar concluido')
}

main()
  .catch((erro: unknown) => {
    const mensagem = erro instanceof Error ? erro.message : 'falha desconhecida'
    if (mensagem === 'ABORT_ZERO_NOTAS') {
      console.error('[reset-movimento] ABORT: 0 notas mantidas. Nada foi apagado.')
      process.exitCode = 2
      return
    }
    console.error(`[reset-movimento] falhou: ${mensagem}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
