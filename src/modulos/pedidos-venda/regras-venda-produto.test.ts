import { describe, expect, it } from 'vitest'
import {
  converterQtdParaUnidadeVenda,
  resolverItensNaCaixa,
  resolverPrecoUnitarioVenda,
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

  it('converte preço da caixa para unitário', () => {
    expect(resolverPrecoUnitarioVenda('CX', 60, 6)).toBe(10)
    expect(resolverPrecoUnitarioVenda('UN', 60, 6)).toBe(60)
  })

  it('valida regras UN e CX', () => {
    expect(validarQuantidadeModoUn(0.5, false, 1).ok).toBe(false)
    expect(validarQuantidadeModoUn(5, false, 6).ok).toBe(false)
    expect(validarQuantidadeModoUn(5, false, 6)).toEqual({
      ok: false,
      mensagem: 'Quantidade menor que o múltiplo permitido. Múltiplo: 6.',
    })
    expect(validarQuantidadeModoUn(6, false, 6).ok).toBe(true)
    expect(validarQuantidadeModoUn(1.93, true, 1.93).ok).toBe(true)
    expect(validarQuantidadeModoUn(2, true, 1.93).ok).toBe(false)
    expect(validarQuantidadeModoCx(2).ok).toBe(true)
    expect(validarQuantidadeModoCx(1.5).ok).toBe(false)
  })
})
