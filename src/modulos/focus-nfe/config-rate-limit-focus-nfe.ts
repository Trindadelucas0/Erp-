/**
 * Leitores de .env para throttle, lote de sync, RPM e circuit breaker Focus.
 * Sem side-effects — só parse de process.env.
 */

export type CategoriaRpmFocus = 'lista' | 'xml' | 'pdf' | 'manifesto' | 'emissao'

function lerBoolEnv(nome: string, padrao: boolean): boolean {
  const raw = process.env[nome]?.trim().toLowerCase()
  if (raw === undefined || raw === '') return padrao
  if (raw === 'false' || raw === '0' || raw === 'nao' || raw === 'não') return false
  if (raw === 'true' || raw === '1' || raw === 'sim') return true
  return padrao
}

function lerIntEnv(nome: string, padrao: number): number {
  const raw = process.env[nome]?.trim()
  if (!raw) return padrao
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return padrao
  return Math.floor(n)
}

/** Intervalo mínimo entre o fim de uma request e o início da próxima (fila serial). */
export function lerIntervaloMinMsFocus(): number {
  return Math.max(0, lerIntEnv('FOCUS_NFE_RATE_LIMIT_MS', 650))
}

/** Tentativas máximas em HTTP 429 (rate limit de API; bloqueio de auth não retenta). */
export function lerMaxTentativas429Focus(): number {
  return Math.max(1, lerIntEnv('FOCUS_NFE_RATE_LIMIT_MAX_429', 3))
}

/** Documentos por ciclo do job focus_sync (NFe + NFS-e + CTe). */
export function lerLimiteLoteSyncFocus(): number {
  return Math.max(1, lerIntEnv('FOCUS_NFE_SYNC_LOTE', 10))
}

const RPM_PADRAO: Record<CategoriaRpmFocus, number> = {
  lista: 30,
  xml: 20,
  pdf: 10,
  manifesto: 20,
  emissao: 10,
}

const RPM_ENV: Record<CategoriaRpmFocus, string> = {
  lista: 'FOCUS_NFE_RPM_LISTA',
  xml: 'FOCUS_NFE_RPM_XML',
  pdf: 'FOCUS_NFE_RPM_PDF',
  manifesto: 'FOCUS_NFE_RPM_MANIFESTO',
  emissao: 'FOCUS_NFE_RPM_EMISSAO',
}

/** Req/min por categoria; 0 = sem teto local (só fila serial). */
export function lerRpmCategoriaFocus(categoria: CategoriaRpmFocus): number {
  return lerIntEnv(RPM_ENV[categoria], RPM_PADRAO[categoria])
}

export function lerConfigRpmFocus(): Record<CategoriaRpmFocus, number> {
  return {
    lista: lerRpmCategoriaFocus('lista'),
    xml: lerRpmCategoriaFocus('xml'),
    pdf: lerRpmCategoriaFocus('pdf'),
    manifesto: lerRpmCategoriaFocus('manifesto'),
    emissao: lerRpmCategoriaFocus('emissao'),
  }
}

/** Minutos de pausa quando o circuit breaker abre. */
export function lerCircuitBreakerMinutosFocus(): number {
  return Math.max(1, lerIntEnv('FOCUS_NFE_CIRCUIT_BREAKER_MIN', 15))
}

/** Quantidade de 429 seguidos (rate limit) que abre o breaker. */
export function lerCircuitBreaker429Focus(): number {
  return Math.max(1, lerIntEnv('FOCUS_NFE_CIRCUIT_BREAKER_429', 5))
}

export function lerCircuitBreakerHabilitadoFocus(): boolean {
  return lerBoolEnv('FOCUS_NFE_CIRCUIT_BREAKER_HABILITADO', true)
}

export { lerBoolEnv as lerBoolEnvFocus, lerIntEnv as lerIntEnvFocus }
