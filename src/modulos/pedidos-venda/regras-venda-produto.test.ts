import { describe, expect, it } from 'vitest'
import {
  converterQtdParaUnidadeVenda,
  resolverItensNaCaixa,
  validarQuantidadeModoCx,
  validarQuantidadeModoUn,
} from './regras-venda-produto.js'

describe('regras-venda-produto backend', () => {
  it('converte CX para UN', () => {
    expect(converterQtdParaUnidadeVenda('CX', 2, 6)).toBe(12)
  })

  it('resolve itens na caixa', () => {
    expect(
      resolverItensNaCaixa({
        unidade: 'UN',
        embalagensMaster: [{ quantidade: 6 }],
      })
    ).toBe(6)
  })

  it('valida regras UN e CX', () => {
    expect(validarQuantidadeModoUn(0.5, false, 1).ok).toBe(false)
    expect(validarQuantidadeModoUn(1.93, true, 1.93).ok).toBe(true)
    expect(validarQuantidadeModoCx(2).ok).toBe(true)
    expect(validarQuantidadeModoCx(1.5).ok).toBe(false)
  })
})
