import { z } from 'zod'

const valorPositivo = z.coerce
  .number({ invalid_type_error: 'Valor inválido' })
  .positive('Valor deve ser maior que zero')
  .finite('Valor inválido')

export const competenciaYm = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Competência deve ser AAAA-MM')

export const esquemaPeriodicidade = z.enum(['mensal', 'anual'], {
  errorMap: () => ({ message: 'Periodicidade deve ser mensal ou anual' }),
})

export const esquemaDiaVencimento = z.coerce
  .number({ invalid_type_error: 'Dia de vencimento inválido' })
  .int('Dia de vencimento deve ser um número inteiro')
  .min(1, 'Dia de vencimento deve ser entre 1 e 28')
  .max(28, 'Dia de vencimento deve ser entre 1 e 28')

const competenciaFimOpcional = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  competenciaYm.nullable()
)

function refinarVigencia(
  dados: { competenciaInicio: string; competenciaFim: string | null },
  ctx: z.RefinementCtx
) {
  if (dados.competenciaFim && dados.competenciaFim < dados.competenciaInicio) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Competência fim não pode ser anterior ao início',
      path: ['competenciaFim'],
    })
  }
}

const camposRecorrencia = {
  fornecedorPessoaId: z.string().uuid('Fornecedor inválido'),
  valor: valorPositivo,
  periodicidade: esquemaPeriodicidade,
  diaVencimento: esquemaDiaVencimento,
  competenciaInicio: competenciaYm,
  competenciaFim: competenciaFimOpcional,
}

export const esquemaDeCriacaoDeRecorrencia = z
  .object({
    ...camposRecorrencia,
    ativo: z.boolean().optional().default(true),
  })
  .superRefine(refinarVigencia)

export const esquemaDeEdicaoDeRecorrencia = z
  .object({
    ...camposRecorrencia,
    ativo: z.boolean(),
  })
  .superRefine(refinarVigencia)

export const esquemaDeAtivarRecorrencia = z.object({
  ativo: z.boolean(),
})

export const esquemaFiltroListagemRecorrencias = z.object({
  q: z.string().trim().optional(),
  incluirInativos: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true'),
  fornecedorPessoaId: z.string().uuid().optional(),
})

export const esquemaFiltroAgenda = z.object({
  competencia: competenciaYm,
})

export type DadosParaCriarRecorrencia = z.infer<typeof esquemaDeCriacaoDeRecorrencia>
export type DadosParaEditarRecorrencia = z.infer<typeof esquemaDeEdicaoDeRecorrencia>
