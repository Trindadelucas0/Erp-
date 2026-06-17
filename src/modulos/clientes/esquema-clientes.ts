/**
 * Validação dos dados de cliente (PF e PJ) com Zod.
 * Campos obrigatórios para emissão de NF-e estão comentados.
 */
import { z } from 'zod'
import { validarCpf, validarCnpj } from '../../compartilhado/validacoes/documentos.js'

const camposComuns = {
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(v.replace(/\s/g, '')),
      'Telefone inválido'
    ),
  celular: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(v.replace(/\s/g, '')),
      'Celular inválido'
    ),
  cep: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{5}-?\d{3}$/.test(v), 'CEP inválido'),
  logradouro: z.string().max(200).optional(),
  numero: z.string().max(20).optional(),
  complemento: z.string().max(100).optional(),
  bairro: z.string().max(100).optional(),
  cidade: z.string().max(100).optional(),
  estado: z
    .string()
    .length(2, 'Use a sigla do estado (ex: SP)')
    .toUpperCase()
    .optional()
    .or(z.literal('')),
  codigoIbge: z
    .string()
    .max(7)
    .optional()
    .refine((v) => !v || /^\d{7}$/.test(v), 'Código IBGE deve ter 7 dígitos'),
  indicadorIe: z.enum(['1', '2', '9']).default('9'),
  observacoes: z.string().max(500).optional(),
}

export const esquemaDeCriacaoDeClientePF = z.object({
  tipo: z.literal('PF'),
  cpf: z
    .string()
    .min(11, 'CPF inválido')
    .refine(validarCpf, 'CPF inválido — verifique os dígitos'),
  rg: z.string().max(20).optional(),
  dataNascimento: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
      'Data no formato AAAA-MM-DD'
    ),
  ...camposComuns,
})

export const esquemaDeCriacaoDeClientePJ = z.object({
  tipo: z.literal('PJ'),
  cnpj: z
    .string()
    .min(14, 'CNPJ inválido')
    .refine(validarCnpj, 'CNPJ inválido — verifique os dígitos'),
  nomeFantasia: z.string().max(200).optional(),
  cnae: z.string().max(10).optional(),
  dataFundacao: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
      'Data no formato AAAA-MM-DD'
    ),
  ie: z.string().max(30).optional(),
  im: z.string().max(30).optional(),
  suframa: z
    .string()
    .max(9)
    .optional()
    .refine((v) => !v || /^\d{8,9}$/.test(v), 'SUFRAMA inválido'),
  simplesNacional: z.boolean().optional(),
  observacaoNF: z.string().max(500).optional(),
  ...camposComuns,
})

export const esquemaDeCriacaoDeCliente = z.discriminatedUnion('tipo', [
  esquemaDeCriacaoDeClientePF,
  esquemaDeCriacaoDeClientePJ,
])

export const esquemaDeEdicaoDeCliente = z.discriminatedUnion('tipo', [
  esquemaDeCriacaoDeClientePF,
  esquemaDeCriacaoDeClientePJ,
])

export const esquemaDeAtivarCliente = z.object({
  ativo: z.boolean(),
})

export type DadosParaCriarClientePF = z.infer<typeof esquemaDeCriacaoDeClientePF>
export type DadosParaCriarClientePJ = z.infer<typeof esquemaDeCriacaoDeClientePJ>
export type DadosParaCriarCliente = z.infer<typeof esquemaDeCriacaoDeCliente>
export type DadosParaEditarCliente = z.infer<typeof esquemaDeEdicaoDeCliente>
