import { describe, expect, it } from 'vitest'
import { esquemaConferir, esquemaMotivo } from './esquema-requisicoes-wms.js'

describe('esquemaMotivo', () => {
  it('recusa motivo vazio', () => {
    expect(esquemaMotivo.safeParse({ motivo: '' }).success).toBe(false)
    expect(esquemaMotivo.safeParse({}).success).toBe(false)
    expect(esquemaMotivo.safeParse({ motivo: 'duplicata' }).success).toBe(true)
  })
})

describe('esquemaConferir', () => {
  it('exige etapa e valor', () => {
    expect(esquemaConferir.safeParse({}).success).toBe(false)
    expect(esquemaConferir.safeParse({ etapa: 'origem', valor: '' }).success).toBe(false)
    expect(esquemaConferir.safeParse({ etapa: 'origem', valor: 'A-RC-20-01-2-05' }).success).toBe(
      true
    )
  })
})
