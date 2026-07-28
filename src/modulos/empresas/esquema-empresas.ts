/**
 * Validação dos dados de empresa com Zod.
 */
import { z } from 'zod'
import {
  textoCadastroObrigatorio,
  textoCadastroOpcional,
} from '../../compartilhado/normalizacao/esquema-texto-cadastro.js'
import {
  normalizarCnpj,
  validarCnpj,
} from '../../compartilhado/validacoes/documentos.js'

const camposOpcionaisDeEmpresa = {
  phone: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(v.replace(/\s/g, '')),
      'Telefone inválido'
    ),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  cep: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\d{5}-?\d{3}$/.test(v),
      'CEP inválido (ex: 01310-100)'
    ),
  logradouro: textoCadastroOpcional(200),
  numero: textoCadastroOpcional(20),
  complemento: textoCadastroOpcional(100),
  bairro: textoCadastroOpcional(100),
  cidade: textoCadastroOpcional(100),
  estado: z
    .string()
    .length(2, 'Use a sigla do estado (ex: SP)')
    .toUpperCase()
    .optional()
    .or(z.literal('')),
}

/** Override parcial — campos omitidos/null herdam o .env. */
export const esquemaOverrideRecursosEntradaNotas = z
  .object({
    verNota: z.boolean().nullable().optional(),
    baixarXml: z.boolean().nullable().optional(),
    baixarPdfFocus: z.boolean().nullable().optional(),
    danfeCacheIndisponivelHoras: z
      .number()
      .int()
      .min(0)
      .max(720)
      .nullable()
      .optional(),
    danfeRateLimitMinutos: z.number().int().min(0).max(120).nullable().optional(),
  })
  .strict()

export const esquemaDeCriacaoDeEmpresa = z.object({
  nome: textoCadastroObrigatorio(2),
  cnpj: z
    .string()
    .transform(normalizarCnpj)
    .refine((v) => v.length === 14, 'CNPJ inválido')
    .refine(validarCnpj, 'CNPJ inválido — verifique os dígitos'),
  ...camposOpcionaisDeEmpresa,
})

export const esquemaDeEdicaoDeEmpresa = z.object({
  nome: textoCadastroObrigatorio(2),
  cnpj: z
    .string()
    .transform(normalizarCnpj)
    .refine((v) => v.length === 14, 'CNPJ inválido')
    .refine(validarCnpj, 'CNPJ inválido — verifique os dígitos'),
  ...camposOpcionaisDeEmpresa,
  /** null limpa override (volta ao .env). Omitido = não altera. */
  recursosEntradaNotasJson: esquemaOverrideRecursosEntradaNotas.nullable().optional(),
})

export const esquemaDeAtivarEmpresa = z.object({
  ativo: z.boolean(),
})

export type DadosParaCriarEmpresa = z.infer<typeof esquemaDeCriacaoDeEmpresa>
export type DadosParaEditarEmpresa = z.infer<typeof esquemaDeEdicaoDeEmpresa>
export type OverrideRecursosEntradaNotasZod = z.infer<
  typeof esquemaOverrideRecursosEntradaNotas
>
