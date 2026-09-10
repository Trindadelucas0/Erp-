import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  _resetProtecaoFocusParaTestes,
  circuitoAbertoFocus,
  inferirCategoriaRpmFocus,
  mensagemCircuitBreakerFocus,
  registrarRespostaCircuitBreakerFocus,
  statusCircuitBreakerFocus,
} from './protecao-focus-nfe.js'

describe('proteção Focus — RPM categoria e circuit breaker', () => {
  const envKeys = [
    'FOCUS_NFE_CIRCUIT_BREAKER_HABILITADO',
    'FOCUS_NFE_CIRCUIT_BREAKER_MIN',
    'FOCUS_NFE_CIRCUIT_BREAKER_429',
  ] as const
  const backup: Record<string, string | undefined> = {}

  afterEach(() => {
    _resetProtecaoFocusParaTestes()
    vi.useRealTimers()
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

  it('infere categoria pelo caminho', () => {
    expect(inferirCategoriaRpmFocus('/nfes_recebidas', 'GET')).toBe('lista')
    expect(inferirCategoriaRpmFocus('/nfes_recebidas/chave.xml', 'GET')).toBe('xml')
    expect(inferirCategoriaRpmFocus('/nfes_recebidas/chave.pdf', 'GET')).toBe('pdf')
    expect(
      inferirCategoriaRpmFocus('/nfes_recebidas/chave/manifesto', 'POST')
    ).toBe('manifesto')
  })

  it('abre breaker após N 429 seguidos', () => {
    setEnv('FOCUS_NFE_CIRCUIT_BREAKER_HABILITADO', 'true')
    setEnv('FOCUS_NFE_CIRCUIT_BREAKER_429', '3')
    setEnv('FOCUS_NFE_CIRCUIT_BREAKER_MIN', '15')
    const companyId = 'emp-a'
    expect(circuitoAbertoFocus(companyId)).toBe(false)

    registrarRespostaCircuitBreakerFocus(companyId, { sucesso: false, codigoHttp: 429 })
    registrarRespostaCircuitBreakerFocus(companyId, { sucesso: false, codigoHttp: 429 })
    expect(circuitoAbertoFocus(companyId)).toBe(false)

    registrarRespostaCircuitBreakerFocus(companyId, { sucesso: false, codigoHttp: 429 })
    expect(circuitoAbertoFocus(companyId)).toBe(true)
    expect(mensagemCircuitBreakerFocus(companyId)).toMatch(/pausada temporariamente/i)
    expect(statusCircuitBreakerFocus(companyId).liberacaoEm).toBeInstanceOf(Date)
  })

  it('abre breaker imediatamente em 429 de autenticação', () => {
    setEnv('FOCUS_NFE_CIRCUIT_BREAKER_HABILITADO', 'true')
    setEnv('FOCUS_NFE_CIRCUIT_BREAKER_429', '5')
    const companyId = 'emp-auth'
    registrarRespostaCircuitBreakerFocus(companyId, {
      sucesso: false,
      codigoHttp: 429,
      bloqueioAutenticacao: true,
    })
    expect(circuitoAbertoFocus(companyId)).toBe(true)
    expect(mensagemCircuitBreakerFocus(companyId)).toMatch(/autentica/i)
  })

  it('sucesso zera contagem de 429', () => {
    setEnv('FOCUS_NFE_CIRCUIT_BREAKER_HABILITADO', 'true')
    setEnv('FOCUS_NFE_CIRCUIT_BREAKER_429', '2')
    const companyId = 'emp-ok'
    registrarRespostaCircuitBreakerFocus(companyId, { sucesso: false, codigoHttp: 429 })
    registrarRespostaCircuitBreakerFocus(companyId, { sucesso: true })
    registrarRespostaCircuitBreakerFocus(companyId, { sucesso: false, codigoHttp: 429 })
    expect(circuitoAbertoFocus(companyId)).toBe(false)
  })
})
