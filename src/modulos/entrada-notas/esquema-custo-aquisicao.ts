import { z } from 'zod'

export const esquemaAjustesCusto = z.object({
  exclusoesXml: z.array(z.object({ nItem: z.number().int().positive(), campo: z.enum(['seguro', 'outras']) }).strict()).max(2000).optional(),
  decisaoFrete: z.enum(['distintos', 'nfe', 'cte']).nullable().default(null),
  bases: z.array(z.object({ nItem: z.number().int().positive(), peso: z.number().finite().positive().nullable(), volume: z.number().finite().positive().nullable() }).strict()).max(1000).default([]),
  despesas: z.array(z.object({
    id: z.string().uuid(), descricao: z.string().trim().min(1).max(200), valor: z.number().finite().positive().max(1e12).multipleOf(0.01, 'Informe o valor em centavos'),
    compoeCusto: z.boolean(), nItem: z.number().int().positive().nullable(),
    criterio: z.enum(['valor', 'quantidade', 'peso', 'volume']),
    origem: z.enum(['externa', 'residual_frete', 'residual_seguro', 'residual_outras']).default('externa'),
  }).strict()).max(200).default([]),
}).strict().superRefine((ajustes, ctx) => {
  if (new Set(ajustes.bases.map(b => b.nItem)).size !== ajustes.bases.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bases'], message: 'Base duplicada para o item' })
  if (new Set(ajustes.despesas.map(d => d.id)).size !== ajustes.despesas.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['despesas'], message: 'Despesa duplicada' })
})
export type AjustesCusto = z.infer<typeof esquemaAjustesCusto>
export const ajustesCustoVazios = (): AjustesCusto => ({ decisaoFrete: null, bases: [], despesas: [] })
export const esquemaSalvarAjustes = z.object({ revisao: z.string().min(1), ajustes: esquemaAjustesCusto }).strict()
export const esquemaConfirmarCusto = z.object({ revisao: z.string().min(1), itemIds: z.array(z.string().uuid()).min(1).max(1000) }).strict()
