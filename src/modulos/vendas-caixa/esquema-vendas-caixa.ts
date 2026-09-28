import { z } from 'zod'

export const MSG_PAGAMENTO_INCOMPLETO =
  'Informe o cliente e ao menos um produto com quantidade.'

export const esquemaConfirmarPagamento = z.object({
  clienteNome: z.string().trim().min(1, MSG_PAGAMENTO_INCOMPLETO),
  itens: z
    .array(
      z.object({
        produtoId: z.string().uuid('Produto não encontrado'),
        quantidade: z.coerce.number().positive(MSG_PAGAMENTO_INCOMPLETO),
      })
    )
    .min(1, MSG_PAGAMENTO_INCOMPLETO),
})

export type DadosConfirmarPagamento = z.infer<typeof esquemaConfirmarPagamento>
