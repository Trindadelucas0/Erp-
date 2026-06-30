/**
 * Validação dos dados de empresa com Zod.
 */
import { z } from 'zod'
import {
  textoCadastroObrigatorio,
  textoCadastroOpcional,
} from '../../compartilhado/normalizacao/esquema-texto-cadastro.js'

function validarCnpj(cnpj: string): boolean {
  const apenas_numeros = cnpj.replace(/\D/g, '')

  if (apenas_numeros.length !== 14) return false
  if (/^(\d)\1{13}$/.test(apenas_numeros)) return false

  const calcularDigito = (base: string, pesos: number[]) => {
    const soma = base
      .split('')
      .reduce((acc, digito, i) => acc + parseInt(digito) * pesos[i], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  const digito1 = calcularDigito(apenas_numeros.slice(0, 12), pesos1)
  const digito2 = calcularDigito(apenas_numeros.slice(0, 13), pesos2)

  return (
    parseInt(apenas_numeros[12]) === digito1 &&
    parseInt(apenas_numeros[13]) === digito2
  )
}

const camposOpcionaisDeEmpresa = {
  phone: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(v.replace(/\s/g, '')),
      'Telefone inválido'
    ),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  cep: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\d{5}-?\d{3}$/.test(v),
      'CEP inválido (ex: 01310-100)'
    ),
  logradouro: textoCadastroOpcional(200),
  numero: textoCadastroOpcional(20),
  complemento: textoCadastroOpcional(100),
  bairro: textoCadastroOpcional(100),
  cidade: textoCadastroOpcional(100),
  estado: z
    .string()
    .length(2, 'Use a sigla do estado (ex: SP)')
    .toUpperCase()
    .optional()
    .or(z.literal('')),
}

export const esquemaDeCriacaoDeEmpresa = z.object({
  nome: textoCadastroObrigatorio(2),
  cnpj: z
    .string()
    .min(14, 'CNPJ inválido')
    .refine(validarCnpj, 'CNPJ inválido — verifique os dígitos'),
  ...camposOpcionaisDeEmpresa,
})

export const esquemaDeEdicaoDeEmpresa = z.object({
  nome: textoCadastroObrigatorio(2),
  cnpj: z
    .string()
    .min(14, 'CNPJ inválido')
    .refine(validarCnpj, 'CNPJ inválido — verifique os dígitos'),
  ...camposOpcionaisDeEmpresa,
})

export const esquemaDeAtivarEmpresa = z.object({
  ativo: z.boolean(),
})

export type DadosParaCriarEmpresa = z.infer<typeof esquemaDeCriacaoDeEmpresa>
export type DadosParaEditarEmpresa = z.infer<typeof esquemaDeEdicaoDeEmpresa>
