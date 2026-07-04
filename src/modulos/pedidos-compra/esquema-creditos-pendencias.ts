/**
 * Validação de créditos e pendências de fornecedor.
 */
import { z } from 'zod'
import { textoCadastroObrigatorio, textoCadastroOpcional } from '../../compartilhado/normalizacao/esquema-texto-cadastro.js'

const decimalPositivo = z.union([z.number(), z.string()]).transform((v) => {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) throw new Error('Valor deve ser maior que zero')
  return n
})

export const esquemaCriarCredito = z.object({
  fornecedorPessoaId: z.string().uuid(),
  valor: decimalPositivo,
  saldo: decimalPositivo.optional(),
  origem: textoCadastroOpcional(200),
  vencimento: z.string().datetime().optional().nullable(),
})

export const esquemaCriarPendencia = z.object({
  fornecedorPessoaId: z.string().uuid(),
  tipo: z.enum(['produto_quebrado', 'defeito_fabrica', 'credito_pendente']),
  descricao: textoCadastroObrigatorio(3),
  produtoId: z.string().uuid().optional().nullable(),
})

export const esquemaResolverPendencia = z.object({
  resolvido: z.boolean(),
})

export type DadosCriarCredito = z.infer<typeof esquemaCriarCredito>
export type DadosCriarPendencia = z.infer<typeof esquemaCriarPendencia>
