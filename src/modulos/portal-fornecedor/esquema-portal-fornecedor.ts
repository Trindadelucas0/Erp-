/**
 * Validação dos dados do portal do fornecedor com Zod.
 */
import { z } from 'zod'
import { normalizarCnpj } from '../../compartilhado/validacoes/documentos.js'

function normalizarNumero(valor: unknown): number {
  const n = typeof valor === 'number' ? valor : Number(String(valor).replace(/\D/g, ''))
  return n
}

export const esquemaLoginPortalFornecedor = z.object({
  cnpj: z
    .string()
    .min(11, 'CNPJ obrigatório')
    .transform(normalizarCnpj)
    .refine((v) => v.length === 14, 'CNPJ inválido'),
  // Senha do portal = número do pedido, enviado por e-mail ao fornecedor
  senha: z
    .union([z.string(), z.number()])
    .transform(normalizarNumero)
    .refine((n) => Number.isInteger(n) && n > 0, 'Senha (número do pedido) inválida'),
})

const MIME_TIPOS_PERMITIDOS = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
] as const

export const esquemaUploadPortalFornecedor = z.object({
  nomeArquivo: z.string().min(1, 'Nome do arquivo obrigatório').max(200),
  mimeType: z.enum(MIME_TIPOS_PERMITIDOS, {
    invalid_type_error: 'Tipo de arquivo não permitido. Envie PDF, XLSX, XLS ou CSV.',
  }),
  // ~18MB de arquivo já convertido para base64
  base64Arquivo: z.string().min(50, 'Arquivo inválido').max(25_000_000, 'Arquivo muito grande (máx. ~18MB)'),
})

export type DadosLoginPortalFornecedor = z.infer<typeof esquemaLoginPortalFornecedor>
export type DadosUploadPortalFornecedor = z.infer<typeof esquemaUploadPortalFornecedor>
export const MIME_TIPOS_PERMITIDOS_PORTAL = MIME_TIPOS_PERMITIDOS
