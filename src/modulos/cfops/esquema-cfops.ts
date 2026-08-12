import { z } from 'zod'
import { SUBTIPOS_CFOP } from './classificacao-cfop.js'

const codigoCfop = z
  .string()
  .trim()
  .regex(
    /^[123567]\.\d{3}$/,
    'Código deve ter 4 dígitos no formato X.XXX, começando com 1, 2, 3, 5, 6 ou 7'
  )

const subtipoCfop = z.enum(['03', '04', '05', '06']).optional().nullable()

export const esquemaDeCriacaoDeCfop = z.object({
  codigo: codigoCfop,
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  descricao: z.string().trim().max(2000).optional().or(z.literal('')),
  subtipoCfop,
  aproveitarCreditoIcms: z.boolean().optional().default(false),
  cfopSugestaoEntradaId: z.string().uuid().optional().nullable(),
  planoFinanceiroPadraoId: z.string().uuid().optional().nullable(),
})

export const esquemaDeEdicaoDeCfop = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  descricao: z.string().trim().max(2000).optional().or(z.literal('')),
  subtipoCfop,
  aproveitarCreditoIcms: z.boolean().optional().default(false),
  cfopSugestaoEntradaId: z.string().uuid().optional().nullable(),
  planoFinanceiroPadraoId: z.string().uuid().optional().nullable(),
})

export type DadosParaCriarCfop = z.infer<typeof esquemaDeCriacaoDeCfop>
export type DadosParaEditarCfop = z.infer<typeof esquemaDeEdicaoDeCfop>

export {
  ROTULOS_SUBTIPO_CFOP,
  SUBTIPOS_CFOP,
  SUBTIPO_CFOP_CONHECIMENTO_FRETE,
  cfopEhConhecimentoFrete,
} from './classificacao-cfop.js'

export function subtipoCfopValido(valor: string | null | undefined): boolean {
  if (!valor) return true
  return (SUBTIPOS_CFOP as readonly string[]).includes(valor)
}
