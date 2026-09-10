import { afterEach, describe, expect, it } from 'vitest'
import {
  lerConfigCotaEmissaoFocus,
  saldoCotaEmissaoFocus,
} from './cota-emissao-focus.js'

describe('cota emissão Focus — esqueleto', () => {
  const envKeys = [
    'FOCUS_NFE_COTA_EMISSAO_HABILITADA',
    'FOCUS_NFE_COTA_EMISSAO_MENSAL',
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

  it('usa padrão 100 com emissão habilitada', () => {
    setEnv('FOCUS_NFE_COTA_EMISSAO_HABILITADA', undefined)
    setEnv('FOCUS_NFE_COTA_EMISSAO_MENSAL', undefined)
    const cfg = lerConfigCotaEmissaoFocus()
    expect(cfg.habilitada).toBe(true)
    expect(cfg.cota).toBe(100)
  })

  it('desliga com HABILITADA=false ou COTA=0', () => {
    setEnv('FOCUS_NFE_COTA_EMISSAO_HABILITADA', 'false')
    setEnv('FOCUS_NFE_COTA_EMISSAO_MENSAL', '100')
    expect(lerConfigCotaEmissaoFocus().habilitada).toBe(false)

    setEnv('FOCUS_NFE_COTA_EMISSAO_HABILITADA', 'true')
    setEnv('FOCUS_NFE_COTA_EMISSAO_MENSAL', '0')
    expect(lerConfigCotaEmissaoFocus().habilitada).toBe(false)
  })

  it('saldo stub retorna usados=0 e stub=true', async () => {
    setEnv('FOCUS_NFE_COTA_EMISSAO_HABILITADA', 'true')
    setEnv('FOCUS_NFE_COTA_EMISSAO_MENSAL', '100')
    const saldo = await saldoCotaEmissaoFocus('empresa-teste')
    expect(saldo.habilitada).toBe(true)
    expect(saldo.usados).toBe(0)
    expect(saldo.cota).toBe(100)
    expect(saldo.restantes).toBe(100)
    expect(saldo.stub).toBe(true)
  })
})
