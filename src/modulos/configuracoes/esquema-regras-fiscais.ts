import { z } from 'zod'

const aliquota = z.preprocess((valor) => {
  if (valor == null || valor === '') return null
  if (typeof valor !== 'string' && typeof valor !== 'number') return Number.NaN
  return typeof valor === 'string' ? valor.trim().replace(',', '.') || null : valor
}, z.coerce.number().finite().min(0, 'Alíquota deve ser entre 0 e 100').max(100, 'Alíquota deve ser entre 0 e 100').nullable())

export const esquemaRegraCredito = z.object({
  modo: z.enum(['nota', 'pre_definida']),
  aliquota,
}).superRefine((regra, ctx) => {
  if (regra.modo === 'pre_definida' && regra.aliquota == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['aliquota'], message: 'Informe a alíquota pré-definida' })
  }
}).transform((regra) => ({ ...regra, aliquota: regra.modo === 'nota' ? null : regra.aliquota }))

export const esquemaRegrasFiscais = z.object({
  mercadoria: esquemaRegraCredito,
  transporte: esquemaRegraCredito,
  baseIcms: z.enum(['bruto', 'liquido', 'vbc']).optional(),
  operacoes: z.array(z.object({
    cfopEntradaId: z.string().uuid(),
    cfopCodigo: z.string().max(10).optional(),
    cfopNome: z.string().max(200).optional(),
    tributo: z.enum(['icms', 'icms_st', 'fcp_st', 'ipi', 'ii', 'pis', 'cofins', 'icms_frete']),
    cst: z.string().trim().regex(/^(\d{2,3}|sem_cst)$/, 'Informe CST/CSOSN ou sem_cst para II'),
    recuperabilidade: z.enum(['aplicavel', 'nao_aplicavel', 'revisao']),
    composicao: z.enum(['embutido', 'adicional']),
  }).strict()).max(2000).optional(),
}).strict().superRefine((regras, ctx) => {
  const vistos = new Set<string>()
  for (const [i, r] of (regras.operacoes ?? []).entries()) {
    const chave = `${r.cfopEntradaId}:${r.tributo}:${r.cst}`
    if (vistos.has(chave)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['operacoes', i], message: 'Regra fiscal duplicada para CFOP, tributo e CST/CSOSN' })
    vistos.add(chave)
    if (['icms', 'pis', 'cofins', 'icms_frete'].includes(r.tributo) && r.composicao !== 'embutido') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['operacoes', i, 'composicao'], message: 'Este tributo integra o valor comercial; não pode ser somado novamente' })
    }
  }
})

export type RegraCredito = z.infer<typeof esquemaRegraCredito>
export type RegrasFiscais = z.infer<typeof esquemaRegrasFiscais>

export function regrasFiscaisPadrao(): RegrasFiscais {
  return { mercadoria: { modo: 'nota', aliquota: null }, transporte: { modo: 'nota', aliquota: null } }
}
