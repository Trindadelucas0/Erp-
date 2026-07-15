/**
 * Adapter para qualquer API compatível com o formato OpenAI Chat Completions
 * (OpenAI, Azure OpenAI, OpenRouter, Groq etc.) — só muda IA_BASE_URL/IA_MODEL no .env.
 * Nunca lança exceção — sempre retorna RespostaProvedorIa tipada.
 */
import type { MensagemIa, ProvedorIa, RespostaProvedorIa } from '../tipos-ia.js'

export function criarProvedorOpenAiCompativel(
  apiKey: string,
  baseUrl: string,
  modelo: string,
  timeoutMs: number
): ProvedorIa {
  return {
    nome: 'openai',
    modelo,
    async extrairTextoJson(mensagens: MensagemIa[]): Promise<RespostaProvedorIa> {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const resposta = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelo,
            messages: mensagens.map((m) => ({ role: m.papel, content: m.conteudo })),
            response_format: { type: 'json_object' },
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

        const texto = (corpo as { choices?: { message?: { content?: string } }[] } | null)
          ?.choices?.[0]?.message?.content
        if (typeof texto !== 'string') {
          return { sucesso: false, mensagem: 'Resposta do provider OpenAI-compatível sem conteúdo textual.' }
        }

        return { sucesso: true, texto }
      } catch (erro) {
        clearTimeout(timer)
        const err = erro as Error
        if (err.name === 'AbortError') {
          return {
            sucesso: false,
            mensagem: 'A IA (OpenAI-compatível) não respondeu a tempo (timeout).',
            codigoHttp: 408,
          }
        }
        return { sucesso: false, mensagem: `Falha na conexão com o provider: ${err.message}` }
      }
    },
  }
}
