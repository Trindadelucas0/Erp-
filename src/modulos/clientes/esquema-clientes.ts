/**
 * Validação dos dados de cliente (PF e PJ) com Zod.
 */
import { z } from 'zod'
import { validarCpf, validarCnpj, normalizarCnpj, normalizarCpf } from '../../compartilhado/validacoes/documentos.js'
import { normalizarIe } from '../../compartilhado/validacoes/inscricao-estadual.js'
import { normalizarTextoCadastro } from '../../compartilhado/normalizacao/texto-cadastro.js'
import {
  textoCadastroObrigatorio,
  textoCadastroOpcional,
} from '../../compartilhado/normalizacao/esquema-texto-cadastro.js'

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
  indicadorIe: z.enum(['1', '2', '9']).default('9'),
  observacoes: textoCadastroOpcional(500),
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

export const esquemaDeCnaeItem = z.object({
  codigo: z.string().min(1).max(10),
  descricao: textoCadastroOpcional(500),
  principal: z.boolean().optional(),
})

const camposArrays = {
  contatos: z.array(esquemaDeContatoItem).optional(),
  enderecos: z.array(esquemaDeEnderecoItem).optional(),
  cnaes: z.array(esquemaDeCnaeItem).optional(),
}

export const esquemaDeCriacaoDeClientePF = z.object({
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
  aceitaNFe55: z.boolean().optional().default(true),
  ...camposComuns,
  ...camposArrays,
})

export const esquemaDeCriacaoDeClientePJ = z.object({
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
  suframa: z
    .string()
    .max(9)
    .optional()
    .refine((v) => !v || /^\d{8,9}$/.test(v), 'SUFRAMA inválido'),
  simplesNacional: z.boolean().optional(),
  observacaoNF: textoCadastroOpcional(500),
  aceitaNFe55: z.boolean().optional().default(true),
  ...camposComuns,
  ...camposArrays,
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

export const TIPOS_DE_CLIENTE = [
  'revenda',
  'construtora',
  'contribuinte_icms',
  'nao_contribuinte_icms',
  'substituido_substituto',
] as const

export const esquemaDeAprovacaoDeCliente = z.discriminatedUnion('acao', [
  z.object({
    acao: z.literal('aprovar'),
    tipoCliente: z.enum(TIPOS_DE_CLIENTE, {
      errorMap: () => ({ message: 'Tipo de cliente inválido' }),
    }),
    limiteCredito: z.number().min(0, 'Limite de crédito não pode ser negativo'),
    condicaoPagamento: z.string().min(1, 'Condição de pagamento obrigatória').max(100),
    vendedorId: z.string().uuid().optional().or(z.literal('')),
    calculaComissao: z.boolean(),
  }),
  z.object({
    acao: z.literal('reprovar'),
    motivoReprovacao: z.string().min(3, 'Informe o motivo da reprovação').max(500),
  }),
])

export const esquemaDeConfirmacaoDeAssinatura = z.object({
  token: z.string().min(1),
  nomeAssinante: textoCadastroObrigatorio(2, 200),
  aceite: z.literal(true, {
    errorMap: () => ({ message: 'É necessário aceitar os termos' }),
  }),
})

export type DadosParaCriarClientePF = z.infer<typeof esquemaDeCriacaoDeClientePF>
export type DadosParaCriarClientePJ = z.infer<typeof esquemaDeCriacaoDeClientePJ>
export type DadosParaCriarCliente = z.infer<typeof esquemaDeCriacaoDeCliente>
export type DadosParaEditarCliente = z.infer<typeof esquemaDeEdicaoDeCliente>
export type DadosParaAprovacaoDeCliente = z.infer<typeof esquemaDeAprovacaoDeCliente>
export type DadosParaConfirmacaoDeAssinatura = z.infer<typeof esquemaDeConfirmacaoDeAssinatura>
