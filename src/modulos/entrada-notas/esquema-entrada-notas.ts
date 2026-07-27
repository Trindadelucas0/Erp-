/**
 * Esquemas Zod — Entrada de Notas / pipeline.
 */
import { z } from 'zod'

export const esquemaVincularItem = z.object({
  itemId: z.string().uuid(),
  produtoId: z.string().uuid(),
})

export const esquemaGravarCodigoOriginal = z.object({
  itemId: z.string().uuid(),
})

export const esquemaDesvincularItem = z.object({
  itemId: z.string().uuid(),
})

export const esquemaVoltarEtapa = z.object({
  etapaDestino: z.enum(['cadastro', 'fiscal', 'negociacao', 'frete']),
})

export const esquemaImportarFiscal = z.object({
  itemId: z.string().uuid(),
  ncm: z.boolean().optional(),
  origem: z.boolean().optional(),
})

export const esquemaContatoFornecedor = z.object({
  observacao: z.string().min(1, 'Informe a observação do contato'),
})

export const esquemaDefinirPedido = z.object({
  pedidoCompraId: z.string().uuid(),
})

export const esquemaDefinirPrazo = z.object({
  prazo: z.string().min(1, 'Informe o prazo'),
})

export const esquemaManifestar = z.object({
  tipo: z.enum(['desconhecimento', 'nao_realizada']),
  justificativa: z.string().optional(),
})

export const esquemaLancar = z.object({
  modo: z.enum(['contagem', 'consolidar']),
  senha: z.string().optional(),
})

/** Liberar críticas exige senha de gerente (doc Entrada de Notas). */
export const esquemaLiberarCriticas = z.object({
  senha: z.string().min(1, 'Senha de gerente obrigatória para liberar críticas'),
})

export const esquemaVincularCte = z
  .object({
    chaveCte: z.string().min(44).optional(),
    cteId: z.string().uuid().optional(),
  })
  .refine((d) => Boolean(d.chaveCte || d.cteId), {
    message: 'Informe a chave do CT-e ou o id',
  })
