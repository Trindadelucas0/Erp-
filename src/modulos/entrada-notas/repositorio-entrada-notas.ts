/**
 * Persistência do pipeline de Entrada de Notas.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import {
  normalizarCodigoOriginalComparacao,
  variantesCodigoBarrasParaBusca,
} from '../../compartilhado/validacoes/codigo-barras-gtin.js'
import { normalizarDocumento } from '../../compartilhado/validacoes/documentos.js'
import type { ItemXmlNfe } from '../focus-nfe/parser-xml-nfe.js'
import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'
import {
  SUBTIPO_CFOP_CONHECIMENTO_FRETE,
  cfopEhConhecimentoFrete,
  variantesCodigoCfopParaBusca,
} from '../cfops/classificacao-cfop.js'

const includeNotaCompleta = {
  cfopEntrada: {
    select: { id: true, codigo: true, nome: true, subtipoCfop: true },
  },
  itens: {
    orderBy: { nItem: 'asc' as const },
    include: {
      produto: {
        select: {
          id: true,
          nomeVenda: true,
          sku: true,
          codigoBarras: true,
          ncm: true,
          codigoOrigem: true,
          marca: true,
          unidade: true,
          pesoKg: true,
          controlaEstoque: true,
          fornecedores: {
            select: { fornecedorPessoaId: true, multiplicadorEntrada: true },
          },
        },
      },
      cfopEntrada: {
        select: { id: true, codigo: true, nome: true },
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
        include: {
          dadosFornecedor: {
            select: {
              regraRateioFrete: true,
              tipoRevenda: true,
              tipoConsumo: true,
              tipoPrestadorServico: true,
              exigirItensEntrada: true,
              permitirVinculoManual: true,
            },
          },
        },
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
          xmlConteudo: true,
          cfopEntradaId: true,
          cfopEntrada: {
            select: { id: true, codigo: true, nome: true, subtipoCfop: true },
          },
          despesasEntrada: {
            where: { origem: 'cte' },
            take: 1,
          },
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
  tratativas: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      usuario: { select: { id: true, name: true, email: true } },
    },
  },
  anexos: {
    orderBy: { createdAt: 'desc' as const },
  },
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
      unidade: item.unidade,
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
    problemaDesfecho?: string | null
    problemaMarcadoEm?: Date | null
    problemaResolvidoEm?: Date | null
    cfopEntradaId?: string | null
    divergenciaDesfecho?: string | null
    divergenciaResolvidaEm?: Date | null
  }
) {
  return clientePrisma.nfeRecebida.update({
    where: { id },
    data: data as Prisma.NfeRecebidaUncheckedUpdateInput,
  })
}

async function criarAnexoEntradaNota(dados: {
  companyId: string
  nfeRecebidaId: string
  tipoAnexo: string
  nomeArquivo: string
  mimeType: string
  caminhoArquivo: string
  tamanhoBytes: number
  usuarioId: string | null
}) {
  return clientePrisma.nfeRecebidaAnexo.create({
    data: {
      id: randomUUID(),
      companyId: dados.companyId,
      nfeRecebidaId: dados.nfeRecebidaId,
      tipoAnexo: dados.tipoAnexo,
      nomeArquivo: dados.nomeArquivo,
      mimeType: dados.mimeType,
      caminhoArquivo: dados.caminhoArquivo,
      tamanhoBytes: dados.tamanhoBytes,
      usuarioId: dados.usuarioId,
    },
  })
}

async function criarAnexoDivergencia(dados: {
  companyId: string
  nfeRecebidaId: string
  nomeArquivo: string
  mimeType: string
  caminhoArquivo: string
  tamanhoBytes: number
  usuarioId: string | null
}) {
  return criarAnexoEntradaNota({ ...dados, tipoAnexo: 'ressalva_divergencia' })
}

async function buscarAnexoEntradaNota(companyId: string, nfeRecebidaId: string, anexoId: string) {
  return clientePrisma.nfeRecebidaAnexo.findFirst({
    where: { id: anexoId, nfeRecebidaId, companyId },
  })
}

/**
 * Soma NfeRecebidaItem.quantidade já consolidada por produto, considerando todas as
 * NfeRecebida com esse pedidoCompraId em statusEntrada='entrada_consolidada'.
 * `notaIdExcluida` evita a nota atual se autocontar em reprocessamento/"voltar etapa".
 */
