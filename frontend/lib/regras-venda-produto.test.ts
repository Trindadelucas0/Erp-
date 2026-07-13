import { describe, expect, it } from 'vitest'
import {
  converterQtdParaUnidadeVenda,
  resolverItensNaCaixa,
  sugerirQuantidadeMultiploVenda,
  validarQuantidadeModoCx,
  validarQuantidadeModoUn,
} from './regras-venda-produto'

describe('regras-venda-produto', () => {
  it('resolverItensNaCaixa prioriza embalagem master', () => {
    expect(
      resolverItensNaCaixa({
        unidade: 'UN',
        embalagensMaster: [{ quantidade: 6 }],
        fornecedores: [{ multiplicadorEntrada: 12 }],
      })
    ).toBe(6)
  })

  it('resolverItensNaCaixa usa multiplicador do fornecedor sem master', () => {
    expect(
      resolverItensNaCaixa({
        unidade: 'UN',
        embalagensMaster: [],
        fornecedores: [{ multiplicadorEntrada: 12 }],
      })
    ).toBe(12)
  })

  it('converter CX multiplica pela caixa', () => {
    expect(converterQtdParaUnidadeVenda('CX', 2, 6)).toBe(12)
    expect(converterQtdParaUnidadeVenda('UN', 2, 6)).toBe(2)
  })

  it('valida fracionado e múltiplo em modo UN', () => {
    expect(validarQuantidadeModoUn(0.5, false, 1).ok).toBe(false)
    expect(validarQuantidadeModoUn(1.93, true, 1.93).ok).toBe(true)
    expect(validarQuantidadeModoUn(2, true, 1.93).ok).toBe(false)
  })

  it('valida caixas inteiras', () => {
    expect(validarQuantidadeModoCx(2).ok).toBe(true)
    expect(validarQuantidadeModoCx(1.5).ok).toBe(false)
  })

  it('sugere próximo múltiplo de venda', () => {
    expect(sugerirQuantidadeMultiploVenda(2, 1.93, true)).toEqual({
      precisaAjuste: true,
      quantidadeSugerida: 3.86,
      multiplo: 1.93,
    })
    expect(sugerirQuantidadeMultiploVenda(1.93, 1.93, true)).toBeNull()
    expect(sugerirQuantidadeMultiploVenda(2, 1.93, false)).toBeNull()
  })
})
