import { z } from 'zod'

export const STATUS_ORCAMENTO = ['em_elaboracao', 'enviado', 'aprovado'] as const

const texto = (maximo: number) => z.string().trim().max(maximo).optional().default('')

const numeroNaoNegativo = z.coerce
  .number({ invalid_type_error: 'Valor inválido' })
  .min(0, 'Valor não pode ser negativo')
  .finite('Valor inválido')

const dataCivil = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')

const dataCivilOpcional = z
  .string()
  .trim()
  .refine((valor) => valor === '' || /^\d{4}-\d{2}-\d{2}$/.test(valor), 'Data inválida')
  .optional()
  .default('')

const enderecoVazio = {
  cep: '',
  logradouro: '',
  numero: '',
  bairro: '',
  cidade: '',
  uf: '',
}

export const esquemaItemOrcamento = z.object({
  codigo: texto(60),
  descricao: texto(300),
  ncm: texto(20),
  quantidade: numeroNaoNegativo,
  unidade: texto(10),
  precoUnitario: numeroNaoNegativo,
  percentualDesconto: numeroNaoNegativo.max(100, 'Desconto deve ser no máximo 100%'),
})

export const esquemaOrcamento = z.object({
  numero: texto(40),
  data: dataCivil,
  validade: dataCivilOpcional,
  status: z.enum(STATUS_ORCAMENTO).optional().default('em_elaboracao'),
  vendedorId: texto(40),
  clienteCodigo: texto(40),
  clienteNome: texto(200),
  cnpj: texto(20),
  telefone: texto(30),
  email: texto(200),
  contato: texto(120),
  condicaoPagamento: texto(40),
  prazoEntrega: texto(40),
  frete: texto(40),
  mensagem: texto(1000),
  descontoTotal: numeroNaoNegativo.optional().default(0),
  valorFrete: numeroNaoNegativo.optional().default(0),
  outrasDespesas: numeroNaoNegativo.optional().default(0),
  converterEmPedido: z.boolean().optional().default(false),
  endereco: z
    .object({
      cep: texto(9),
      logradouro: texto(200),
      numero: texto(20),
      bairro: texto(120),
      cidade: texto(120),
      uf: texto(2),
    })
    .optional()
    .default(enderecoVazio),
  complementares: texto(4000),
  observacoes: texto(4000),
  itens: z.array(esquemaItemOrcamento).max(500, 'Limite de 500 itens').optional().default([]),
})

export type DadosOrcamento = z.infer<typeof esquemaOrcamento>
export type DadosItemOrcamento = z.infer<typeof esquemaItemOrcamento>

export function enderecoPersistido(
  prazoEntrega: string,
  endereco: DadosOrcamento['endereco']
): DadosOrcamento['endereco'] {
  if (prazoEntrega === 'no_ato') return { ...enderecoVazio }
  return endereco
}

export function fretePersistido(
  prazoEntrega: string,
  frete: string,
  valorFrete: number
): { frete: string; valorFrete: number } {
  if (prazoEntrega === 'no_ato') return { frete: '', valorFrete: 0 }
  return { frete, valorFrete }
}
