import { afterEach, describe, expect, it } from 'vitest'
import {
  lerDefaultsRecursosEntradaNotas,
  mesclarRecursosEntradaNotas,
} from './config-recursos-entrada-notas.js'

describe('recursos entrada notas — env e merge', () => {
  const envKeys = [
    'ENTRADA_NOTAS_VER_NOTA',
    'ENTRADA_NOTAS_BAIXAR_XML',
    'ENTRADA_NOTAS_BAIXAR_PDF_FOCUS',
    'ENTRADA_NOTAS_DANFE_CACHE_INDISPONIVEL_HORAS',
    'ENTRADA_NOTAS_DANFE_RATE_LIMIT_MINUTOS',
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

  it('usa padrões sensatos sem variáveis no .env', () => {
    for (const key of envKeys) setEnv(key, undefined)
    const cfg = lerDefaultsRecursosEntradaNotas()
    expect(cfg).toEqual({
      verNota: true,
      baixarXml: true,
      baixarPdfFocus: true,
      danfeCacheIndisponivelHoras: 24,
      danfeRateLimitMinutos: 2,
    })
  })

  it('lê flags e calibração do .env', () => {
    setEnv('ENTRADA_NOTAS_VER_NOTA', 'false')
    setEnv('ENTRADA_NOTAS_BAIXAR_XML', '0')
    setEnv('ENTRADA_NOTAS_BAIXAR_PDF_FOCUS', 'sim')
    setEnv('ENTRADA_NOTAS_DANFE_CACHE_INDISPONIVEL_HORAS', '12')
    setEnv('ENTRADA_NOTAS_DANFE_RATE_LIMIT_MINUTOS', '5')
    const cfg = lerDefaultsRecursosEntradaNotas()
    expect(cfg.verNota).toBe(false)
    expect(cfg.baixarXml).toBe(false)
    expect(cfg.baixarPdfFocus).toBe(true)
    expect(cfg.danfeCacheIndisponivelHoras).toBe(12)
    expect(cfg.danfeRateLimitMinutos).toBe(5)
  })

  it('merge parcial sobrescreve só os campos informados', () => {
    const defaults = {
      verNota: true,
      baixarXml: true,
      baixarPdfFocus: true,
      danfeCacheIndisponivelHoras: 24,
      danfeRateLimitMinutos: 2,
    }
    const mesclado = mesclarRecursosEntradaNotas(defaults, {
      baixarPdfFocus: false,
      danfeCacheIndisponivelHoras: 6,
      verNota: null,
    })
    expect(mesclado.baixarPdfFocus).toBe(false)
    expect(mesclado.danfeCacheIndisponivelHoras).toBe(6)
    expect(mesclado.verNota).toBe(true)
    expect(mesclado.baixarXml).toBe(true)
  })

  it('override null ou inválido herda o default', () => {
    const defaults = lerDefaultsRecursosEntradaNotas()
    expect(mesclarRecursosEntradaNotas(defaults, null)).toEqual(defaults)
    expect(mesclarRecursosEntradaNotas(defaults, undefined)).toEqual(defaults)
    expect(
      mesclarRecursosEntradaNotas(defaults, {
        danfeRateLimitMinutos: -1 as unknown as number,
      }).danfeRateLimitMinutos
    ).toBe(defaults.danfeRateLimitMinutos)
  })
})
