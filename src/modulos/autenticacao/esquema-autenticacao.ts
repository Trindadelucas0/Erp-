/**
 * Validação dos dados de login com Zod.
 */
import { z } from 'zod'

export const esquemaDeLogin = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(1, 'Senha é obrigatória'),
})

export type DadosDeLogin = z.infer<typeof esquemaDeLogin>
