/**
 * Adapter Anthropic (Claude) — provider default da conferência por IA.
 * Nunca lança exceção — sempre retorna RespostaProvedorIa tipada.
 */
import type { MensagemIa, ProvedorIa, RespostaProvedorIa } from '../tipos-ia.js'

export function criarProvedorAnthropic(
  apiKey: string,
  baseUrl: string,
  modelo: string,
  timeoutMs: number
): ProvedorIa {
  return {
    nome: 'anthropic',
    modelo,
    async extrairTextoJson(mensagens: MensagemIa[]): Promise<RespostaProvedorIa> {
      const sistema = mensagens.find((m) => m.papel === 'system')?.conteudo
      const usuario = mensagens.filter((m) => m.papel === 'user')

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const resposta = await fetch(`${baseUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelo,
            max_tokens: 8000,
            system: sistema,
            messages: usuario.map((m) => ({ role: 'user', content: m.conteudo })),
          }),
          signal: controller.signal,
        })
        clearTimeout(timer)

        const corpo = await resposta.json().catch(() => null)

        if (!resposta.ok) {
          const detalhe =
            (corpo as { error?: { message?: string } } | null)?.error?.message ||
            `Erro HTTP ${resposta.status}`
          return { sucesso: false, mensagem: detalhe, codigoHttp: resposta.status }
        }

        const texto = (corpo as { content?: { text?: string }[] } | null)?.content?.[0]?.text
        if (typeof texto !== 'string') {
          return { sucesso: false, mensagem: 'Resposta da Anthropic sem conteúdo textual.' }
        }

        return { sucesso: true, texto }
      } catch (erro) {
        clearTimeout(timer)
        const err = erro as Error
        if (err.name === 'AbortError') {
          return {
            sucesso: false,
            mensagem: 'A IA (Anthropic) não respondeu a tempo (timeout).',
            codigoHttp: 408,
          }
        }
        return { sucesso: false, mensagem: `Falha na conexão com a Anthropic: ${err.message}` }
      }
    },
  }
}
