import { afterEach, describe, expect, it } from 'vitest'
import {
  lerCircuitBreaker429Focus,
  lerCircuitBreakerMinutosFocus,
  lerIntervaloMinMsFocus,
  lerLimiteLoteSyncFocus,
  lerMaxTentativas429Focus,
  lerRpmCategoriaFocus,
} from './config-rate-limit-focus-nfe.js'

describe('config rate limit Focus — env', () => {
  const envKeys = [
    'FOCUS_NFE_RATE_LIMIT_MS',
    'FOCUS_NFE_RATE_LIMIT_MAX_429',
    'FOCUS_NFE_SYNC_LOTE',
    'FOCUS_NFE_RPM_LISTA',
    'FOCUS_NFE_RPM_XML',
    'FOCUS_NFE_RPM_PDF',
    'FOCUS_NFE_RPM_MANIFESTO',
    'FOCUS_NFE_RPM_EMISSAO',
    'FOCUS_NFE_CIRCUIT_BREAKER_MIN',
    'FOCUS_NFE_CIRCUIT_BREAKER_429',
  ] as const
  const backup: Record<string, string | undefined> = {}

  afterEach(() => {
    for (const key of envKeys) {
      if (backup[key] === undefined) delete process.env[key]
      else process.env[key] = backup[key]
      delete backup[key]
    }
  })

  function setEnv(key: (typeof envKeys)[number], value: string | undefined) {
    if (!(key in backup)) backup[key] = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  it('usa defaults de throttle e lote', () => {
    for (const key of envKeys) setEnv(key, undefined)
    expect(lerIntervaloMinMsFocus()).toBe(650)
    expect(lerMaxTentativas429Focus()).toBe(3)
    expect(lerLimiteLoteSyncFocus()).toBe(10)
  })

  it('lê throttle e lote do .env', () => {
    setEnv('FOCUS_NFE_RATE_LIMIT_MS', '800')
    setEnv('FOCUS_NFE_RATE_LIMIT_MAX_429', '5')
    setEnv('FOCUS_NFE_SYNC_LOTE', '15')
    expect(lerIntervaloMinMsFocus()).toBe(800)
    expect(lerMaxTentativas429Focus()).toBe(5)
    expect(lerLimiteLoteSyncFocus()).toBe(15)
  })

  it('usa defaults de RPM por categoria', () => {
    for (const key of envKeys) setEnv(key, undefined)
    expect(lerRpmCategoriaFocus('lista')).toBe(30)
    expect(lerRpmCategoriaFocus('xml')).toBe(20)
    expect(lerRpmCategoriaFocus('pdf')).toBe(10)
    expect(lerRpmCategoriaFocus('manifesto')).toBe(20)
    expect(lerRpmCategoriaFocus('emissao')).toBe(10)
  })

  it('usa defaults do circuit breaker', () => {
    for (const key of envKeys) setEnv(key, undefined)
    expect(lerCircuitBreakerMinutosFocus()).toBe(15)
    expect(lerCircuitBreaker429Focus()).toBe(5)
  })

  it('rejeita valores inválidos e aplica piso/default', () => {
    setEnv('FOCUS_NFE_RATE_LIMIT_MS', 'abc')
    setEnv('FOCUS_NFE_RATE_LIMIT_MAX_429', '0')
    setEnv('FOCUS_NFE_SYNC_LOTE', '-1')
    expect(lerIntervaloMinMsFocus()).toBe(650)
    expect(lerMaxTentativas429Focus()).toBe(1)
    expect(lerLimiteLoteSyncFocus()).toBe(10)
  })
})
