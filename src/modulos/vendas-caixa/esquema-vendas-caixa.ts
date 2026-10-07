import { z } from 'zod'

export const MSG_PAGAMENTO_INCOMPLETO =
  'Informe o cliente e ao menos um produto com quantidade.'

export const MSG_FORMA_ORIGEM_INVALIDA = 'Forma de pagamento não permitida nesta origem.'

export const MSG_CHAMADO_JA_RECEBIDO = 'Este chamado já foi recebido.'

export const FORMAS_PAGAMENTO = [
  'dinheiro',
  'pix',
  'cartao_credito',
  'cartao_debito',
  'boleto',
] as const

export const FORMAS_TOTEM = [
  'pix',
  'cartao_credito',
  'cartao_debito',
  'boleto',
] as const

export const ORIGENS_PAGAMENTO = ['totem', 'caixa'] as const

export const STATUS_VENDA_PAGA = 'paga' as const
export const STATUS_CHAMADO_ATENDENTE = 'chamado_atendente' as const

const esquemaItem = z.object({
  produtoId: z.string().uuid('Produto não encontrado'),
  quantidade: z.coerce.number().positive(MSG_PAGAMENTO_INCOMPLETO),
})

export const esquemaClienteItens = z.object({
  clienteNome: z.string().trim().min(1, MSG_PAGAMENTO_INCOMPLETO),
  itens: z.array(esquemaItem).min(1, MSG_PAGAMENTO_INCOMPLETO),
})

export const esquemaConfirmarPagamento = esquemaClienteItens.extend({
  formaPagamento: z.enum(FORMAS_PAGAMENTO, {
    errorMap: () => ({ message: MSG_FORMA_ORIGEM_INVALIDA }),
  }),
  origem: z.enum(ORIGENS_PAGAMENTO, {
    errorMap: () => ({ message: MSG_FORMA_ORIGEM_INVALIDA }),
  }),
})

export const esquemaChamarAtendente = esquemaClienteItens

export const esquemaConfirmarChamado = z.object({
  formaPagamento: z.enum(FORMAS_PAGAMENTO, {
    errorMap: () => ({ message: MSG_FORMA_ORIGEM_INVALIDA }),
  }),
})

export type DadosConfirmarPagamento = z.infer<typeof esquemaConfirmarPagamento>
export type DadosChamarAtendente = z.infer<typeof esquemaChamarAtendente>
export type DadosConfirmarChamado = z.infer<typeof esquemaConfirmarChamado>
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]
export type OrigemPagamento = (typeof ORIGENS_PAGAMENTO)[number]
