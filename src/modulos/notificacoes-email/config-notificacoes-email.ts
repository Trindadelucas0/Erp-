/**
 * Lê e valida a configuração de e-mail (Resend) a partir do .env.
 * Lança erro claro se faltar alguma variável obrigatória.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

export type ConfigNotificacoesEmail = {
  apiKey: string
  remetente: string
  urlPortalFornecedor: string
  emailAvisoInterno: string | null
}

export function notificacoesEmailConfigurado(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY && process.env.RESEND_FROM && process.env.PORTAL_FORNECEDOR_URL
  )
}

export function obterConfigNotificacoesEmail(): ConfigNotificacoesEmail {
  const apiKey = process.env.RESEND_API_KEY
  const remetente = process.env.RESEND_FROM
  const urlPortalFornecedor = process.env.PORTAL_FORNECEDOR_URL

  if (!apiKey || !remetente || !urlPortalFornecedor) {
    throw new ErroDaAplicacao(
      'Envio de e-mail não configurado. Defina RESEND_API_KEY, RESEND_FROM e PORTAL_FORNECEDOR_URL no .env.',
      503
    )
  }

  return {
    apiKey,
    remetente,
    urlPortalFornecedor: urlPortalFornecedor.replace(/\/+$/, ''),
    emailAvisoInterno: process.env.RESEND_AVISO_PARA || null,
  }
}
