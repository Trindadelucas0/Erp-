import { z } from 'zod'
import { BANCOS_BOLETO } from '../parametros-boleto/esquema-parametros-boleto.js'

export const TIPOS_CONTA_EMPRESA = ['bancaria', 'caixa'] as const

const digitoOpcional = z
  .string()
  .trim()
  .max(1, 'Dígito deve ter no caractere')
  .regex(/^[0-9Xx]$/, 'Dígito inválido (use 0-9 ou X)')
  .transform((v) => v.toUpperCase())
  .nullable()
  .optional()

const limiteOpcional = z.preprocess(
  (valor) => {
    if (valor === '' || valor === undefined || valor === null) return null
    return valor
  },
  z.coerce
    .number({ invalid_type_error: 'Limite inválido' })
    .finite('Limite inválido')
    .min(0, 'Limite não pode ser negativo')
    .nullable()
    .optional()
)

const camposBase = {
  nome: z
    .string({ required_error: 'Nome é obrigatório' })
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(80, 'Nome deve ter no máximo 80 caracteres'),
  tipo: z.enum(TIPOS_CONTA_EMPRESA, { required_error: 'Tipo é obrigatório' }),
  banco: z.enum(BANCOS_BOLETO).nullable().optional(),
  agencia: z
    .string()
    .trim()
    .regex(/^\d{1,5}$/, 'Agência deve ter de 1 a 5 dígitos')
    .nullable()
    .optional(),
  digitoAgencia: digitoOpcional,
  conta: z
    .string()
    .trim()
    .regex(/^\d{1,12}$/, 'Conta corrente deve ter de 1 a 12 dígitos')
    .nullable()
    .optional(),
  digitoConta: digitoOpcional,
  limiteChequeEspecial: limiteOpcional,
}

function validarPorTipo(
  data: z.infer<typeof esquemaCorpoContaBase>,
  ctx: z.RefinementCtx
) {
  if (data.tipo === 'caixa') return

  if (!data.banco) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Banco é obrigatório', path: ['banco'] })
  }
  if (!data.agencia?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Agência é obrigatória',
      path: ['agencia'],
    })
  }
  if (!data.conta?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Conta corrente é obrigatória',
      path: ['conta'],
    })
  }
}

const esquemaCorpoContaBase = z.object(camposBase)

export const esquemaDeCriacaoDeConta = esquemaCorpoContaBase
  .extend({ ativo: z.boolean().optional().default(true) })
  .superRefine(validarPorTipo)

export const esquemaDeEdicaoDeConta = esquemaCorpoContaBase
  .extend({ ativo: z.boolean() })
  .superRefine(validarPorTipo)

export const esquemaDeAtivarConta = z.object({
  ativo: z.boolean(),
})

export const esquemaFiltroListagemContas = z.object({
  q: z.string().trim().optional(),
  incluirInativos: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true'),
  somenteAtivos: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true'),
})

export type DadosParaCriarConta = z.infer<typeof esquemaDeCriacaoDeConta>
export type DadosParaEditarConta = z.infer<typeof esquemaDeEdicaoDeConta>

export function normalizarDadosContaParaGravacao(
  dados: DadosParaCriarConta | DadosParaEditarConta
) {
  if (dados.tipo === 'caixa') {
    return {
      nome: dados.nome,
      tipo: dados.tipo,
      banco: null,
      agencia: null,
      digitoAgencia: null,
      conta: null,
      digitoConta: null,
      limiteChequeEspecial: null,
      ativo: dados.ativo !== false,
    }
  }

  return {
    nome: dados.nome,
    tipo: dados.tipo,
    banco: dados.banco ?? null,
    agencia: dados.agencia ?? null,
    digitoAgencia: dados.digitoAgencia ?? null,
    conta: dados.conta ?? null,
    digitoConta: dados.digitoConta ?? null,
    limiteChequeEspecial: dados.limiteChequeEspecial ?? null,
    ativo: dados.ativo !== false,
  }
}