async function buscarUltimoPrecoConsolidadoPorProduto(
  companyId: string,
  produtoIds: string[],
  notaIdExcluida: string
): Promise<Map<string, { produtoId: string; precoUnitarioVenda: number }>> {
  const ids = [...new Set(produtoIds.filter(Boolean))]
  const mapa = new Map<string, { produtoId: string; precoUnitarioVenda: number }>()
  if (ids.length === 0) return mapa

  const itens = await clientePrisma.nfeRecebidaItem.findMany({
    where: {
      produtoId: { in: ids },
      nfeRecebida: {
        companyId,
        statusEntrada: 'entrada_consolidada',
        id: { not: notaIdExcluida },
      },
    },
    select: {
      produtoId: true,
      valorUnitario: true,
      nfeRecebida: {
        select: {
          dataEmissao: true,
          createdAt: true,
          fornecedorPessoaId: true,
        },
      },
      produto: {
        select: {
          fornecedores: {
            select: { fornecedorPessoaId: true, multiplicadorEntrada: true },
          },
        },
      },
    },
    orderBy: [{ nfeRecebida: { dataEmissao: 'desc' } }, { nfeRecebida: { createdAt: 'desc' } }],
  })

  for (const item of itens) {
    if (!item.produtoId || mapa.has(item.produtoId)) continue
    const valor = item.valorUnitario != null ? Number(item.valorUnitario) : NaN
    if (!Number.isFinite(valor) || valor <= 0) continue
    const vinculo = item.produto?.fornecedores.find(
      (f) => f.fornecedorPessoaId === item.nfeRecebida.fornecedorPessoaId
    )
    const multRaw = vinculo?.multiplicadorEntrada != null ? Number(vinculo.multiplicadorEntrada) : 1
    const mult = Number.isFinite(multRaw) && multRaw > 0 ? multRaw : 1
    mapa.set(item.produtoId, {
      produtoId: item.produtoId,
      precoUnitarioVenda: valor / mult,
    })
  }
  return mapa
}

async function somarConsolidadoPorProduto(
  companyId: string,
  pedidoCompraId: string,
  notaIdExcluida?: string
): Promise<Map<string, number>> {
  const itens = await clientePrisma.nfeRecebidaItem.findMany({
    where: {
      produtoId: { not: null },
      nfeRecebida: {
        companyId,
        pedidoCompraId,
        statusEntrada: 'entrada_consolidada',
        ...(notaIdExcluida ? { id: { not: notaIdExcluida } } : {}),
      },
    },
    select: { produtoId: true, quantidade: true },
  })

  const mapa = new Map<string, number>()
  for (const item of itens) {
    if (!item.produtoId) continue
    const qtd = item.quantidade != null ? Number(item.quantidade) : 0
    mapa.set(item.produtoId, (mapa.get(item.produtoId) ?? 0) + qtd)
  }
  return mapa
}

async function criarTratativa(dados: {
  companyId: string
  nfeRecebidaId: string
  usuarioId: string
  texto: string
}) {
  return clientePrisma.nfeRecebidaTratativa.create({
    data: {
      id: randomUUID(),
      companyId: dados.companyId,
      nfeRecebidaId: dados.nfeRecebidaId,
      usuarioId: dados.usuarioId,
      texto: dados.texto,
    },
    include: {
      usuario: { select: { id: true, name: true, email: true } },
    },
  })
}

