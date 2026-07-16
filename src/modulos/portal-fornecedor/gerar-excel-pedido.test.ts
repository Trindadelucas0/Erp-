import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { gerarExcelPedidoCompra } from './gerar-excel-pedido.js'
import type { PedidoCompraView } from '../pedidos-compra/repositorio-pedidos-compra.js'

const PRECO_UNITARIO_SENTINELA = 987.65
const TOTAL_SENTINELA = 9876.5

const pedidoBase: PedidoCompraView = {
  id: '1',
  numero: 42,
  descricao: null,
  fornecedorPessoaId: 'f1',
  fornecedorNome: 'Fornecedor ABC Ltda',
  transportadoraPessoaId: null,
  transportadoraNome: null,
  modalidadeTransporte: 'CIF',
  condicaoPagamento: '30 dias',
  tipoCompra: 'revenda',
  dataFaturamento: null,
  previsaoEntrega: null,
  valorFrete: null,
  valorFreteSugerido: null,
  prazosPagamento: null,
  rateioParcelas: 'igual',
  status: 'rascunho',
  motivoCancelamento: null,
  observacoes: null,
  observacoesInternas: null,
  copiadoDeId: null,
  creditoFornecedorId: null,
  creditoAplicado: null,
  totalPedido: TOTAL_SENTINELA,
  totalLiquido: TOTAL_SENTINELA,
  itens: [
    {
      id: 'i1',
      produtoId: 'p1',
      produtoNome: 'Produto X',
      produtoSku: 'SKU001',
      produtoMarca: 'Marca X',
      produtoAtivo: true,
      produtoCodigoBarras: '7891234567890',
      produtoCodigoOrigem: null,
      produtoFotoArquivo: null,
      codigoOriginal: 'COD-ORIG-1',
      quantidade: 10,
      unidade: 'UN',
      precoUnitario: PRECO_UNITARIO_SENTINELA,
      percentualDesconto: null,
      valorDesconto: null,
      outrasDespesas: null,
      total: TOTAL_SENTINELA,
      totalLiquido: TOTAL_SENTINELA,
      previsaoEntrega: null,
      ordem: 0,
    },
  ],
  portalLiberadoEm: null,
  portalBloqueadoEm: null,
  anexosFornecedor: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}

async function lerPlanilha(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  return workbook.worksheets[0]
}

describe('gerarExcelPedidoCompra', () => {
  it('não inclui preço unitário, total do item nem total do pedido em nenhuma célula', async () => {
    const buffer = await gerarExcelPedidoCompra(pedidoBase)
    const planilha = await lerPlanilha(buffer)

    const valoresDaPlanilha: unknown[] = []
    planilha.eachRow((linha) => {
      linha.eachCell((celula) => valoresDaPlanilha.push(celula.value))
    })

    expect(valoresDaPlanilha).not.toContain(PRECO_UNITARIO_SENTINELA)
    expect(valoresDaPlanilha).not.toContain(TOTAL_SENTINELA)
    expect(valoresDaPlanilha.some((v) => typeof v === 'string' && /preço|total/i.test(v))).toBe(false)
  })

  it('mantém código de barras, código original, produto, unidade e quantidade', async () => {
    const buffer = await gerarExcelPedidoCompra(pedidoBase)
    const planilha = await lerPlanilha(buffer)

    const linhaCabecalho = planilha.getRow(7).values as unknown[]
    expect(linhaCabecalho).toEqual([
      undefined,
      'Código de barras',
      'Código original',
      'Produto',
      'Unidade',
      'Quantidade',
    ])

    const linhaItem = planilha.getRow(8).values as unknown[]
    expect(linhaItem).toEqual([
      undefined,
      '7891234567890',
      'COD-ORIG-1',
      'Produto X',
      'UN',
      10,
    ])
  })
})
