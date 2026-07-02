/**
 * Validação dos dados de plano financeiro.
 */
import { z } from 'zod'

const tipoPlano = z.enum(['receita', 'despesa', 'resultado'])

export const esquemaDeCriacaoDePlanoFinanceiro = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  tipo: tipoPlano,
  classificacao: z.string().trim().max(100).optional().or(z.literal('')),
  parentId: z.string().uuid().optional().nullable(),
  codigo: z.string().trim().max(50).optional(),
  mostrarNaDre: z.boolean().optional().default(true),
  permiteLancamentoManual: z.boolean().optional().default(false),
  exigeAnexoLancamento: z.boolean().optional().default(false),
  permiteUsoConsumo: z.boolean().optional().default(false),
})

export const esquemaDeEdicaoDePlanoFinanceiro = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  classificacao: z.string().trim().max(100).optional().or(z.literal('')),
  mostrarNaDre: z.boolean(),
  permiteLancamentoManual: z.boolean(),
  exigeAnexoLancamento: z.boolean(),
  permiteUsoConsumo: z.boolean(),
})

export const esquemaDeAtivarPlanoFinanceiro = z.object({
  ativo: z.boolean(),
})

export const esquemaDeMoverPlanoFinanceiro = z.object({
  alvoId: z.string().uuid('alvoId inválido'),
  posicao: z.enum(['antes', 'depois', 'dentro']),
})

export type DadosParaCriarPlanoFinanceiro = z.infer<typeof esquemaDeCriacaoDePlanoFinanceiro>
export type DadosParaEditarPlanoFinanceiro = z.infer<typeof esquemaDeEdicaoDePlanoFinanceiro>
export type DadosParaMoverPlanoFinanceiro = z.infer<typeof esquemaDeMoverPlanoFinanceiro>
