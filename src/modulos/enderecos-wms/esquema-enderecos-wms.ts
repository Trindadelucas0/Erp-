import { z } from 'zod'
import { AREAS_WMS, LOCAIS_WMS, TIPOS_WMS } from './nomenclatura-endereco-wms.js'

const localWms = z.enum(LOCAIS_WMS)
const areaWms = z.enum(AREAS_WMS)
const tipoWms = z.enum(TIPOS_WMS)

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
  area: areaWms.optional().or(z.literal('')),
  tipo: tipoWms.optional().or(z.literal('')),
  incluirInativos: z.enum(['true', 'false']).optional(),
})

export type DadosParaCriarEnderecoWms = z.infer<typeof esquemaDeCriacaoDeEnderecoWms>
export type DadosParaEditarEnderecoWms = z.infer<typeof esquemaDeEdicaoDeEnderecoWms>
