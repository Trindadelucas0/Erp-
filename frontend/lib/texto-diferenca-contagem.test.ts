import { describe, expect, it } from 'vitest'
import { textoDiferencaContagem } from './texto-diferenca-contagem'

describe('textoDiferencaContagem', () => {
  it('Bateu quando a diferença é zero', () => {
    expect(textoDiferencaContagem(0)).toBe('Bateu')
  })

  it('Faltou quando a contada é menor', () => {
    expect(textoDiferencaContagem(-2)).toBe('Faltou 2')
  })

  it('Sobrou quando a contada é maior', () => {
    expect(textoDiferencaContagem(3)).toBe('Sobrou 3')
  })
})
