/**
 * Validação dos dados de papéis com Zod.
 */
import { z } from 'zod'

export const esquemaDeSalvarPermissoesDoPapel = z.object({
  idsDasPermissoes: z.array(z.string().uuid()),
})

export type DadosParaSalvarPermissoesDoPapel = z.infer<
  typeof esquemaDeSalvarPermissoesDoPapel
>
