/**
 * Adapter Google Gemini (API nativa generateContent).
 * Nunca lança exceção — sempre retorna RespostaProvedorIa tipada.
 */
import type { MensagemIa, ProvedorIa, RespostaProvedorIa } from '../tipos-ia.js'

export function criarProvedorGemini(
  apiKey: string,
  baseUrl: string,
  modelo: string,
  timeoutMs: number
): ProvedorIa {
  return {
    nome: 'gemini',
    modelo,
    async extrairTextoJson(mensagens: MensagemIa[]): Promise<RespostaProvedorIa> {
      const sistema = mensagens.find((m) => m.papel === 'system')?.conteudo
      const usuario = mensagens.filter((m) => m.papel === 'user')

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const url = `${baseUrl}/models/${modelo}:generateContent?key=${apiKey}`
        const resposta = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: sistema ? { parts: [{ text: sistema }] } : undefined,
            contents: usuario.map((m) => ({ role: 'user', parts: [{ text: m.conteudo }] })),
            generationConfig: { responseMimeType: 'application/json' },
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

        const texto = (
          corpo as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null
        )?.candidates?.[0]?.content?.parts?.[0]?.text

        if (typeof texto !== 'string') {
          return { sucesso: false, mensagem: 'Resposta do Gemini sem conteúdo textual.' }
        }

        return { sucesso: true, texto }
      } catch (erro) {
        clearTimeout(timer)
        const err = erro as Error
        if (err.name === 'AbortError') {
          return {
            sucesso: false,
            mensagem: 'A IA (Gemini) não respondeu a tempo (timeout).',
            codigoHttp: 408,
          }
        }
        return { sucesso: false, mensagem: `Falha na conexão com o Gemini: ${err.message}` }
      }
    },
  }
}
