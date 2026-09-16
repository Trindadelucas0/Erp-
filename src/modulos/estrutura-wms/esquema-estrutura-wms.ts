import { z } from 'zod'
import { NIVEIS_HIERARQUIA_WMS } from '../enderecos-wms/nomenclatura-endereco-wms.js'
import { STATUS_ENDERECO_WMS } from './status-efetivo-wms.js'

export const NIVEIS_ESTRUTURA_WMS = NIVEIS_HIERARQUIA_WMS
export type NivelEstruturaWms = (typeof NIVEIS_ESTRUTURA_WMS)[number]

const nivelWms = z.enum(NIVEIS_ESTRUTURA_WMS)
const statusWms = z.enum(STATUS_ENDERECO_WMS)

export const esquemaFiltroListagemEstruturaWms = z.object({
  q: z.string().optional(),
  status: z.enum(['todos', 'ativo', 'bloqueado', 'inativo']).optional().or(z.literal('')),
  incluirInativos: z.enum(['true', 'false']).optional(),
})

export const esquemaDeCriacaoDeNivelWms = z.object({
  nivel: nivelWms.optional(),
  parentId: z.string().trim().optional(),
  codigo: z.string().trim().min(1, 'Código obrigatório'),
  nome: z.string().trim().optional().default(''),
  status: statusWms.optional().default('ativo'),
  ativo: z.boolean().optional(),
  paiCodigo: z.string().trim().optional(),
})

export const esquemaDeEdicaoDeNivelWms = z.object({
  codigo: z.string().trim().min(1, 'Código obrigatório'),
  nome: z.string().trim().optional().default(''),
  status: statusWms.optional(),
  ativo: z.boolean().optional(),
  parentId: z.string().trim().optional(),
})

export const esquemaDeMoverNivelWms = z.object({
  alvoId: z.string().trim().min(1, 'Alvo obrigatório'),
  posicao: z.enum(['antes', 'depois', 'dentro']),
})

export const esquemaGerarEstruturaWms = z
  .object({
    localId: z.string().trim().optional(),
    localCodigo: z.string().trim().optional(),
    localNome: z.string().trim().optional(),
    areaId: z.string().trim().optional(),
    areaCodigo: z.string().trim().optional(),
    areaNome: z.string().trim().optional(),
    ruaId: z.string().trim().optional(),
    ruaInicio: z.string().trim().optional(),
    ruaFim: z.string().trim().optional(),
    blocoInicio: z.string().trim().min(1, 'Bloco inicial obrigatório'),
    blocoFim: z.string().trim().min(1, 'Bloco final obrigatório'),
    andarInicio: z.string().trim().min(1, 'Andar inicial obrigatório'),
    andarFim: z.string().trim().min(1, 'Andar final obrigatório'),
    apartamentoInicio: z.string().trim().min(1, 'Apartamento inicial obrigatório'),
    apartamentoFim: z.string().trim().min(1, 'Apartamento final obrigatório'),
    tipoPadrao: z.string().trim().min(1, 'Tipo padrão obrigatório'),
  })
  .superRefine((dados, ctx) => {
    if (!dados.localId && !dados.localCodigo) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Local obrigatório', path: ['localId'] })
    }
    if (!dados.areaId && !dados.areaCodigo) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Área obrigatória', path: ['areaId'] })
    }
  })

export type DadosParaCriarNivelWms = z.infer<typeof esquemaDeCriacaoDeNivelWms>
export type DadosParaEditarNivelWms = z.infer<typeof esquemaDeEdicaoDeNivelWms>
export type DadosParaMoverNivelWms = z.infer<typeof esquemaDeMoverNivelWms>
export type DadosParaGerarEstruturaWms = z.infer<typeof esquemaGerarEstruturaWms>
