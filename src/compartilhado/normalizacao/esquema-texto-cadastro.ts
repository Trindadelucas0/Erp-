import { z } from 'zod'

import { normalizarTextoCadastro } from './texto-cadastro.js'

export function textoCadastroObrigatorio(min: number, max?: number) {
  let schema = z.string().min(min)
  if (max != null) schema = schema.max(max)
  return schema.transform((v) => normalizarTextoCadastro(v) ?? v)
}

export function textoCadastroOpcional(max: number) {
  return z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v === undefined ? v : (normalizarTextoCadastro(v) ?? '')))
}
