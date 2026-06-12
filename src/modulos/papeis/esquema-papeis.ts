/**
 * Validação dos dados de papéis com Zod.
 */
import { z } from 'zod'

export const esquemaDeSalvarPermissoesDoPapel = z.object({
  idsDasPermissoes: z.array(z.string().uuid()),
})

export const esquemaDeCriacaoDePapel = z.object({
  nome: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .regex(/^[a-z_]+$/, 'Nome deve conter apenas letras minúsculas e underscores'),
  descricao: z.string().optional(),
})

export type DadosParaSalvarPermissoesDoPapel = z.infer<
  typeof esquemaDeSalvarPermissoesDoPapel
>
export type DadosParaCriarPapel = z.infer<typeof esquemaDeCriacaoDePapel>
