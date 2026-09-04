import { z } from 'zod'

export const NIVEIS_ESTRUTURA_WMS = ['area', 'tipo', 'rua', 'andar'] as const
export type NivelEstruturaWms = (typeof NIVEIS_ESTRUTURA_WMS)[number]

const nivelWms = z.enum(NIVEIS_ESTRUTURA_WMS)

export const esquemaFiltroListagemEstruturaWms = z.object({
  nivel: nivelWms.optional().or(z.literal('')),
  incluirInativos: z.enum(['true', 'false']).optional(),
})

export const esquemaDeCriacaoDeNivelWms = z.object({
  nivel: nivelWms,
  codigo: z.string().trim().min(1, 'Código obrigatório'),
  nome: z.string().trim().optional().default(''),
  paiCodigo: z.string().trim().optional(),
  ativo: z.boolean().optional().default(true),
})

export const esquemaDeEdicaoDeNivelWms = z.object({
  codigo: z.string().trim().min(1, 'Código obrigatório'),
  nome: z.string().trim().optional().default(''),
  paiCodigo: z.string().trim().optional(),
  ativo: z.boolean(),
})

export type DadosParaCriarNivelWms = z.infer<typeof esquemaDeCriacaoDeNivelWms>
export type DadosParaEditarNivelWms = z.infer<typeof esquemaDeEdicaoDeNivelWms>
