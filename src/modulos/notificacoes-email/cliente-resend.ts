/**
 * Cliente HTTP para a API da Resend.
 * Encapsula a chamada externa com timeout e tratamento de erro.
 * Nunca lança exceção — sempre retorna um objeto tipado.
 */
const URL_RESEND = 'https://api.resend.com/emails'
const TIMEOUT_MS = 10_000

export type RespostaResendSucesso = { sucesso: true; id: string }
export type RespostaResendErro = { sucesso: false; mensagem: string; codigoHttp?: number }
export type RespostaResend = RespostaResendSucesso | RespostaResendErro

export type EmailParaEnviar = {
  apiKey: string
  de: string
  para: string[]
  assunto: string
  html: string
  texto?: string
}

export async function enviarEmailResend(dados: EmailParaEnviar): Promise<RespostaResend> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const resposta = await fetch(URL_RESEND, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${dados.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: dados.de,
        to: dados.para,
        subject: dados.assunto,
        html: dados.html,
        text: dados.texto,
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)

    let corpo: unknown = null
    try {
      const texto = await resposta.text()
      if (texto) corpo = JSON.parse(texto)
    } catch {
      // corpo vazio ou não-JSON
    }

    if (!resposta.ok) {
      const detalhe =
        (corpo as { message?: string } | null)?.message || `Erro HTTP ${resposta.status}`
      return { sucesso: false, mensagem: detalhe, codigoHttp: resposta.status }
    }

    return { sucesso: true, id: (corpo as { id?: string } | null)?.id ?? '' }
  } catch (erro) {
    clearTimeout(timer)
    const err = erro as Error
    if (err.name === 'AbortError') {
      return { sucesso: false, mensagem: 'Resend não respondeu em 10 segundos.' }
    }
    return { sucesso: false, mensagem: `Falha na conexão com Resend: ${err.message}` }
  }
}
