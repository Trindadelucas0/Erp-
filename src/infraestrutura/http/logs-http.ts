/**
 * Logs HTTP legíveis no terminal (desenvolvimento).
 * Em produção o Fastify continua com logger JSON.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify'

export function ehProducao(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Monta uma linha curta: METHOD URL → status (ms) [mensagem]
 */
export function formatarLinhaRequest(
  method: string,
  url: string,
  status: number,
  ms: number,
  mensagem?: string
): string {
  const metodo = method.padEnd(6)
  const tempo = `${Math.round(ms)}ms`
  const base = `${metodo}${url} → ${status} (${tempo})`
  if (!mensagem) return base
  return `${base} ${mensagem}`
}

function prefixoPorStatus(status: number): string {
  if (status >= 500) return '[ERRO]'
  if (status >= 400) return '[AVISO]'
  return '[OK]'
}

function imprimirLinha(status: number, linha: string): void {
  const texto = `${prefixoPorStatus(status)} ${linha}`
  if (status >= 500) {
    console.error(texto)
    return
  }
  if (status >= 400) {
    console.warn(texto)
    return
  }
  console.log(texto)
}

/**
 * Uma linha por request no terminal (só em desenvolvimento).
 */
export function registrarHooksDeLog(aplicacao: FastifyInstance): void {
  if (ehProducao()) return

  aplicacao.addHook('onResponse', (requisicao, resposta, done) => {
    const mensagem = requisicao.logErroMensagem
    const linha = formatarLinhaRequest(
      requisicao.method,
      requisicao.url,
      resposta.statusCode,
      resposta.elapsedTime,
      mensagem
    )
    imprimirLinha(resposta.statusCode, linha)
    done()
  })
}

/**
 * Guarda a mensagem no request para o onResponse anexar na mesma linha.
 */
export function marcarMensagemDeErro(
  requisicao: FastifyRequest,
  mensagem: string
): void {
  requisicao.logErroMensagem = mensagem
}
