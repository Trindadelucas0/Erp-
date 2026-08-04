import { z } from 'zod'

export const esquemaAjusteInventario = z
  .object({
    quantidadeNova: z.number().finite().optional(),
    delta: z.number().finite().optional(),
    observacao: z
      .string({ required_error: 'Observação é obrigatória' })
      .trim()
      .min(1, 'Observação é obrigatória'),
    fornecedorPessoaId: z.string().uuid().optional().nullable(),
    /** Snapshot na linha: número, null explícito, ou omitido (= usa Produto.precoCusto) */
    precoCusto: z.number().finite().nonnegative().nullable().optional(),
  })
  .refine(
    (dados) => dados.quantidadeNova != null || dados.delta != null,
    { message: 'Informe quantidadeNova ou delta' }
  )

export type DadosAjusteInventario = z.infer<typeof esquemaAjusteInventario>
