/**
 * Validação dos dados de fornecedor (PF e PJ) com Zod.
 */
import { z } from 'zod'
import { validarCpf, validarCnpj } from '../../compartilhado/validacoes/documentos.js'
import { normalizarIe } from '../../compartilhado/validacoes/inscricao-estadual.js'

const campoIeOpcional = z
  .string()
  .max(30)
  .optional()
  .refine(
    (v) => !v || normalizarIe(v) !== null,
    'IE inválida — use apenas dígitos ou ISENTO'
  )

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
  observacoes: z.string().max(500).optional(),
  tipoRevenda: z.boolean().optional().default(false),
  tipoConsumo: z.boolean().optional().default(false),
  tipoPrestadorServico: z.boolean().optional().default(false),
  permitirVinculoManual: z.boolean().optional().default(false),
  exigirItensEntrada: z.boolean().optional().default(false),
  prazosPagamento: z
    .array(z.number().int().min(0).nullable())
    .max(6)
    .optional(),
  planosFinanceirosIds: z.array(z.string().uuid()).optional(),
  cfopsEntradaIds: z.array(z.string().uuid()).optional(),
  fornecedoresVinculadosIds: z.array(z.string().uuid()).optional(),
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

export const esquemaDeDadosBancarioItem = z.object({
  apelido: z.string().max(100).optional(),
  banco: z.string().max(100).optional(),
  agencia: z.string().max(20).optional(),
  conta: z.string().max(30).optional(),
  tipoConta: z.enum(['corrente', 'poupanca']).optional(),
  pix: z.string().max(200).optional(),
  favorecido: z.string().max(200).optional(),
  documentoFavorecido: z.string().max(18).optional(),
  principal: z.boolean().optional(),
})

export const esquemaDeCnaeItem = z.object({
  codigo: z.string().min(1).max(10),
  descricao: z.string().max(500).optional(),
  principal: z.boolean().optional(),
})

const esquemaDePlanoCfopPar = z.object({
  planoFinanceiroId: z.string().uuid(),
  cfopId: z.string().uuid(),
})

const camposArrays = {
  contatos: z.array(esquemaDeContatoItem).optional(),
  enderecos: z.array(esquemaDeEnderecoItem).optional(),
  dadosBancarios: z.array(esquemaDeDadosBancarioItem).optional(),
  cnaes: z.array(esquemaDeCnaeItem).optional(),
  paresPlanoCfopPadrao: z.array(esquemaDePlanoCfopPar).optional(),
}

export const esquemaDeCriacaoDeFornecedorPF = z.object({
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

export const esquemaDeCriacaoDeFornecedorPJ = z.object({
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
  ie: campoIeOpcional,
  im: z.string().max(30).optional(),
  simplesNacional: z.boolean().optional(),
  ...camposComuns,
  ...camposArrays,
})

export const esquemaDeCriacaoDeFornecedor = z.discriminatedUnion('tipo', [
  esquemaDeCriacaoDeFornecedorPF,
  esquemaDeCriacaoDeFornecedorPJ,
])

export const esquemaDeEdicaoDeFornecedor = z.discriminatedUnion('tipo', [
  esquemaDeCriacaoDeFornecedorPF,
  esquemaDeCriacaoDeFornecedorPJ,
])

export const esquemaDeAtivarFornecedor = z.object({
  ativo: z.boolean(),
})

export type DadosParaCriarFornecedorPF = z.infer<typeof esquemaDeCriacaoDeFornecedorPF>
export type DadosParaCriarFornecedorPJ = z.infer<typeof esquemaDeCriacaoDeFornecedorPJ>
export type DadosParaCriarFornecedor = z.infer<typeof esquemaDeCriacaoDeFornecedor>
export type DadosParaEditarFornecedor = z.infer<typeof esquemaDeEdicaoDeFornecedor>
