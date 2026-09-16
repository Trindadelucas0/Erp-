import { z } from 'zod'
import { STATUS_ENDERECO_WMS } from '../estrutura-wms/status-efetivo-wms.js'

const statusWms = z.enum(STATUS_ENDERECO_WMS)

export const esquemaDeCriacaoDeEnderecoWms = z.object({
  andarId: z.string().trim().min(1, 'Andar obrigatório'),
  codigo: z.string().trim().min(1, 'Código obrigatório'),
  tipoEndereco: z.string().trim().min(1, 'Tipo de endereço obrigatório'),
  status: statusWms.optional().default('ativo'),
  ativo: z.boolean().optional(),
})

export const esquemaDeEdicaoDeEnderecoWms = z.object({
  codigo: z.string().trim().min(1, 'Código obrigatório'),
  tipoEndereco: z.string().trim().min(1, 'Tipo de endereço obrigatório'),
  status: statusWms.optional(),
  ativo: z.boolean().optional(),
})

export const esquemaDeMoverEnderecoWms = z.object({
  alvoId: z.string().trim().min(1, 'Alvo obrigatório'),
  posicao: z.enum(['antes', 'depois']),
})

export const esquemaFiltroListagemEnderecoWms = z.object({
  q: z.string().optional(),
  andarId: z.string().optional(),
  status: z.enum(['todos', 'ativo', 'bloqueado', 'inativo']).optional().or(z.literal('')),
  incluirInativos: z.enum(['true', 'false']).optional(),
  take: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.coerce.number().int().min(1).max(200).optional()
  ),
})

export type DadosParaCriarEnderecoWms = z.infer<typeof esquemaDeCriacaoDeEnderecoWms>
export type DadosParaEditarEnderecoWms = z.infer<typeof esquemaDeEdicaoDeEnderecoWms>
export type DadosParaMoverEnderecoWms = z.infer<typeof esquemaDeMoverEnderecoWms>
