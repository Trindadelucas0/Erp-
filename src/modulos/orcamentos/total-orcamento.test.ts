import { describe, expect, it } from 'vitest'
import { totalDoOrcamento } from './repositorio-orcamentos.js'

describe('totalDoOrcamento', () => {
  it('soma ST no total sem misturar no líquido', () => {
    const total = totalDoOrcamento({
      valorFrete: 5,
      outrasDespesas: 2,
      itens: [
        {
          codigo: '1',
          descricao: 'Item',
          quantidade: 2,
          precoUnitario: 10,
          percentualDesconto: 0,
          valorSt: 1.5,
        },
      ],
    })
    expect(total).toBe(28.5)
  })
})
