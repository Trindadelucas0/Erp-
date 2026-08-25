import { z } from 'zod'

export const esquemaCriarContagem = z.object({
  nfeRecebidaIds: z
    .array(z.string().uuid('ID de nota inválido'))
    .min(1, 'Selecione ao menos uma entrada'),
})

export const esquemaBipContagem = z.object({
  codigoBarras: z.string().min(1, 'Informe o código de barras'),
  versao: z.number().int().positive('Informe a versão atual da contagem'),
})

export const esquemaAtualizarQtdContada = z.object({
  qtdContada: z.number().finite().min(0, 'Quantidade não pode ser negativa'),
  versao: z.number().int().positive('Informe a versão atual da contagem'),
})

const esquemaItensQtdFlush = z
  .array(
    z.object({
      itemId: z.string().uuid(),
      qtdContada: z.number().finite().min(0),
    })
  )
  .optional()

export const esquemaGravarContagem = z.object({
  observacao: z.string().max(2000).optional().nullable(),
  versao: z.number().int().positive('Informe a versão atual da contagem'),
  itensQtd: esquemaItensQtdFlush,
})

export const esquemaFinalizarContagem = z.object({
  /** Se true e houver divergência, persiste como pendente admin. */
  confirmarDivergencia: z.boolean().optional().default(false),
  observacao: z.string().max(2000).optional().nullable(),
  versao: z.number().int().positive('Informe a versão atual da contagem'),
  itensQtd: esquemaItensQtdFlush,
})

export const esquemaCancelarContagem = z.object({
  versao: z.number().int().positive('Informe a versão atual da contagem'),
})
