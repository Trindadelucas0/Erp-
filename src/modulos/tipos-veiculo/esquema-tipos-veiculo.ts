import { z } from 'zod'

const nome = z
  .string({ required_error: 'Nome é obrigatório' })
  .trim()
  .min(2, 'Nome deve ter pelo menos 2 caracteres')
  .max(80, 'Nome deve ter no máximo 80 caracteres')

const pesoMaximoKg = z.coerce
  .number({
    required_error: 'Peso máximo é obrigatório',
    invalid_type_error: 'Peso máximo deve ser um número',
  })
  .int('Peso máximo deve ser um número inteiro em kg')
  .min(1, 'Peso máximo deve ser maior que zero')
  .max(999999, 'Peso máximo deve ser no máximo 999.999 kg')

export const ICONES_TIPO_VEICULO = ['caminhao', 'carro', 'utilitario', 'moto'] as const

const icone = z
  .enum(ICONES_TIPO_VEICULO, { errorMap: () => ({ message: 'Ícone inválido' }) })
  .nullable()

export const esquemaDeCriacaoDeTipoVeiculo = z.object({
  nome,
  pesoMaximoKg,
  icone: icone.optional().default(null),
  ativo: z.boolean().optional().default(true),
})

export const esquemaDeEdicaoDeTipoVeiculo = z.object({
  nome,
  pesoMaximoKg,
  icone: icone.optional(),
  ativo: z.boolean(),
})

export const esquemaDeAtivarTipoVeiculo = z.object({
  ativo: z.boolean(),
})

export const esquemaFiltroListagemTiposVeiculo = z.object({
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

export type DadosParaCriarTipoVeiculo = z.infer<typeof esquemaDeCriacaoDeTipoVeiculo>
export type DadosParaEditarTipoVeiculo = z.infer<typeof esquemaDeEdicaoDeTipoVeiculo>
