import { z } from 'zod'

const tiposCfop = z.enum(['01', '02', '03', '04', '05', '06'])

export const esquemaDeCriacaoDeCfop = z.object({
  codigo: z.string().trim().min(1, 'Código obrigatório').max(20),
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  descricao: z.string().trim().max(2000).optional().or(z.literal('')),
  tipoCfop: tiposCfop,
})

export const esquemaDeEdicaoDeCfop = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  descricao: z.string().trim().max(2000).optional().or(z.literal('')),
  tipoCfop: tiposCfop,
})

export const esquemaDeAtivarCfop = z.object({
  ativo: z.boolean(),
})

export type DadosParaCriarCfop = z.infer<typeof esquemaDeCriacaoDeCfop>
export type DadosParaEditarCfop = z.infer<typeof esquemaDeEdicaoDeCfop>

export const ROTULOS_TIPO_CFOP: Record<string, string> = {
  '01': '01 - Entrada',
  '02': '02 - Transferência',
  '03': '03 - Conhecimento frete',
  '04': '04 - Devolução de compra',
  '05': '05 - Devolução de venda',
  '06': '06 - Doação',
}

export function tipoLegadoDeCfop(tipoCfop: string): string {
  if (tipoCfop === '05') return 'saida'
  if (tipoCfop === '01' || tipoCfop === '04' || tipoCfop === '06') return 'entrada'
  return 'entrada'
}
