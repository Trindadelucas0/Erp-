/**
 * Validação dos dados de transportadora (PF e PJ) com Zod.
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
  celularWhatsapp: z.boolean().optional(),
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
  // Campos específicos de transportadora
  antt: z.string().max(20).optional(),
  tipoVeiculo: z.string().max(100).optional(),
  aceitaNFe55: z.boolean().optional().default(true),
}

export const esquemaDeContatoItem = z.object({
  tipo: z.enum(['email', 'telefone', 'outro']),
  valor: z.string().min(1, 'Valor do contato obrigatório'),
  descricao: z.string().max(100).optional(),
  whatsapp: z.boolean().optional(),
  principal: z.boolean().optional(),
})

export const esquemaDeEnderecoItem = z.object({
  tipo: z.enum(['principal', 'entrega']),
  apelido: z.string().max(100).optional(),
  cep: z.string().optional().refine((v) => !v || /^\d{5}-?\d{3}$/.test(v), 'CEP inválido'),
  logradouro: z.string().max(200).optional(),
  numero: z.string().max(20).optional(),
  complemento: z.string().max(100).optional(),
  bairro: z.string().max(100).optional(),
  cidade: z.string().max(100).optional(),
  estado: z.string().length(2).toUpperCase().optional().or(z.literal('')),
  codigoIbge: z
    .string()
    .max(7)
    .optional()
    .refine((v) => !v || /^\d{7}$/.test(v), 'Código IBGE deve ter 7 dígitos'),
})

const camposArrays = {
  contatos: z.array(esquemaDeContatoItem).optional(),
  enderecos: z.array(esquemaDeEnderecoItem).optional(),
}

export const esquemaDeCriacaoDeTransportadoraPF = z.object({
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
  ...camposArrays,
})

export const esquemaDeCriacaoDeTransportadoraPJ = z.object({
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
  simplesNacional: z.boolean().optional(),
  observacaoNF: z.string().max(500).optional(),
  ...camposComuns,
  ...camposArrays,
})

export const esquemaDeCriacaoDeTransportadora = z.discriminatedUnion('tipo', [
  esquemaDeCriacaoDeTransportadoraPF,
  esquemaDeCriacaoDeTransportadoraPJ,
])

export const esquemaDeEdicaoDeTransportadora = z.discriminatedUnion('tipo', [
  esquemaDeCriacaoDeTransportadoraPF,
  esquemaDeCriacaoDeTransportadoraPJ,
])

export const esquemaDeAtivarTransportadora = z.object({
  ativo: z.boolean(),
})

export type DadosParaCriarTransportadoraPF = z.infer<typeof esquemaDeCriacaoDeTransportadoraPF>
export type DadosParaCriarTransportadoraPJ = z.infer<typeof esquemaDeCriacaoDeTransportadoraPJ>
export type DadosParaCriarTransportadora = z.infer<typeof esquemaDeCriacaoDeTransportadora>
export type DadosParaEditarTransportadora = z.infer<typeof esquemaDeEdicaoDeTransportadora>
