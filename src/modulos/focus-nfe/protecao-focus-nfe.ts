/**
 * Orçamento req/min por categoria + circuit breaker por empresa (em memória).
 * Estouro de RPM → espera (não 500). Breaker aberto → erro tipado (agendador/sync pulam).
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import {
  type CategoriaRpmFocus,
  lerCircuitBreaker429Focus,
  lerCircuitBreakerHabilitadoFocus,
  lerCircuitBreakerMinutosFocus,
  lerRpmCategoriaFocus,
} from './config-rate-limit-focus-nfe.js'
import { logFocus, logFocusVerbose } from './logs-focus-nfe.js'

type ContextoEmpresaFocus = { companyId: string }

const contextoEmpresa = new AsyncLocalStorage<ContextoEmpresaFocus>()

/** Propaga companyId nas chamadas Focus (sync, PDF, XML, manifesto). */
export function comContextoEmpresaFocus<T>(
  companyId: string,
  fn: () => Promise<T>
): Promise<T> {
  return contextoEmpresa.run({ companyId }, fn)
}

export function companyIdContextoFocus(): string | undefined {
  return contextoEmpresa.getStore()?.companyId
}

const timestampsRpm = new Map<string, number[]>()

function chaveRpm(companyId: string, categoria: CategoriaRpmFocus): string {
  return `${companyId}:${categoria}`
}

/**
 * Espera até haver slot no orçamento req/min da categoria.
 * Sem companyId ou limite 0 → no-op.
 */
export async function aguardarOrcamentoRpmFocus(
  companyId: string | undefined,
  categoria: CategoriaRpmFocus
): Promise<void> {
  if (!companyId) return
  const limite = lerRpmCategoriaFocus(categoria)
  if (limite <= 0) return

  const chave = chaveRpm(companyId, categoria)
  for (;;) {
    const agora = Date.now()
    let janela = timestampsRpm.get(chave) ?? []
    janela = janela.filter((t) => agora - t < 60_000)
    if (janela.length < limite) {
      janela.push(agora)
      timestampsRpm.set(chave, janela)
      return
    }
    const maisAntigo = janela[0] ?? agora
    const espera = Math.max(50, 60_000 - (agora - maisAntigo) + 5)
    logFocusVerbose('rpm_espera', { companyId, categoria, ms: espera, limite })
    await new Promise((r) => setTimeout(r, espera))
  }
}

export function inferirCategoriaRpmFocus(caminho: string, metodo: string): CategoriaRpmFocus {
  const path = caminho.toLowerCase()
  if (path.includes('/manifesto') || (metodo === 'POST' && path.includes('manifest'))) {
    return 'manifesto'
  }
  if (path.endsWith('.pdf') || path.includes('.pdf')) return 'pdf'
  if (path.endsWith('.xml') || path.includes('.xml')) return 'xml'
  if (
    path.includes('/nfe') &&
    (path.includes('/enviar') || path.includes('/emiss') || path.includes('/nfe2'))
  ) {
    return 'emissao'
  }
  // GET lista DistDFe / consulta individual JSON
  return 'lista'
}

export type EstadoCircuitBreakerFocus = {
  aberto: boolean
  liberacaoEm: Date | null
  motivo: string | null
  consecutivos429: number
}

type EstadoInternoBreaker = {
  consecutivos429: number
  pausadoAte: number | null
  motivo: string | null
}

const breakers = new Map<string, EstadoInternoBreaker>()

function estadoInterno(companyId: string): EstadoInternoBreaker {
  let e = breakers.get(companyId)
  if (!e) {
    e = { consecutivos429: 0, pausadoAte: null, motivo: null }
    breakers.set(companyId, e)
  }
  return e
}

export function statusCircuitBreakerFocus(companyId: string): EstadoCircuitBreakerFocus {
  if (!lerCircuitBreakerHabilitadoFocus()) {
    return { aberto: false, liberacaoEm: null, motivo: null, consecutivos429: 0 }
  }
  const e = estadoInterno(companyId)
  const agora = Date.now()
  if (e.pausadoAte != null && e.pausadoAte > agora) {
    return {
      aberto: true,
      liberacaoEm: new Date(e.pausadoAte),
      motivo: e.motivo,
      consecutivos429: e.consecutivos429,
    }
  }
  if (e.pausadoAte != null && e.pausadoAte <= agora) {
    e.pausadoAte = null
    e.motivo = null
    e.consecutivos429 = 0
  }
  return {
    aberto: false,
    liberacaoEm: null,
    motivo: null,
    consecutivos429: e.consecutivos429,
  }
}

export function circuitoAbertoFocus(companyId: string): boolean {
  return statusCircuitBreakerFocus(companyId).aberto
}

export function mensagemCircuitBreakerFocus(companyId: string): string | null {
  const st = statusCircuitBreakerFocus(companyId)
  if (!st.aberto) return null
  const quando = st.liberacaoEm
    ? st.liberacaoEm.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      })
    : 'em breve'
  const motivo = st.motivo ?? 'muitos erros 429 da Focus'
  return `Sincronização Focus pausada temporariamente (${motivo}). Liberação prevista às ${quando}.`
}

function abrirBreaker(companyId: string, motivo: string): void {
  const minutos = lerCircuitBreakerMinutosFocus()
  const e = estadoInterno(companyId)
  e.pausadoAte = Date.now() + minutos * 60_000
  e.motivo = motivo
  logFocus('warn', 'circuit_breaker_aberto', {
    companyId,
    motivo,
    minutos,
    liberacaoEm: new Date(e.pausadoAte).toISOString(),
  })
}

/** Registra sucesso ou falha HTTP para o breaker da empresa. */
export function registrarRespostaCircuitBreakerFocus(
  companyId: string | undefined,
  opcoes: {
    sucesso: boolean
    codigoHttp?: number
    bloqueioAutenticacao?: boolean
  }
): void {
  if (!companyId || !lerCircuitBreakerHabilitadoFocus()) return
  const e = estadoInterno(companyId)

  if (opcoes.sucesso) {
    e.consecutivos429 = 0
    return
  }

  if (opcoes.codigoHttp !== 429) {
    e.consecutivos429 = 0
    return
  }

  if (opcoes.bloqueioAutenticacao) {
    e.consecutivos429 += 1
    abrirBreaker(companyId, 'bloqueio de autenticação (429) na Focus')
    return
  }

  e.consecutivos429 += 1
  const limiar = lerCircuitBreaker429Focus()
  if (e.consecutivos429 >= limiar) {
    abrirBreaker(
      companyId,
      `${e.consecutivos429} respostas 429 seguidas da Focus`
    )
  }
}

/** Só para testes — limpa estado em memória. */
export function _resetProtecaoFocusParaTestes(): void {
  timestampsRpm.clear()
  breakers.clear()
}
