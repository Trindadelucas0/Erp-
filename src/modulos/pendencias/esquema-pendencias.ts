import { z } from 'zod'

export const esquemaListagemPendencias = z.object({
  tela: z.string().trim().max(200).optional(),
  limite: z.coerce.number().int().min(1).max(100).optional(),
  pagina: z.coerce.number().int().min(1).optional(),
})
