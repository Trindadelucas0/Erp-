import { z } from 'zod'
import { LOCAIS_WMS } from './nomenclatura-endereco-wms.js'

const localWms = z.enum(LOCAIS_WMS)

const componentes = {
  local: z.string().trim().min(1, 'Local obrigatório'),
  area: z.string().trim().min(1, 'Área obrigatória'),
  tipo: z.string().trim().min(1, 'Tipo de endereço obrigatório'),
  rua: z.string().trim().min(1, 'Rua obrigatória'),
  andar: z.string().trim().min(1, 'Andar obrigatório'),
  posicao: z.string().trim().min(1, 'Posição obrigatória'),
}

export const esquemaDeCriacaoDeEnderecoWms = z.object({
  ...componentes,
  ativo: z.boolean().optional().default(true),
})

export const esquemaDeEdicaoDeEnderecoWms = z.object({
  ...componentes,
  ativo: z.boolean(),
})

export const esquemaFiltroListagemEnderecoWms = z.object({
  q: z.string().optional(),
  local: localWms.optional().or(z.literal('')),
  area: z.string().optional(),
  tipo: z.string().optional(),
  incluirInativos: z.enum(['true', 'false']).optional(),
})

export type DadosParaCriarEnderecoWms = z.infer<typeof esquemaDeCriacaoDeEnderecoWms>
export type DadosParaEditarEnderecoWms = z.infer<typeof esquemaDeEdicaoDeEnderecoWms>
