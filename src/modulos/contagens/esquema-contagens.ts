import { z } from 'zod'

export const esquemaCriarContagem = z.object({
  nfeRecebidaIds: z
    .array(z.string().uuid('ID de nota inválido'))
    .min(1, 'Selecione ao menos uma entrada'),
})

export const esquemaBipContagem = z.object({
  codigoBarras: z.string().min(1, 'Informe o código de barras'),
})

export const esquemaAtualizarQtdContada = z.object({
  qtdContada: z.number().finite().min(0, 'Quantidade não pode ser negativa'),
})

export const esquemaGravarContagem = z.object({
  /** Se true e houver divergência, persiste como pendente admin. */
  confirmarDivergencia: z.boolean().optional().default(false),
  observacao: z.string().max(2000).optional().nullable(),
})
