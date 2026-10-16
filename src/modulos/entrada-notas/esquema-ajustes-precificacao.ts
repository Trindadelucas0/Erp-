import { z } from 'zod'

const valor = z.number().finite().min(0).max(1e12)
const percentual = z.number().finite().min(0).max(100)
export const esquemaAjustesPrecificacao = z.object({
  precoTabela: valor.optional(), descontoPercentual: percentual.optional(), descontoDestaquePercentual: percentual.optional(),
  ipiPercentual: percentual.optional(), outrasPercentual: percentual.optional(),
  fretePercentual: percentual.optional(), freteValor: valor.optional(),
  tipoFrete: z.enum(['0', '1', '2', '3', '4', '9']).optional(), transporteSimples: z.boolean().nullable().optional(),
  tipoSt: z.enum(['sem', 'nota', 'adicional']).optional(), stPercentual: percentual.optional(),
  creditoIcmsPercentual: percentual.optional(), creditoIcmsFretePercentual: percentual.optional(), pisCofinsPercentual: percentual.optional(),
  adicionalPercentual: percentual.optional(), adicionalValor: valor.optional(),
}).strict().refine(a => a.fretePercentual == null || a.freteValor == null, 'Informe frete em percentual ou reais.')
  .refine(a => a.adicionalPercentual == null || a.adicionalValor == null, 'Informe custo adicional em percentual ou reais.')

export const esquemaSimularPrecificacao = z.object({
  itemId: z.string().uuid(), ajustes: esquemaAjustesPrecificacao,
  margemPercentual: z.number().finite(), margemAtacado: z.number().finite().nullable(),
}).strict()
