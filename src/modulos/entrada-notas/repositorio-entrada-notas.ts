/**
 * Persistência do pipeline de Entrada de Notas.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { ItemXmlNfe } from '../focus-nfe/parser-xml-nfe.js'
import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'

const includeNotaCompleta = {
  itens: {
    orderBy: { nItem: 'asc' as const },
    include: {
      produto: {
        select: {
          id: true,
          nomeVenda: true,
          sku: true,
          ncm: true,
          codigoOrigem: true,
          pesoKg: true,
        },
      },
    },
  },
  fornecedorPessoa: {
    select: {
      id: true,
      nome: true,
      cnpj: true,
      nomeFantasia: true,
      papeis: {
        where: { papel: 'fornecedor' as const, ativo: true },
        take: 1,
        include: { dadosFornecedor: { select: { regraRateioFrete: true } } },
      },
    },
  },
  vinculosComoNfe: {
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
  },
  vinculosComoCte: {
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
  },
  despesasEntrada: true,
} as const

export type NotaCompletaEntrada = Prisma.NfeRecebidaGetPayload<{
  include: typeof includeNotaCompleta
}>

async function buscarNotaCompleta(
  companyId: string,
  id: string
): Promise<NotaCompletaEntrada | null> {
  return clientePrisma.nfeRecebida.findFirst({
    where: { id, companyId },
    include: includeNotaCompleta,
  })
}

async function buscarNotaPorId(companyId: string, id: string) {
  return clientePrisma.nfeRecebida.findFirst({ where: { id, companyId } })
}

async function substituirItensDoXml(nfeRecebidaId: string, itens: ItemXmlNfe[]) {
  await clientePrisma.nfeRecebidaItem.deleteMany({ where: { nfeRecebidaId } })
  if (itens.length === 0) return []
  await clientePrisma.nfeRecebidaItem.createMany({
    data: itens.map((item) => ({
      id: randomUUID(),
      nfeRecebidaId,
      nItem: item.nItem,
      descricao: item.descricao,
      gtin: item.gtin,
      codigoProduto: item.codigoProduto,
      ncm: item.ncm,
      cfop: item.cfop,
      cst: item.cst,
      origem: item.origem,
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
      valorTotal: item.valorTotal,
      pesoKg: item.pesoKg ?? null,
      updatedAt: new Date(),
    })),
  })
  return clientePrisma.nfeRecebidaItem.findMany({
    where: { nfeRecebidaId },
    orderBy: { nItem: 'asc' },
  })
}

async function atualizarNota(
  id: string,
  data: {
    fornecedorPessoaId?: string | null
    prazoPagamentoXml?: string | null
    prazoPagamentoTexto?: string | null
    analiseJson?: Prisma.InputJsonValue | null
    etapaAtual?: string
    statusEntrada?: string
    origemLancamento?: string | null
    criticasLiberadas?: boolean
    observacaoContato?: string | null
    pedidoCompraId?: string | null
    manifestacaoDestinatario?: string | null
    modFrete?: string | null
    chaveNfeReferenciada?: string | null
  }
) {
  return clientePrisma.nfeRecebida.update({
    where: { id },
    data: data as Prisma.NfeRecebidaUncheckedUpdateInput,
  })
}

async function atualizarItem(
  id: string,
  data: {
    produtoId?: string | null
    vinculoModo?: string | null
    criticaCadastro?: boolean
    criticaFiscal?: boolean
    criticaNegociacao?: boolean
    custoFreteRateado?: number | null
  }
) {
  return clientePrisma.nfeRecebidaItem.update({ where: { id }, data })
}

async function buscarFornecedorPorCnpj(companyId: string, documento: string) {
  const limpo = documento.replace(/\D/g, '')
  if (!limpo) return null
  return clientePrisma.pessoa.findFirst({
    where: {
      companyId,
      OR: [{ cnpj: limpo }, { cpf: limpo }],
      papeis: { some: { papel: 'fornecedor', ativo: true } },
    },
    select: { id: true, nome: true, cnpj: true, cpf: true, nomeFantasia: true },
  })
}

async function buscarProdutoPorGtin(companyId: string, gtin: string) {
  const limpo = gtin.replace(/\D/g, '')
  if (!limpo) return null

  const porUnidade = await clientePrisma.produto.findFirst({
    where: { companyId, codigoBarras: limpo, ativo: true },
    select: { id: true, nomeVenda: true, ncm: true, codigoOrigem: true },
  })
  if (porUnidade) return { ...porUnidade, modo: 'barras' as const }

  const porMaster = await clientePrisma.produtoEmbalagemMaster.findFirst({
    where: {
      codigoBarras: limpo,
      produto: { companyId, ativo: true },
    },
    select: {
      produto: { select: { id: true, nomeVenda: true, ncm: true, codigoOrigem: true } },
    },
  })
  if (porMaster?.produto) return { ...porMaster.produto, modo: 'barras' as const }
  return null
}

async function buscarProdutoPorCodigoOriginal(
  companyId: string,
  fornecedorPessoaId: string,
  codigo: string
) {
  const codigoLimpo = codigo.trim()
  if (!codigoLimpo) return null
  const vinculo = await clientePrisma.produtoFornecedor.findFirst({
    where: {
      fornecedorPessoaId,
      codigoFornecedor: { equals: codigoLimpo, mode: 'insensitive' },
      produto: { companyId, ativo: true },
    },
    select: {
      produto: { select: { id: true, nomeVenda: true, ncm: true, codigoOrigem: true } },
    },
  })
  if (!vinculo?.produto) return null
  return { ...vinculo.produto, modo: 'codigo_original' as const }
}

async function listarPedidosAbertosFornecedor(companyId: string, fornecedorPessoaId: string) {
  return clientePrisma.pedidoCompra.findMany({
    where: {
      companyId,
      fornecedorPessoaId,
      status: { in: ['enviado', 'aprovado', 'parcial'] },
    },
    include: {
      itens: {
        include: { produto: { select: { id: true, nomeVenda: true } } },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

async function buscarPedidoComItens(companyId: string, pedidoId: string) {
  return clientePrisma.pedidoCompra.findFirst({
    where: { id: pedidoId, companyId },
    include: {
      itens: {
        include: { produto: { select: { id: true, nomeVenda: true } } },
      },
    },
  })
}

async function gravarCodigoOriginalVinculo(
  produtoId: string,
  fornecedorPessoaId: string,
  codigo: string
) {
  const existente = await clientePrisma.produtoFornecedor.findUnique({
    where: {
      produtoId_fornecedorPessoaId: { produtoId, fornecedorPessoaId },
    },
  })
  if (existente) {
    return clientePrisma.produtoFornecedor.update({
      where: { id: existente.id },
      data: { codigoFornecedor: codigo },
    })
  }
  return clientePrisma.produtoFornecedor.create({
    data: {
      produtoId,
      fornecedorPessoaId,
      codigoFornecedor: codigo,
    },
  })
}

async function atualizarFiscalProduto(
  produtoId: string,
  companyId: string,
  dados: { ncm?: string | null; codigoOrigem?: string | null }
) {
  return clientePrisma.produto.updateMany({
    where: { id: produtoId, companyId },
    data: {
      ...(dados.ncm !== undefined ? { ncm: dados.ncm } : {}),
      ...(dados.codigoOrigem !== undefined ? { codigoOrigem: dados.codigoOrigem } : {}),
    },
  })
}

async function contarItens(nfeRecebidaId: string) {
  return clientePrisma.nfeRecebidaItem.count({ where: { nfeRecebidaId } })
}

/** Notas em aberto cujo emitente bate com o documento (compara só dígitos). */
async function listarNotasPendentesPorDocumento(companyId: string, documento: string) {
  const limpo = documento.replace(/\D/g, '')
  if (!limpo) return []
  const candidatas = await clientePrisma.nfeRecebida.findMany({
    where: {
      companyId,
      statusEntrada: { in: ['pendente', 'em_analise', 'stand_by'] },
      documentoEmitente: { not: null },
    },
    select: { id: true, documentoEmitente: true },
    orderBy: { createdAt: 'asc' },
  })
  return candidatas
    .filter((n) => (n.documentoEmitente ?? '').replace(/\D/g, '') === limpo)
    .map((n) => ({ id: n.id }))
}

/** Notas em aberto ainda sem fornecedor ERP vinculado. */
async function listarNotasPendentesSemFornecedor(companyId: string) {
  return clientePrisma.nfeRecebida.findMany({
    where: {
      companyId,
      statusEntrada: { in: ['pendente', 'em_analise', 'stand_by'] },
      fornecedorPessoaId: null,
      documentoEmitente: { not: null },
    },
    select: { id: true, documentoEmitente: true },
    orderBy: { createdAt: 'asc' },
  })
}

export const repositorioEntradaNotas = {
  buscarNotaCompleta,
  buscarNotaPorId,
  substituirItensDoXml,
  atualizarNota,
  atualizarItem,
  buscarFornecedorPorCnpj,
  buscarProdutoPorGtin,
  buscarProdutoPorCodigoOriginal,
  listarPedidosAbertosFornecedor,
  buscarPedidoComItens,
  gravarCodigoOriginalVinculo,
  atualizarFiscalProduto,
  contarItens,
  listarNotasPendentesPorDocumento,
  listarNotasPendentesSemFornecedor,
}
