/**
 * Acesso ao banco de dados para produtos.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { Prisma } from '@prisma/client'
import type { DadosParaCriarProduto, DadosParaEditarProduto } from './esquema-produtos.js'
import { urlPublicaFoto } from './armazenamento-foto-produto.js'

const includeCompleto = {
  fotos: { orderBy: { ordem: 'asc' as const } },
  fornecedores: {
    orderBy: { ordem: 'asc' as const },
    include: { fornecedor: { select: { id: true, nome: true } } },
  },
  embalagensMaster: { orderBy: { ordem: 'asc' as const } },
  enderecosEstoque: { orderBy: { ordem: 'asc' as const } },
  similares: {
    include: {
      similarProduto: { select: { id: true, nomeVenda: true, sku: true } },
    },
  },
} as const

type ProdutoDb = Prisma.ProdutoGetPayload<{ include: typeof includeCompleto }>

export type ProdutoView = ReturnType<typeof mapearProduto>

function mapearFotos(produto: ProdutoDb, companyId: string) {
  const principal = produto.fotos.find((f) => f.tipo === 'principal')
  const miniatura = produto.fotos.find((f) => f.tipo === 'miniatura')
  return {
    urlFotoPrincipal: principal
      ? urlPublicaFoto(companyId, produto.id, principal.arquivo)
      : null,
    urlFotoMiniatura: miniatura
      ? urlPublicaFoto(companyId, produto.id, miniatura.arquivo)
      : null,
  }
}

function mapearProduto(produto: ProdutoDb, companyId: string) {
  const fotos = mapearFotos(produto, companyId)
  return {
    id: produto.id,
    sku: produto.sku,
    ativo: produto.ativo,
    nomeVenda: produto.nomeVenda,
    marca: produto.marca,
    unidade: produto.unidade,
    caracteristicas: produto.caracteristicas,
    tipoEntrega: produto.tipoEntrega,
    diasParaEntrega: produto.diasParaEntrega,
    dataValidadePreco: produto.dataValidadePreco,
    entregaNoAto: produto.entregaNoAto,
    entregaARetirar: produto.entregaARetirar,
    entregar: produto.entregar,
    entregaPorEncomenda: produto.entregaPorEncomenda,
    flagDevolucao: produto.flagDevolucao,
    controlaEstoque: produto.controlaEstoque,
    flagComissao: produto.flagComissao,
    permiteEstoqueNegativo: produto.permiteEstoqueNegativo,
    bloqueadoCompra: produto.bloqueadoCompra,
    bloqueadoVenda: produto.bloqueadoVenda,
    desativarAoZerarEstoque: produto.desativarAoZerarEstoque,
    codigoBarras: produto.codigoBarras,
    pesoKg: produto.pesoKg ? Number(produto.pesoKg) : null,
    alturaCm: produto.alturaCm ? Number(produto.alturaCm) : null,
    larguraCm: produto.larguraCm ? Number(produto.larguraCm) : null,
    comprimentoCm: produto.comprimentoCm ? Number(produto.comprimentoCm) : null,
    capacidadeEmpilhamento: produto.capacidadeEmpilhamento,
    normaPalete: produto.normaPalete,
    nomeCompra: produto.nomeCompra,
    precoCusto: produto.precoCusto ? Number(produto.precoCusto) : null,
    agruparSimilaresRuptura: produto.agruparSimilaresRuptura,
    fornecedores: produto.fornecedores.map((f) => ({
      id: f.id,
      fornecedorPessoaId: f.fornecedorPessoaId,
      fornecedorNome: f.fornecedor.nome,
      codigoFornecedor: f.codigoFornecedor,
      multiploEntrada: f.multiploEntrada ? Number(f.multiploEntrada) : null,
      multiplicadorEntrada: f.multiplicadorEntrada ? Number(f.multiplicadorEntrada) : null,
      unidadeEntrada: f.unidadeEntrada,
      ordem: f.ordem,
    })),
    ncm: produto.ncm,
    codigoOrigem: produto.codigoOrigem,
    embalagensMaster: produto.embalagensMaster.map((e) => ({
      id: e.id,
      quantidade: Number(e.quantidade),
      codigoBarras: e.codigoBarras,
      alturaCm: e.alturaCm ? Number(e.alturaCm) : null,
      larguraCm: e.larguraCm ? Number(e.larguraCm) : null,
      comprimentoCm: e.comprimentoCm ? Number(e.comprimentoCm) : null,
      ordem: e.ordem,
    })),
    enderecosEstoque: produto.enderecosEstoque.map((e) => ({
      id: e.id,
      apelido: e.apelido,
      endereco: e.endereco,
      ordem: e.ordem,
    })),
    similares: produto.similares.map((s) => ({
      id: s.similarProduto.id,
      nomeVenda: s.similarProduto.nomeVenda,
      sku: s.similarProduto.sku,
    })),
    similaresIds: produto.similares.map((s) => s.similarProdutoId),
    ...fotos,
    createdAt: produto.createdAt,
    updatedAt: produto.updatedAt,
  }
}

function dadosEscalares(dados: DadosParaCriarProduto | DadosParaEditarProduto) {
  return {
    sku: dados.sku || null,
    ativo: dados.ativo ?? true,
    nomeVenda: dados.nomeVenda,
    marca: dados.marca,
    unidade: dados.unidade,
    caracteristicas: dados.caracteristicas || null,
    tipoEntrega: dados.tipoEntrega || null,
    diasParaEntrega: dados.diasParaEntrega ?? null,
    dataValidadePreco: dados.dataValidadePreco ?? null,
    entregaNoAto: dados.entregaNoAto ?? false,
    entregaARetirar: dados.entregaARetirar ?? false,
    entregar: dados.entregar ?? false,
    entregaPorEncomenda: dados.entregaPorEncomenda ?? false,
    flagDevolucao: dados.flagDevolucao ?? false,
    controlaEstoque: true,
    flagComissao: dados.flagComissao ?? false,
    permiteEstoqueNegativo: dados.permiteEstoqueNegativo ?? false,
    bloqueadoCompra: dados.bloqueadoCompra ?? false,
    bloqueadoVenda: dados.bloqueadoVenda ?? false,
    desativarAoZerarEstoque: dados.desativarAoZerarEstoque ?? false,
    codigoBarras: dados.codigoBarras || null,
    pesoKg: dados.pesoKg ?? null,
    alturaCm: dados.alturaCm ?? null,
    larguraCm: dados.larguraCm ?? null,
    comprimentoCm: dados.comprimentoCm ?? null,
    capacidadeEmpilhamento: dados.capacidadeEmpilhamento ?? null,
    normaPalete: dados.normaPalete || null,
    nomeCompra: dados.nomeCompra || null,
    precoCusto: dados.precoCusto ?? null,
    agruparSimilaresRuptura: dados.agruparSimilaresRuptura ?? false,
    ncm: dados.ncm || null,
    codigoOrigem: dados.codigoOrigem || null,
  }
}

async function sincronizarRelacoes(
  tx: Prisma.TransactionClient,
  produtoId: string,
  dados: DadosParaCriarProduto | DadosParaEditarProduto
) {
  await tx.produtoEmbalagemMaster.deleteMany({ where: { produtoId } })
  await tx.produtoEnderecoEstoque.deleteMany({ where: { produtoId } })
  await tx.produtoSimilar.deleteMany({ where: { produtoId } })
  await tx.produtoFornecedor.deleteMany({ where: { produtoId } })

  if (dados.embalagensMaster?.length) {
    await tx.produtoEmbalagemMaster.createMany({
      data: dados.embalagensMaster.map((e, ordem) => ({
        produtoId,
        quantidade: e.quantidade,
        codigoBarras: e.codigoBarras || null,
        alturaCm: e.alturaCm ?? null,
        larguraCm: e.larguraCm ?? null,
        comprimentoCm: e.comprimentoCm ?? null,
        ordem: e.ordem ?? ordem,
      })),
    })
  }

  if (dados.enderecosEstoque?.length) {
    await tx.produtoEnderecoEstoque.createMany({
      data: dados.enderecosEstoque.map((e, ordem) => ({
        produtoId,
        apelido: e.apelido || null,
        endereco: e.endereco,
        ordem: e.ordem ?? ordem,
      })),
    })
  }

  if (dados.fornecedores?.length) {
    await tx.produtoFornecedor.createMany({
      data: dados.fornecedores.map((f, ordem) => ({
        produtoId,
        fornecedorPessoaId: f.fornecedorPessoaId,
        codigoFornecedor: f.codigoFornecedor || null,
        multiploEntrada: f.multiploEntrada ?? null,
        multiplicadorEntrada: f.multiplicadorEntrada ?? null,
        unidadeEntrada: f.unidadeEntrada || null,
        ordem: f.ordem ?? ordem,
      })),
    })
  }

  const similaresIds = [...new Set(dados.similaresIds ?? [])].filter((id) => id !== produtoId)
  if (similaresIds.length) {
    await tx.produtoSimilar.createMany({
      data: similaresIds.map((similarProdutoId) => ({ produtoId, similarProdutoId })),
    })
  }
}

async function listarPorEmpresa(companyId: string, busca?: string, incluirInativos = false) {
  const where: Prisma.ProdutoWhereInput = {
    companyId,
    ...(incluirInativos ? {} : { ativo: true }),
    ...(busca
      ? {
          OR: [
            { nomeVenda: { contains: busca, mode: 'insensitive' } },
            { sku: { contains: busca, mode: 'insensitive' } },
            { codigoBarras: { contains: busca, mode: 'insensitive' } },
            { marca: { contains: busca, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const produtos = await clientePrisma.produto.findMany({
    where,
    include: includeCompleto,
    orderBy: { nomeVenda: 'asc' },
  })

  return produtos.map((p) => mapearProduto(p, companyId))
}

async function buscarPorId(id: string) {
  return clientePrisma.produto.findUnique({
    where: { id },
    include: includeCompleto,
  })
}

async function buscarPorSkuNaEmpresa(sku: string, companyId: string) {
  return clientePrisma.produto.findFirst({ where: { sku, companyId } })
}

async function criar(dados: DadosParaCriarProduto, companyId: string) {
  return clientePrisma.$transaction(async (tx) => {
    const produto = await tx.produto.create({
      data: { ...dadosEscalares(dados), companyId },
      include: includeCompleto,
    })
    await sincronizarRelacoes(tx, produto.id, dados)
    const completo = await tx.produto.findUniqueOrThrow({
      where: { id: produto.id },
      include: includeCompleto,
    })
    return mapearProduto(completo, companyId)
  })
}

async function atualizar(id: string, dados: DadosParaEditarProduto, companyId: string) {
  return clientePrisma.$transaction(async (tx) => {
    await tx.produto.update({ where: { id }, data: dadosEscalares(dados) })
    await sincronizarRelacoes(tx, id, dados)
    const completo = await tx.produto.findUniqueOrThrow({
      where: { id },
      include: includeCompleto,
    })
    return mapearProduto(completo, companyId)
  })
}

async function alterarStatus(id: string, ativo: boolean) {
  return clientePrisma.produto.update({
    where: { id },
    data: { ativo },
    include: includeCompleto,
  })
}

async function sincronizarFotos(
  produtoId: string,
  arquivos: {
    principal: string
    miniatura: string
    tamanhoPrincipal: number
    tamanhoMiniatura: number
    larguraPrincipal?: number
    alturaPrincipal?: number
    larguraMiniatura?: number
    alturaMiniatura?: number
  }
) {
  await clientePrisma.$transaction([
    clientePrisma.produtoFoto.deleteMany({ where: { produtoId } }),
    clientePrisma.produtoFoto.create({
      data: {
        produtoId,
        tipo: 'principal',
        arquivo: arquivos.principal,
        tamanhoBytes: arquivos.tamanhoPrincipal,
        larguraPx: arquivos.larguraPrincipal ?? null,
        alturaPx: arquivos.alturaPrincipal ?? null,
      },
    }),
    clientePrisma.produtoFoto.create({
      data: {
        produtoId,
        tipo: 'miniatura',
        arquivo: arquivos.miniatura,
        tamanhoBytes: arquivos.tamanhoMiniatura,
        larguraPx: arquivos.larguraMiniatura ?? null,
        alturaPx: arquivos.alturaMiniatura ?? null,
      },
    }),
  ])
}

async function removerFotosDoBanco(produtoId: string) {
  await clientePrisma.produtoFoto.deleteMany({ where: { produtoId } })
}

export const repositorioDeProdutos = {
  listarPorEmpresa,
  buscarPorId,
  buscarPorSkuNaEmpresa,
  criar,
  atualizar,
  alterarStatus,
  sincronizarFotos,
  removerFotosDoBanco,
  mapearProduto,
}

