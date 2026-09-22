import { z } from 'zod'

export const esquemaDeCriacaoDeAdquirente = z.object({
  nome: z
    .string({ required_error: 'Nome é obrigatório' })
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(80, 'Nome deve ter no máximo 80 caracteres'),
  ativo: z.boolean().optional().default(true),
})

export const esquemaDeEdicaoDeAdquirente = z.object({
  nome: z
    .string({ required_error: 'Nome é obrigatório' })
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(80, 'Nome deve ter no máximo 80 caracteres'),
  ativo: z.boolean(),
})

export const esquemaDeAtivarAdquirente = z.object({
  ativo: z.boolean(),
})

export const esquemaFiltroListagemAdquirentes = z.object({
  q: z.string().trim().optional(),
  incluirInativos: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true'),
  somenteAtivos: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true'),
})

export type DadosParaCriarAdquirente = z.infer<typeof esquemaDeCriacaoDeAdquirente>
export type DadosParaEditarAdquirente = z.infer<typeof esquemaDeEdicaoDeAdquirente>
