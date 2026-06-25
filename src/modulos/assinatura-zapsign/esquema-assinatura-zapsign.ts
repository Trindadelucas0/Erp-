/**
 * Validação dos dados de entrada para o módulo ZapSign com Zod.
 */
import { z } from 'zod'

export const esquemaParaSalvarConfig = z.object({
  apiToken: z
    .string()
    .min(10, 'API token muito curto — verifique na plataforma ZapSign'),
  sandbox: z.boolean(),
  webhookSecret: z.string().max(200).optional().or(z.literal('')),
})

export const esquemaParaEnviarDocumento = z.object({
  nomeDocumento: z
    .string()
    .min(3, 'Nome do documento deve ter pelo menos 3 caracteres')
    .max(255, 'Nome muito longo'),
  // Quando clienteId informado, signatarioNome/Email são preenchidos automaticamente
  clienteId: z.string().uuid('ID de cliente inválido').optional(),
  signatarioNome: z
    .string()
    .min(2, 'Nome do signatário deve ter pelo menos 2 caracteres')
    .max(200)
    .optional(),
  signatarioEmail: z
    .string()
    .email('E-mail inválido')
    .optional()
    .or(z.literal('')),
  base64Pdf: z.string().min(100, 'PDF inválido').optional(),
  urlPdf: z.string().url('URL do PDF inválida').optional(),
}).refine(
  (d) => d.base64Pdf || d.urlPdf,
  { message: 'Informe o PDF via base64 ou URL pública' }
).refine(
  (d) => d.clienteId || (d.signatarioNome && d.signatarioNome.length >= 2),
  { message: 'Informe o signatário ou selecione um cliente', path: ['signatarioNome'] }
)

export const esquemaDeWebhookZapsign = z.object({
  event_type: z.string(),
  doc: z
    .object({
      token: z.string(),
      name: z.string().optional(),
      status: z.string().optional(),
      refused_reason: z.string().optional().nullable(),
      signers: z
        .array(
          z.object({
            token: z.string().optional(),
            name: z.string().optional(),
            email: z.string().optional(),
            sign_url: z.string().optional(),
            status: z.string().optional(),
            signed_at: z.string().optional().nullable(),
          })
        )
        .optional(),
    })
    .optional(),
})

export type DadosParaSalvarConfig = z.infer<typeof esquemaParaSalvarConfig>
export type DadosParaEnviarDocumento = z.infer<typeof esquemaParaEnviarDocumento>
export type PayloadWebhookZapsign = z.infer<typeof esquemaDeWebhookZapsign>
