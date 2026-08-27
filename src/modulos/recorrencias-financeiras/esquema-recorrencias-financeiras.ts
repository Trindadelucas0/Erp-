import { z } from 'zod'

const valorPositivo = z.coerce
  .number({ invalid_type_error: 'Valor inválido' })
  .positive('Valor deve ser maior que zero')
  .finite('Valor inválido')

export const esquemaDeCriacaoDeRecorrencia = z.object({
  fornecedorPessoaId: z.string().uuid('Fornecedor inválido'),
  produtoId: z.string().uuid('Produto/serviço inválido'),
  valor: valorPositivo,
  ativo: z.boolean().optional().default(true),
})

export const esquemaDeEdicaoDeRecorrencia = z.object({
  fornecedorPessoaId: z.string().uuid('Fornecedor inválido'),
  produtoId: z.string().uuid('Produto/serviço inválido'),
  valor: valorPositivo,
  ativo: z.boolean(),
})

export const esquemaDeAtivarRecorrencia = z.object({
  ativo: z.boolean(),
})

export const esquemaFiltroListagemRecorrencias = z.object({
  q: z.string().trim().optional(),
  incluirInativos: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true'),
  fornecedorPessoaId: z.string().uuid().optional(),
})

export type DadosParaCriarRecorrencia = z.infer<typeof esquemaDeCriacaoDeRecorrencia>
export type DadosParaEditarRecorrencia = z.infer<typeof esquemaDeEdicaoDeRecorrencia>
