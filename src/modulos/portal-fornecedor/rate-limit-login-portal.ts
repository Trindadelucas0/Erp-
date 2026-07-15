/**
 * Rate limit em memória para tentativas de login no portal do fornecedor.
 * Protege contra força bruta na senha previsível (número do pedido).
 * Sem persistência — reinicia ao reiniciar a API (aceitável para este uso).
 */
const MAX_TENTATIVAS = 5
const JANELA_MS = 15 * 60 * 1000

type EstadoTentativas = {
  tentativas: number
  primeiraTentativaEm: number
  bloqueadoAte: number | null
}

const tentativasPorChave = new Map<string, EstadoTentativas>()

function chave(cnpjNormalizado: string, numeroPedido: number): string {
  return `${cnpjNormalizado}:${numeroPedido}`
}

export function verificarBloqueio(
  cnpjNormalizado: string,
  numeroPedido: number
): { bloqueado: boolean; segundosRestantes?: number } {
  const k = chave(cnpjNormalizado, numeroPedido)
  const estado = tentativasPorChave.get(k)
  if (!estado?.bloqueadoAte) return { bloqueado: false }

  const agora = Date.now()
  if (agora >= estado.bloqueadoAte) {
    tentativasPorChave.delete(k)
    return { bloqueado: false }
  }
  return { bloqueado: true, segundosRestantes: Math.ceil((estado.bloqueadoAte - agora) / 1000) }
}

export function registrarTentativaFalha(cnpjNormalizado: string, numeroPedido: number): void {
  const k = chave(cnpjNormalizado, numeroPedido)
  const agora = Date.now()
  const estado = tentativasPorChave.get(k)

  if (!estado || agora - estado.primeiraTentativaEm > JANELA_MS) {
    tentativasPorChave.set(k, { tentativas: 1, primeiraTentativaEm: agora, bloqueadoAte: null })
    return
  }

  const tentativas = estado.tentativas + 1
  const bloqueadoAte = tentativas >= MAX_TENTATIVAS ? agora + JANELA_MS : null
  tentativasPorChave.set(k, {
    tentativas,
    primeiraTentativaEm: estado.primeiraTentativaEm,
    bloqueadoAte,
  })
}

export function limparTentativas(cnpjNormalizado: string, numeroPedido: number): void {
  tentativasPorChave.delete(chave(cnpjNormalizado, numeroPedido))
}
