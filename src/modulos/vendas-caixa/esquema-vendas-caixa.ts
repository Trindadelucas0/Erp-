import { z } from 'zod'

export const MSG_PAGAMENTO_INCOMPLETO =
  'Informe o cliente e ao menos um produto com quantidade.'

export const MSG_FORMA_ORIGEM_INVALIDA = 'Forma de pagamento não permitida nesta origem.'

export const MSG_CHAMADO_JA_RECEBIDO = 'Este chamado já foi recebido.'

export const MSG_ORCAMENTO_NAO_ENCONTRADO = 'Orçamento não encontrado.'

export const MSG_ORCAMENTO_JA_RECEBIDO = 'Este orçamento já foi recebido.'

export const MSG_VALOR_RECEBIDO_INSUFICIENTE = 'Valor recebido menor que o total do pedido.'

export const MSG_BOLETO_NAO_NO_TOTEM = 'Boleto não está disponível no totem.'

export const MSG_PARCELA_OBRIGATORIA =
  'Informe o número de parcelas para pagamento no cartão de crédito.'

export const MSG_PARCELA_INVALIDA = 'Número de parcelas não disponível para esta empresa.'

export const STATUS_ORCAMENTO_RECEBIVEL = ['enviado', 'aprovado'] as const

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

export const esquemaReceberOrcamento = z
  .object({
    formaPagamento: z.enum(FORMAS_PAGAMENTO, {
      errorMap: () => ({ message: MSG_FORMA_ORIGEM_INVALIDA }),
    }),
    origem: z.enum(ORIGENS_PAGAMENTO, {
      errorMap: () => ({ message: MSG_FORMA_ORIGEM_INVALIDA }),
    }),
    numeroParcelas: z.coerce.number().int().min(1).max(48).optional(),
    valorRecebido: z.coerce.number().finite().optional(),
    observacao: z.string().trim().max(500).optional(),
  })
  .superRefine((dados, ctx) => {
    if (dados.origem === 'totem' && dados.formaPagamento === 'boleto') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MSG_BOLETO_NAO_NO_TOTEM,
        path: ['formaPagamento'],
      })
    }
    if (dados.formaPagamento === 'cartao_credito' && dados.numeroParcelas == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MSG_PARCELA_OBRIGATORIA,
        path: ['numeroParcelas'],
      })
    }
  })

export type DadosConfirmarPagamento = z.infer<typeof esquemaConfirmarPagamento>
export type DadosChamarAtendente = z.infer<typeof esquemaChamarAtendente>
export type DadosConfirmarChamado = z.infer<typeof esquemaConfirmarChamado>
export type DadosReceberOrcamento = z.infer<typeof esquemaReceberOrcamento>
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]
export type OrigemPagamento = (typeof ORIGENS_PAGAMENTO)[number]
