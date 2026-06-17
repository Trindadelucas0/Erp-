/**
 * Validação dos dados de usuário com Zod.
 */
import { z } from 'zod'

const idsDosPapeis = z
  .array(z.string().uuid())
  .min(1, 'Selecione pelo menos um papel')

const idsDasEmpresas = z
  .array(z.string().uuid())
  .min(1, 'Selecione pelo menos uma empresa')

const idsDasPermissoesExtras = z.array(z.string().uuid()).default([])
const chavesDasPaginasPermitidas = z.array(z.string()).default([])

export const esquemaDeCriacaoDeUsuario = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  cargo: z.string().max(100).optional(),
  idsDosPapeis,
  idsDasEmpresas,
  idsDasPermissoesExtras: idsDasPermissoesExtras.optional(),
  chavesDasPaginasPermitidas: chavesDasPaginasPermitidas.optional(),
})

export const esquemaDeEdicaoDeUsuario = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').optional(),
  cargo: z.string().max(100).optional(),
  idsDosPapeis,
  idsDasEmpresas,
  idsDasPermissoesExtras: idsDasPermissoesExtras.optional(),
  chavesDasPaginasPermitidas: chavesDasPaginasPermitidas.optional(),
})

export const esquemaDeAtivarUsuario = z.object({
  ativo: z.boolean(),
})

export const esquemaDeResetDeSenha = z.object({
  novaSenha: z.string().min(6, 'A nova senha deve ter pelo menos 6 caracteres'),
})

export type DadosParaCriarUsuario = z.infer<typeof esquemaDeCriacaoDeUsuario>
export type DadosParaEditarUsuario = z.infer<typeof esquemaDeEdicaoDeUsuario>
export type DadosDeResetDeSenha = z.infer<typeof esquemaDeResetDeSenha>
