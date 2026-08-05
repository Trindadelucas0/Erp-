/**
 * Validação dos dados de fornecedor (PF e PJ) com Zod.
 */
import { z } from 'zod'
import { validarCpf, validarCnpj, normalizarCnpj, normalizarCpf } from '../../compartilhado/validacoes/documentos.js'
import { normalizarIe } from '../../compartilhado/validacoes/inscricao-estadual.js'
import { normalizarTextoCadastro } from '../../compartilhado/normalizacao/texto-cadastro.js'
import {
  textoCadastroObrigatorio,
  textoCadastroOpcional,
} from '../../compartilhado/normalizacao/esquema-texto-cadastro.js'

const MODALIDADES_TRANSPORTE_FORNECEDOR = ['FOB_NOTA', 'FOB_CONHECIMENTO', 'CIF'] as const

function nulParaUndefined(valor: unknown) {
  return valor === null || valor === '' ? undefined : valor
}

const campoIeOpcional = z
  .string()
  .max(30)
  .optional()
  .refine(
    (v) => !v || normalizarIe(v) !== null,
    'IE inválida — use apenas dígitos ou ISENTO'
  )

const camposComuns = {
  nome: textoCadastroObrigatorio(2),
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
  codigoIbge: z
    .string()
    .max(7)
    .optional()
    .refine((v) => !v || /^\d{7}$/.test(v), 'Código IBGE deve ter 7 dígitos'),
  observacoes: textoCadastroOpcional(500),
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
  modalidadeTransportePadrao: z.preprocess(
    nulParaUndefined,
    z.enum(MODALIDADES_TRANSPORTE_FORNECEDOR, {
      required_error: 'Tipo de frete obrigatório',
      invalid_type_error: 'Tipo de frete inválido',
    })
  ),
  regraRateioFrete: z.preprocess(
    nulParaUndefined,
    z.enum(['valor', 'peso', 'quantidade', 'igual']).optional()
  ),
}

function exigeDadosTransporteFornecedor(modalidade: string | undefined): boolean {
  return modalidade === 'FOB_NOTA' || modalidade === 'FOB_CONHECIMENTO'
}

function validarRegraRateioFrete(
  data: {
    modalidadeTransportePadrao?: string
    regraRateioFrete?: string
  },
  ctx: z.RefinementCtx
) {
  if (!exigeDadosTransporteFornecedor(data.modalidadeTransportePadrao)) return
  if (data.regraRateioFrete) return
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'Regra de rateio do frete obrigatória',
    path: ['regraRateioFrete'],
  })
}

function limparRegraRateioSeCif<
  T extends { modalidadeTransportePadrao?: string; regraRateioFrete?: string },
>(data: T): T {
  if (exigeDadosTransporteFornecedor(data.modalidadeTransportePadrao)) return data
  return { ...data, regraRateioFrete: undefined }
}

export const esquemaDeContatoItem = z
  .object({
    tipo: z.enum(['email', 'telefone', 'outro']),
    valor: z.string().min(1, 'Valor do contato obrigatório'),
    descricao: textoCadastroOpcional(100),
    whatsapp: z.boolean().optional(),
    principal: z.boolean().optional(),
  })
  .transform((c) => ({
    ...c,
    valor: c.tipo === 'outro' ? (normalizarTextoCadastro(c.valor) ?? c.valor) : c.valor,
  }))

export const esquemaDeEnderecoItem = z.object({
  tipo: z.enum(['principal', 'entrega']),
  apelido: textoCadastroOpcional(100),
  cep: z.string().optional().refine((v) => !v || /^\d{5}-?\d{3}$/.test(v), 'CEP inválido'),
  logradouro: textoCadastroOpcional(200),
  numero: textoCadastroOpcional(20),
  complemento: textoCadastroOpcional(100),
  bairro: textoCadastroOpcional(100),
  cidade: textoCadastroOpcional(100),
  estado: z.string().length(2).toUpperCase().optional().or(z.literal('')),
  codigoIbge: z
    .string()
    .max(7)
    .optional()
    .refine((v) => !v || /^\d{7}$/.test(v), 'Código IBGE deve ter 7 dígitos'),
})

export const esquemaDeDadosBancarioItem = z.object({
  apelido: textoCadastroOpcional(100),
  banco: textoCadastroOpcional(100),
  agencia: z.string().max(20).optional(),
  conta: z.string().max(30).optional(),
  tipoConta: z.enum(['corrente', 'poupanca']).optional(),
  pix: z.string().max(200).optional(),
  favorecido: textoCadastroOpcional(200),
  documentoFavorecido: z.string().max(18).optional(),
  principal: z.boolean().optional(),
})

export const esquemaDeCnaeItem = z.object({
  codigo: z.string().min(1).max(10),
  descricao: textoCadastroOpcional(500),
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
    .transform(normalizarCpf)
    .refine((v) => v.length === 11, 'CPF inválido')
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
    .transform(normalizarCnpj)
    .refine((v) => v.length === 14, 'CNPJ inválido')
    .refine(validarCnpj, 'CNPJ inválido — verifique os dígitos'),
  nomeFantasia: textoCadastroOpcional(200),
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

const esquemaDeFornecedorComRegrasFrete = z
  .discriminatedUnion('tipo', [
    esquemaDeCriacaoDeFornecedorPF,
    esquemaDeCriacaoDeFornecedorPJ,
  ])
  .superRefine(validarRegraRateioFrete)
  .transform(limparRegraRateioSeCif)

export const esquemaDeCriacaoDeFornecedor = esquemaDeFornecedorComRegrasFrete
export const esquemaDeEdicaoDeFornecedor = esquemaDeFornecedorComRegrasFrete

export const esquemaDeAtivarFornecedor = z.object({
  ativo: z.boolean(),
})

export type DadosParaCriarFornecedorPF = z.infer<typeof esquemaDeCriacaoDeFornecedorPF>
export type DadosParaCriarFornecedorPJ = z.infer<typeof esquemaDeCriacaoDeFornecedorPJ>
export type DadosParaCriarFornecedor = z.infer<typeof esquemaDeCriacaoDeFornecedor>
export type DadosParaEditarFornecedor = z.infer<typeof esquemaDeEdicaoDeFornecedor>
