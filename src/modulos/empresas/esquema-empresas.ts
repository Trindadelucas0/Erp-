/**
 * Validação dos dados de empresa com Zod.
 */
import { z } from 'zod'

export const esquemaDeCriacaoDeEmpresa = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cnpj: z.string().min(14, 'CNPJ inválido'),
})

export const esquemaDeEdicaoDeEmpresa = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cnpj: z.string().min(14, 'CNPJ inválido'),
})

export const esquemaDeAtivarEmpresa = z.object({
  ativo: z.boolean(),
})

export type DadosParaCriarEmpresa = z.infer<typeof esquemaDeCriacaoDeEmpresa>
export type DadosParaEditarEmpresa = z.infer<typeof esquemaDeEdicaoDeEmpresa>
