/**
 * Validação dos dados de pedido de compra com Zod.
 */
import { z } from 'zod'
import {
  textoCadastroObrigatorio,
  textoCadastroOpcional,
} from '../../compartilhado/normalizacao/esquema-texto-cadastro.js'

const decimalObrigatorio = z.union([z.number(), z.string()]).transform((v) => {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Valor numérico inválido')
  }
  return n
})

const decimalPositivo = z.union([z.number(), z.string()]).transform((v) => {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Quantidade deve ser maior que zero')
  }
  return n
})

const decimalOpcional = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v == null || v === '') return null
    const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) {
      throw new Error('Valor numérico inválido')
    }
    return n
  })

const dataOpcional = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((v) => {
    if (v == null || v === '') return null
    const d = v instanceof Date ? v : new Date(v)
    if (Number.isNaN(d.getTime())) {
      throw new Error('Data inválida')
    }
    return d
  })

export const esquemaPrazoPagamento = z.object({
  numero: z.number().int().positive(),
  vencimento: z.string().min(1, 'Data de vencimento obrigatória'),
  valor: decimalOpcional,
})

export const esquemaItemPedidoCompra = z.object({
  produtoId: z.string().uuid('Produto inválido'),
  codigoOriginal: textoCadastroOpcional(100).optional().nullable(),
  quantidade: decimalPositivo,
  unidade: z.string().min(1, 'Unidade obrigatória').max(20),
  precoUnitario: decimalObrigatorio,
  percentualDesconto: decimalOpcional,
  valorDesconto: decimalOpcional,
  outrasDespesas: decimalOpcional,
  previsaoEntrega: dataOpcional,
  ordem: z.number().int().optional(),
})

export const MODALIDADES_TRANSPORTE_PEDIDO = ['FOB_NOTA', 'FOB_CONHECIMENTO', 'CIF'] as const

const esquemaModalidadeTransporte = z.enum(MODALIDADES_TRANSPORTE_PEDIDO, {
  required_error: 'Tipo de frete obrigatório',
  invalid_type_error: 'Tipo de frete inválido',
})

function exigeDadosTransporte(modalidade: string): boolean {
  return modalidade === 'FOB_NOTA' || modalidade === 'FOB_CONHECIMENTO'
}

type DadosComTransporte = {
  modalidadeTransporte?: string
  transportadoraPessoaId?: string | null
  valorFrete?: number | null
  valorFreteSugerido?: number | null
}

function validarRegrasTransporte(data: DadosComTransporte, ctx: z.RefinementCtx) {
  if (!data.modalidadeTransporte) return

  if (exigeDadosTransporte(data.modalidadeTransporte) && !data.transportadoraPessoaId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Transportadora obrigatória para frete FOB',
      path: ['transportadoraPessoaId'],
    })
  }
}

function normalizarDadosTransporte<T extends DadosComTransporte>(data: T): T {
  if (data.modalidadeTransporte !== 'CIF') return data

  return {
    ...data,
    transportadoraPessoaId: null,
    valorFrete: null,
    valorFreteSugerido: null,
  }
}

const camposComunsPedido = {
  transportadoraPessoaId: z.string().uuid().optional().nullable(),
  condicaoPagamento: textoCadastroOpcional(200),
  tipoCompra: z.enum(['revenda', 'bonificacao', 'uso_consumo']).optional(),
  dataFaturamento: dataOpcional,
  previsaoEntrega: dataOpcional,
  valorFrete: decimalOpcional,
  valorFreteSugerido: decimalOpcional,
  prazosPagamento: z.array(esquemaPrazoPagamento).optional().nullable(),
  rateioParcelas: z.enum(['igual', 'manual']).optional(),
  observacoes: textoCadastroOpcional(2000),
  observacoesInternas: textoCadastroOpcional(2000),
  descricao: textoCadastroOpcional(120),
  pedidoVendaId: z.string().uuid().optional().nullable(),
  creditoFornecedorId: z.string().uuid().optional().nullable(),
  creditoAplicado: decimalObrigatorio.optional().nullable(),
  concluir: z.boolean().optional(),
}

function esquemaPedidoCompraComTransporte<T extends z.ZodRawShape>(campos: T) {
  return z
    .object(campos)
    .superRefine(validarRegrasTransporte)
    .transform(normalizarDadosTransporte)
}

export const esquemaDeCriacaoDePedidoCompra = esquemaPedidoCompraComTransporte({
  fornecedorPessoaId: z.string().uuid('Fornecedor obrigatório'),
  modalidadeTransporte: esquemaModalidadeTransporte,
  ...camposComunsPedido,
  itens: z.array(esquemaItemPedidoCompra).min(1, 'Adicione ao menos um item'),
})

export const esquemaDeEdicaoDePedidoCompra = esquemaPedidoCompraComTransporte({
  fornecedorPessoaId: z.string().uuid().optional(),
  modalidadeTransporte: esquemaModalidadeTransporte.optional(),
  ...camposComunsPedido,
  itens: z.array(esquemaItemPedidoCompra).min(1).optional(),
})

export const esquemaConferenciaEntrada = z.object({
  condicaoPagamento: textoCadastroOpcional(200),
  transportadoraPessoaId: z.string().uuid().optional().nullable(),
  modalidadeTransporte: textoCadastroOpcional(50),
  itens: z.array(
    z.object({
      produtoId: z.string().uuid(),
      precoUnitario: decimalObrigatorio,
    })
  ),
})

export const esquemaCancelarPedidoCompra = z.object({
  motivo: textoCadastroObrigatorio(3, 500),
})

export const esquemaCompararPdf = z.object({
  base64Pdf: z.string().min(100, 'PDF inválido'),
})

export type DadosParaCriarPedidoCompra = z.infer<typeof esquemaDeCriacaoDePedidoCompra>
export type DadosParaEditarPedidoCompra = z.infer<typeof esquemaDeEdicaoDePedidoCompra>
export type DadosConferenciaEntrada = z.infer<typeof esquemaConferenciaEntrada>
export type DadosCancelarPedidoCompra = z.infer<typeof esquemaCancelarPedidoCompra>
export type DadosCompararPdf = z.infer<typeof esquemaCompararPdf>
export type PrazoPagamento = z.infer<typeof esquemaPrazoPagamento>