async function listarTratativas(companyId: string, nfeRecebidaId: string) {
  return clientePrisma.nfeRecebidaTratativa.findMany({
    where: { companyId, nfeRecebidaId },
    orderBy: { createdAt: 'asc' },
    include: {
      usuario: { select: { id: true, name: true, email: true } },
    },
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
    cfopEntradaId?: string | null
  }
) {
  return clientePrisma.nfeRecebidaItem.update({ where: { id }, data })
}

/**
 * Resolve emitente da nota pelo CNPJ/CPF.
 * NFe/NFS-e: só papel fornecedor.
 * CT-e: fornecedor **ou** transportadora (mesmo Pessoa — evita cadastro duplicado).
 */
async function buscarFornecedorPorCnpj(
  companyId: string,
  documento: string,
  opcoes?: { aceitarTransportadora?: boolean }
) {
  const limpo = normalizarDocumento(documento)
  if (!limpo) return null
  const papeis = opcoes?.aceitarTransportadora
    ? ['fornecedor', 'transportadora']
    : ['fornecedor']
  return clientePrisma.pessoa.findFirst({
    where: {
      companyId,
      OR: [{ cnpj: limpo }, { cpf: limpo }],
      papeis: { some: { papel: { in: papeis }, ativo: true } },
    },
    select: { id: true, nome: true, cnpj: true, cpf: true, nomeFantasia: true },
  })
}

async function buscarFlagsFornecedorEntrada(pessoaId: string) {
  const papel = await clientePrisma.pessoaPapel.findFirst({
    where: { pessoaId, papel: 'fornecedor', ativo: true },
    select: {
      dadosFornecedor: {
        select: {
          tipoRevenda: true,
          tipoConsumo: true,
          tipoPrestadorServico: true,
          exigirItensEntrada: true,
          permitirVinculoManual: true,
        },
      },
    },
  })
  return papel?.dadosFornecedor ?? null
}

async function buscarProdutoPorGtin(companyId: string, gtin: string) {
  const variantes = variantesCodigoBarrasParaBusca(gtin)
  if (variantes.length === 0) return null

  const selectProduto = {
    id: true,
    nomeVenda: true,
    ncm: true,
    codigoOrigem: true,
  } as const

  for (const codigo of variantes) {
    const porUnidade = await clientePrisma.produto.findFirst({
      where: { companyId, codigoBarras: codigo, ativo: true },
      select: selectProduto,
    })
    if (porUnidade) return { ...porUnidade, modo: 'barras' as const }

    const porMaster = await clientePrisma.produtoEmbalagemMaster.findFirst({
      where: {
        codigoBarras: codigo,
        produto: { companyId, ativo: true },
      },
      select: {
        produto: { select: selectProduto },
      },
    })
    if (porMaster?.produto) return { ...porMaster.produto, modo: 'barras' as const }
  }

  return null
}

async function buscarProdutoPorCodigoOriginal(
  companyId: string,
  fornecedorPessoaId: string,
  codigo: string
) {
  const codigoLimpo = codigo.trim()
  if (!codigoLimpo) return null

  const selectProduto = {
    id: true,
    nomeVenda: true,
    ncm: true,
    codigoOrigem: true,
  } as const

  const vinculoExato = await clientePrisma.produtoFornecedor.findFirst({
    where: {
      fornecedorPessoaId,
      codigoFornecedor: { equals: codigoLimpo, mode: 'insensitive' },
      produto: { companyId, ativo: true },
    },
    select: {
      produto: { select: selectProduto },
    },
  })
  if (vinculoExato?.produto) {
    return { ...vinculoExato.produto, modo: 'codigo_original' as const }
  }

  const alvoNorm = normalizarCodigoOriginalComparacao(codigoLimpo)
  if (!alvoNorm) return null

  // Match tolerante: cProd com pontos vs codigoFornecedor sem pontos (e vice-versa).
  const candidatos = await clientePrisma.produtoFornecedor.findMany({
    where: {
      fornecedorPessoaId,
      codigoFornecedor: { not: null },
      produto: { companyId, ativo: true },
    },
    select: {
      codigoFornecedor: true,
      produto: { select: selectProduto },
    },
    take: 2000,
  })

  for (const c of candidatos) {
    const cadastro = (c.codigoFornecedor ?? '').trim()
    if (!cadastro) continue
    if (normalizarCodigoOriginalComparacao(cadastro) === alvoNorm && c.produto) {
      return { ...c.produto, modo: 'codigo_original' as const }
    }
  }

  return null
}

async function listarPedidosAbertosFornecedor(
  companyId: string,
  fornecedorPessoaIds: string | string[]
) {
  const ids = Array.isArray(fornecedorPessoaIds)
    ? [...new Set(fornecedorPessoaIds.filter(Boolean))]
    : [fornecedorPessoaIds]
  if (ids.length === 0) return []

  return clientePrisma.pedidoCompra.findMany({
    where: {
      companyId,
      fornecedorPessoaId: { in: ids },
      status: { in: ['enviado', 'aprovado', 'parcial'] },
    },
    include: {
      fornecedor: { select: { id: true, nome: true } },
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
      fornecedor: { select: { id: true, nome: true } },
      itens: {
        include: { produto: { select: { id: true, nomeVenda: true } } },
      },
    },
  })
}

/** Leve — só o campo necessário para decidir o status pós-lançamento (revenda x demais). */
async function buscarTipoCompraPedido(pedidoId: string) {
  return clientePrisma.pedidoCompra.findUnique({
    where: { id: pedidoId },
    select: { tipoCompra: true },
  })
}

async function atualizarStatusPedidoCompra(pedidoCompraId: string, status: string) {
  return clientePrisma.pedidoCompra.update({
    where: { id: pedidoCompraId },
    data: { status },
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

/** Códigos do vínculo produto×fornecedor (chave = produtoId). */
async function mapaCodigoOriginalPorProduto(
  fornecedorPessoaId: string,
  produtoIds: string[]
): Promise<Map<string, string>> {
  const ids = [...new Set(produtoIds.filter(Boolean))]
  if (ids.length === 0) return new Map()

  const vinculos = await clientePrisma.produtoFornecedor.findMany({
    where: {
      fornecedorPessoaId,
      produtoId: { in: ids },
    },
    select: { produtoId: true, codigoFornecedor: true },
  })

  return new Map(
    vinculos.map((v) => [v.produtoId, (v.codigoFornecedor ?? '').trim()])
  )
}

/**
 * Para cada código de CFOP da NF, busca o CFOP cadastrado da empresa com esse código
 * e devolve o CFOP de entrada que ele sugere (`Cfop.cfopSugestaoEntradaId`).
 * Aceita código da NF sem ponto (`6102`) e do cadastro com ponto (`6.102`).
 * Chaves do mapa = todas as variantes, para `Map.get(item.cfop)` funcionar nos dois formatos.
 */
async function mapaSugestaoCfopEntradaPorCodigo(
  companyId: string,
  codigos: string[],
  opcoes?: { somenteConhecimentoFrete?: boolean }
): Promise<Map<string, { id: string; codigo: string; nome: string }>> {
  const unicos = [...new Set(codigos.filter(Boolean))]
  if (unicos.length === 0) return new Map()

  const variantesBusca = [...new Set(unicos.flatMap((c) => variantesCodigoCfopParaBusca(c)))]

  const cfops = await clientePrisma.cfop.findMany({
    where: { companyId, codigo: { in: variantesBusca } },
    select: {
      codigo: true,
      cfopSugestaoEntrada: {
        select: { id: true, codigo: true, nome: true, subtipoCfop: true },
      },
    },
  })

  const mapa = new Map<string, { id: string; codigo: string; nome: string }>()
  for (const c of cfops) {
    const sugestao = c.cfopSugestaoEntrada
    if (!sugestao) continue
    if (
      opcoes?.somenteConhecimentoFrete &&
      !cfopEhConhecimentoFrete(sugestao.subtipoCfop)
    ) {
      continue
    }
    const valor = {
      id: sugestao.id,
      codigo: sugestao.codigo,
      nome: sugestao.nome,
    }
    for (const chave of variantesCodigoCfopParaBusca(c.codigo)) {
      mapa.set(chave, valor)
    }
  }
  return mapa
}

/** Valida que o CFOP escolhido manualmente pertence à empresa, está ativo e é de entrada/importação. */
async function buscarCfopEntradaAtivo(companyId: string, cfopId: string) {
  return clientePrisma.cfop.findFirst({
    where: {
      id: cfopId,
      companyId,
      ativo: true,
      natureza: { in: ['entrada', 'importacao'] },
    },
    select: { id: true, codigo: true, nome: true, subtipoCfop: true },
  })
}

/** CFOP de entrada válido para CT-e: ativo, entrada/importação e Conhecimento de frete. */
async function buscarCfopEntradaCteAtivo(companyId: string, cfopId: string) {
  return clientePrisma.cfop.findFirst({
    where: {
      id: cfopId,
      companyId,
      ativo: true,
      natureza: { in: ['entrada', 'importacao'] },
      subtipoCfop: SUBTIPO_CFOP_CONHECIMENTO_FRETE,
    },
    select: { id: true, codigo: true, nome: true, subtipoCfop: true },
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

/** Preenche unidade (uCom) em itens já gravados sem sobrescrever vínculos. */
async function backfillUnidadeItensDoXml(nfeRecebidaId: string, itensXml: ItemXmlNfe[]) {
  const mapa = new Map(
    itensXml.map((item) => {
      const unidade = item.unidade?.trim()
      return [item.nItem, unidade || null] as const
    })
  )
  const itensSemUnidade = await clientePrisma.nfeRecebidaItem.findMany({
    where: { nfeRecebidaId, unidade: null },
    select: { id: true, nItem: true },
  })
  for (const item of itensSemUnidade) {
    const unidade = mapa.get(item.nItem)
    if (!unidade) continue
    await clientePrisma.nfeRecebidaItem.update({
      where: { id: item.id },
      data: { unidade },
    })
  }
}

/** Notas em aberto cujo emitente bate com o documento (normalizado A-Z/0-9). */
async function listarNotasPendentesPorDocumento(companyId: string, documento: string) {
  const limpo = normalizarDocumento(documento)
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
    .filter((n) => normalizarDocumento(n.documentoEmitente ?? '') === limpo)
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
    select: { id: true, documentoEmitente: true, tipoDocumento: true },
    orderBy: { createdAt: 'asc' },
  })
}

export const repositorioEntradaNotas = {
  buscarNotaCompleta,
  buscarFlagsFornecedorEntrada,
  buscarNotaPorId,
  substituirItensDoXml,
  backfillUnidadeItensDoXml,
  atualizarNota,
  atualizarItem,
  criarTratativa,
  listarTratativas,
  buscarFornecedorPorCnpj,
  buscarProdutoPorGtin,
  buscarProdutoPorCodigoOriginal,
  listarPedidosAbertosFornecedor,
  buscarPedidoComItens,
  buscarTipoCompraPedido,
  atualizarStatusPedidoCompra,
  buscarUltimoPrecoConsolidadoPorProduto,
  somarConsolidadoPorProduto,
  criarAnexoDivergencia,
  criarAnexoEntradaNota,
  buscarAnexoEntradaNota,
  gravarCodigoOriginalVinculo,
  mapaCodigoOriginalPorProduto,
  atualizarFiscalProduto,
  mapaSugestaoCfopEntradaPorCodigo,
  buscarCfopEntradaAtivo,
  buscarCfopEntradaCteAtivo,
  contarItens,
  listarNotasPendentesPorDocumento,
  listarNotasPendentesSemFornecedor,
}
