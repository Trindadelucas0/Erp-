/**
 * Envolve um provedor de IA com retry (backoff) e fallback para um modelo mais
 * leve, só quando o erro é temporário (sobrecarga/indisponibilidade do modelo).
 * Erros permanentes (auth, request inválido) retornam na hora, sem retry.
 */
import type { MensagemIa, ProvedorIa, RespostaProvedorIa } from './tipos-ia.js'

const TENTATIVAS_PRINCIPAL = 3
const BACKOFF_MS = [2000, 5000, 10000]
// Timeout (408) já consome o timeoutMs inteiro por tentativa (ex.: 60s) — limitar
// a 2 tentativas evita um pior caso de minutos antes de cair pro fallback.
const TENTATIVAS_TIMEOUT = 2

function ehErroTemporario(resposta: RespostaProvedorIa): boolean {
  if (resposta.sucesso) return false
  // 503 = sobrecarga do provedor; 408 = timeout (AbortError nos adapters) — ambos
  // costumam se resolver numa nova tentativa, diferente de erro de auth/validação.
  if (resposta.codigoHttp === 503 || resposta.codigoHttp === 408) return true
  return /overloaded|high demand|unavailable|try again/i.test(resposta.mensagem)
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function criarProvedorResiliente(
  principal: ProvedorIa,
  fallback: ProvedorIa | null
): ProvedorIa {
  return {
    nome: principal.nome,
    modelo: principal.modelo,
    async extrairTextoJson(mensagens: MensagemIa[]): Promise<RespostaProvedorIa> {
      let ultimaResposta: RespostaProvedorIa | null = null

      for (let tentativa = 1; tentativa <= TENTATIVAS_PRINCIPAL; tentativa++) {
        const resposta = await principal.extrairTextoJson(mensagens)
        ultimaResposta = resposta
        this.modelo = principal.modelo

        if (resposta.sucesso || !ehErroTemporario(resposta)) {
          return resposta
        }

        const limiteTentativas = resposta.codigoHttp === 408 ? TENTATIVAS_TIMEOUT : TENTATIVAS_PRINCIPAL
        console.log(
          `[ia] tentativa ${tentativa}/${limiteTentativas} (${principal.modelo}) falhou: ${resposta.mensagem}`
        )

        if (tentativa >= limiteTentativas) break

        const espera = BACKOFF_MS[tentativa - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1]
        console.log(`[ia] aguardando ${espera}ms antes de tentar novamente...`)
        await esperar(espera)
      }

      if (!fallback) {
        return ultimaResposta as RespostaProvedorIa
      }

      console.log(
        `[ia] esgotadas as tentativas em ${principal.modelo}; usando fallback ${fallback.modelo}`
      )
      const respostaFallback = await fallback.extrairTextoJson(mensagens)
      this.modelo = fallback.modelo

      if (!respostaFallback.sucesso) {
        console.log(`[ia] fallback ${fallback.modelo} também falhou: ${respostaFallback.mensagem}`)
      }

      return respostaFallback
    },
  }
}
