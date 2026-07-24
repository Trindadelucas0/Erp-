import { afterEach, describe, expect, it } from 'vitest'
import {
  intervaloMesAtualSaoPaulo,
  lerConfigCotaFocus,
} from './cota-focus-nfe.js'

describe('cota Focus — env e mês', () => {
  const envKeys = [
    'FOCUS_NFE_COTA_HABILITADA',
    'FOCUS_NFE_COTA_MENSAL',
    'FOCUS_NFE_CUSTO_EXTRA_CENTAVOS',
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

  it('usa padrão 100 notas e 10 centavos com cota habilitada', () => {
    setEnv('FOCUS_NFE_COTA_HABILITADA', undefined)
    setEnv('FOCUS_NFE_COTA_MENSAL', undefined)
    setEnv('FOCUS_NFE_CUSTO_EXTRA_CENTAVOS', undefined)
    const cfg = lerConfigCotaFocus()
    expect(cfg.habilitada).toBe(true)
    expect(cfg.cota).toBe(100)
    expect(cfg.custoExtraCentavos).toBe(10)
  })

  it('desliga cota com HABILITADA=false', () => {
    setEnv('FOCUS_NFE_COTA_HABILITADA', 'false')
    setEnv('FOCUS_NFE_COTA_MENSAL', '100')
    expect(lerConfigCotaFocus().habilitada).toBe(false)
  })

  it('desliga cota com COTA_MENSAL=0', () => {
    setEnv('FOCUS_NFE_COTA_HABILITADA', 'true')
    setEnv('FOCUS_NFE_COTA_MENSAL', '0')
    expect(lerConfigCotaFocus().habilitada).toBe(false)
  })

  it('intervalo do mês BRT cobre o mês civil', () => {
    const ref = new Date('2026-07-24T15:00:00.000Z')
    const { inicio, fim, mesReferencia } = intervaloMesAtualSaoPaulo(ref)
    expect(mesReferencia).toBe('2026-07')
    expect(inicio.toISOString()).toBe('2026-07-01T03:00:00.000Z')
    expect(fim.toISOString()).toBe('2026-08-01T03:00:00.000Z')
    expect(inicio.getTime()).toBeLessThan(ref.getTime())
    expect(fim.getTime()).toBeGreaterThan(ref.getTime())
  })
})
