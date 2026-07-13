/**
 * Validação Zod do pedido de venda (MVP).
 */
import { z } from 'zod'
import { textoCadastroObrigatorio, textoCadastroOpcional } from '../../compartilhado/normalizacao/esquema-texto-cadastro.js'

const decimalPositivo = z.union([z.number(), z.string()]).transform((v) => {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Quantidade deve ser maior que zero')
  }
  return n
})

const decimalObrigatorio = z.union([z.number(), z.string()]).transform((v) => {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Valor numérico inválido')
  }
  return n
})

export const esquemaItemPedidoVenda = z.object({
  produtoId: z.string().uuid('Produto inválido'),
  modoQuantidade: z.enum(['UN', 'CX']),
  quantidadeInformada: decimalPositivo,
  /** Sempre preço unitário (UN de venda). Em CX o front converte caixa→UN antes de enviar. */
  precoUnitario: decimalObrigatorio,
  ordem: z.number().int().optional(),
})

const camposPedido = {
  clienteNome: textoCadastroObrigatorio(2, 200),
  observacoes: textoCadastroOpcional(2000).optional().nullable(),
  sobEncomenda: z.boolean().optional().default(false),
  itens: z.array(esquemaItemPedidoVenda).min(1, 'Informe ao menos um item'),
  concluir: z.boolean().optional().default(false),
}

export const esquemaDeCriacaoDePedidoVenda = z.object(camposPedido)

export const esquemaDeEdicaoDePedidoVenda = z.object(camposPedido)

export type DadosParaCriarPedidoVenda = z.infer<typeof esquemaDeCriacaoDePedidoVenda>
export type DadosParaEditarPedidoVenda = z.infer<typeof esquemaDeEdicaoDePedidoVenda>
export type DadosItemPedidoVenda = z.infer<typeof esquemaItemPedidoVenda>

export function mensagemErroZod(erro: z.ZodError): string {
  return (
    erro.errors
      .map((e) => {
        const campo = e.path.join('.') || 'campo'
        const msg = e.message === 'Invalid input' ? 'valor inválido' : e.message
        return `${campo}: ${msg}`
      })
      .join('; ') || 'Dados inválidos'
  )
}
