import { z } from 'zod'

export const BANCOS_BOLETO = [
  'itau',
  'bradesco',
  'banco_do_brasil',
  'santander',
  'sicoob',
  'c6',
] as const

export const AMBIENTES_BOLETO = ['producao', 'homologacao'] as const

export type CodigoBancoBoleto = (typeof BANCOS_BOLETO)[number]
export type AmbienteBoleto = (typeof AMBIENTES_BOLETO)[number]

const decimalOpcional = z.preprocess((valor) => {
  if (valor === '' || valor === undefined || valor === null) return null
  return valor
}, z.coerce.number({ invalid_type_error: 'Valor inválido' }).finite('Valor inválido').nullable())

const inteiroOpcional = z.preprocess((valor) => {
  if (valor === '' || valor === undefined || valor === null) return null
  return valor
}, z.coerce.number({ invalid_type_error: 'Número inválido' }).int('Informe um número inteiro').nullable())

const percentualOpcional = z.preprocess((valor) => {
  if (valor === '' || valor === undefined || valor === null) return null
  return valor
}, z.coerce
  .number({ invalid_type_error: 'Percentual inválido' })
  .finite('Percentual inválido')
  .min(0, 'Percentual deve ser entre 0 e 100')
  .max(100, 'Percentual deve ser entre 0 e 100')
  .nullable())

export const esquemaNomeParametroBoleto = z
  .string()
  .trim()
  .min(2, 'Nome deve ter pelo menos 2 caracteres')
  .max(80, 'Nome deve ter no máximo 80 caracteres')

const corpoGravarParametrosBoleto = z
  .object({
    nome: esquemaNomeParametroBoleto,
    ativo: z.boolean().optional().default(true),
    padrao: z.boolean().optional().default(false),
    valorMinimo: decimalOpcional,
    valorMaximo: decimalOpcional,
    prazoMedioMaximoDias: inteiroOpcional,
    permitirParcelamento: z.boolean(),
    quantidadeMaximaParcelas: inteiroOpcional,
    multaAtrasoPercentual: percentualOpcional,
    jurosAtrasoPercentualDia: percentualOpcional,
    permitirPagamentoAposVencimento: z.boolean(),
    diasMaximosAposVencimento: inteiroOpcional,
    negativarAutomaticamente: z.boolean(),
    diasParaNegativar: inteiroOpcional,
    banco: z.enum(BANCOS_BOLETO).nullable().optional(),
    ambiente: z.enum(AMBIENTES_BOLETO).nullable().optional(),
    tipoIntegracao: z.literal('api').optional().default('api'),
    urlApi: z
      .string()
      .trim()
      .nullable()
      .optional()
      .transform((v) => (v === '' || v == null ? null : v)),
    clientId: z
      .string()
      .trim()
      .nullable()
      .optional()
      .transform((v) => (v === '' || v == null ? null : v)),
    clientSecret: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v === '' || v == null ? null : v.trim())),
    certificadoBase64: z.string().nullable().optional(),
    certificadoMime: z.string().nullable().optional(),
    certificadoNomeArquivo: z.string().nullable().optional(),
    removerCertificado: z.boolean().optional().default(false),
  })
  .superRefine((dados, ctx) => {
    if (
      dados.valorMinimo != null &&
      dados.valorMaximo != null &&
      dados.valorMinimo >= 0 &&
      dados.valorMaximo >= 0 &&
      dados.valorMaximo <= dados.valorMinimo
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Valor máximo deve ser maior que o valor mínimo',
        path: ['valorMaximo'],
      })
    }

    if (dados.valorMinimo != null && dados.valorMinimo < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Valor mínimo não pode ser negativo',
        path: ['valorMinimo'],
      })
    }

    if (dados.valorMaximo != null && dados.valorMaximo < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Valor máximo não pode ser negativo',
        path: ['valorMaximo'],
      })
    }

    if (dados.permitirParcelamento) {
      if (dados.quantidadeMaximaParcelas == null || dados.quantidadeMaximaParcelas < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe a quantidade máxima de parcelas',
          path: ['quantidadeMaximaParcelas'],
        })
      }
    }

    if (dados.permitirPagamentoAposVencimento) {
      if (dados.diasMaximosAposVencimento == null || dados.diasMaximosAposVencimento < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe os dias máximos após vencimento',
          path: ['diasMaximosAposVencimento'],
        })
      }
    }

    if (dados.negativarAutomaticamente) {
      if (dados.diasParaNegativar == null || dados.diasParaNegativar < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe os dias para negativar',
          path: ['diasParaNegativar'],
        })
      }
    }

    if (dados.urlApi && !dados.urlApi.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'URL da API deve começar com https://',
        path: ['urlApi'],
      })
    }

    if (dados.prazoMedioMaximoDias != null && dados.prazoMedioMaximoDias < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Prazo médio máximo deve ser pelo menos 1 dia',
        path: ['prazoMedioMaximoDias'],
      })
    }
  })

export const esquemaGravarParametrosBoleto = corpoGravarParametrosBoleto.transform(
  (dados) => ({
    ...dados,
    quantidadeMaximaParcelas: dados.permitirParcelamento
      ? dados.quantidadeMaximaParcelas
      : null,
    diasMaximosAposVencimento: dados.permitirPagamentoAposVencimento
      ? dados.diasMaximosAposVencimento
      : null,
    diasParaNegativar: dados.negativarAutomaticamente ? dados.diasParaNegativar : null,
    banco: dados.banco ?? null,
    ambiente: dados.ambiente ?? null,
    tipoIntegracao: 'api' as const,
  })
)

export type DadosGravarParametrosBoleto = z.infer<typeof esquemaGravarParametrosBoleto>

export const esquemaFiltroListagemParametrosBoleto = z.object({
  q: z.string().optional(),
  incluirInativos: z
    .preprocess((v) => v === 'true' || v === true, z.boolean())
    .optional()
    .default(true),
  somenteAtivos: z
    .preprocess((v) => (v === 'true' || v === true ? true : v === 'false' || v === false ? false : undefined), z.boolean().optional()),
})

export const esquemaAtivarParametroBoleto = z.object({
  ativo: z.boolean(),
})
