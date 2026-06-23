/**
 * Validação dos dados de login com Zod.
 */
import { z } from 'zod'

export const esquemaDeLogin = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(1, 'Senha é obrigatória'),
})

export const esquemaDeTema = z.object({
  tema: z.enum(['claro', 'escuro'], {
    errorMap: () => ({ message: 'Tema deve ser "claro" ou "escuro"' }),
  }),
})

export type DadosDeLogin = z.infer<typeof esquemaDeLogin>
export type DadosDeTema = z.infer<typeof esquemaDeTema>
