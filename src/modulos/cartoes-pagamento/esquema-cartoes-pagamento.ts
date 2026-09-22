import { z } from 'zod'
import { CODIGOS_BANDEIRA_CARTAO, TIPOS_CARTAO_PAGAMENTO } from './bandeiras-cartao.js'

const taxaNumeroNaoNegativo = z.coerce
  .number({ invalid_type_error: 'Taxa inválida' })
  .min(0, 'Taxa deve ser maior ou igual a zero')
  .finite('Taxa inválida')

const valorFixoNaoNegativo = z.coerce
  .number({ invalid_type_error: 'Valor fixo inválido' })
  .min(0, 'Valor fixo deve ser maior ou igual a zero')
  .finite('Valor fixo inválido')

export const esquemaTaxaCartao = z.object({
  numeroParcelas: z.coerce
    .number({ invalid_type_error: 'Nº de parcelas inválido' })
    .int('Nº de parcelas deve ser inteiro')
    .min(1, 'Nº de parcelas deve ser pelo menos 1')
    .max(48, 'Nº de parcelas deve ser no máximo 48'),
  taxaPercentual: taxaNumeroNaoNegativo,
  prazoDias: z.coerce
    .number({ invalid_type_error: 'Prazo inválido' })
    .int('Prazo deve ser inteiro')
    .min(0, 'Prazo deve ser maior ou igual a zero')
    .max(365, 'Prazo deve ser no máximo 365 dias'),
  valorFixo: valorFixoNaoNegativo,
})

function refinarTaxas(
  dados: {
    tipo: string
    permitirParcelamento: boolean
    taxas: Array<{ numeroParcelas: number }>
  },
  ctx: z.RefinementCtx
) {
  if (!dados.taxas.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe ao menos uma taxa',
      path: ['taxas'],
    })
    return
  }

  const numeros = dados.taxas.map((t) => t.numeroParcelas)
  const unicos = new Set(numeros)
  if (unicos.size !== numeros.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Nº de parcelas duplicado na grade de taxas',
      path: ['taxas'],
    })
  }

  if (dados.tipo === 'debito') {
    if (dados.taxas.length !== 1 || dados.taxas[0]?.numeroParcelas !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Débito deve ter exatamente uma taxa de 1 parcela',
        path: ['taxas'],
      })
    }
    if (dados.permitirParcelamento) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Débito não permite parcelamento',
        path: ['permitirParcelamento'],
      })
    }
  }
}

const camposCartao = {
  bandeira: z.enum(CODIGOS_BANDEIRA_CARTAO, {
    errorMap: () => ({ message: 'Bandeira inválida' }),
  }),
  tipo: z.enum(TIPOS_CARTAO_PAGAMENTO, {
    errorMap: () => ({ message: 'Tipo deve ser crédito ou débito' }),
  }),
  nomeExibicao: z
    .string({ required_error: 'Nome para exibição é obrigatório' })
    .trim()
    .min(2, 'Nome para exibição deve ter pelo menos 2 caracteres')
    .max(80, 'Nome para exibição deve ter no máximo 80 caracteres'),
  ativo: z.boolean().optional().default(true),
  adquirenteId: z.string().uuid('Adquirente inválida'),
  permitirParcelamento: z.boolean().optional().default(true),
  taxas: z.array(esquemaTaxaCartao).min(1, 'Informe ao menos uma taxa'),
}

export const esquemaDeCriacaoDeCartao = z
  .object(camposCartao)
  .superRefine((dados, ctx) => {
    const permitir =
      dados.tipo === 'debito' ? false : (dados.permitirParcelamento ?? true)
    refinarTaxas(
      {
        tipo: dados.tipo,
        permitirParcelamento: permitir,
        taxas: dados.taxas,
      },
      ctx
    )
  })
  .transform((dados) => ({
    ...dados,
    permitirParcelamento:
      dados.tipo === 'debito' ? false : (dados.permitirParcelamento ?? true),
    ativo: dados.ativo !== false,
  }))

export const esquemaDeEdicaoDeCartao = z
  .object({
    ...camposCartao,
    ativo: z.boolean(),
    permitirParcelamento: z.boolean(),
  })
  .superRefine((dados, ctx) => {
    const permitir = dados.tipo === 'debito' ? false : dados.permitirParcelamento
    refinarTaxas(
      {
        tipo: dados.tipo,
        permitirParcelamento: permitir,
        taxas: dados.taxas,
      },
      ctx
    )
  })
  .transform((dados) => ({
    ...dados,
    permitirParcelamento: dados.tipo === 'debito' ? false : dados.permitirParcelamento,
  }))

export const esquemaDeAtivarCartao = z.object({
  ativo: z.boolean(),
})

export const esquemaFiltroListagemCartoes = z.object({
  q: z.string().trim().optional(),
  incluirInativos: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true'),
  adquirenteId: z.string().uuid().optional(),
  bandeira: z.enum(CODIGOS_BANDEIRA_CARTAO).optional(),
  tipo: z.enum(TIPOS_CARTAO_PAGAMENTO).optional(),
})

export type DadosParaCriarCartao = z.infer<typeof esquemaDeCriacaoDeCartao>
export type DadosParaEditarCartao = z.infer<typeof esquemaDeEdicaoDeCartao>
export type DadosTaxaCartao = z.infer<typeof esquemaTaxaCartao>
