import { describe, expect, it } from 'vitest'
import { esquemaDeCriacaoDePedidoCompra } from './esquema-pedidos-compra.js'

const fornecedorId = '11111111-1111-4111-8111-111111111111'
const transportadoraId = '22222222-2222-4222-8222-222222222222'
const produtoId = '33333333-3333-4333-8333-333333333333'

const itemBase = {
  produtoId,
  quantidade: 1,
  unidade: 'UN',
  precoUnitario: 10,
}

const payloadBase = {
  fornecedorPessoaId: fornecedorId,
  itens: [itemBase],
}

describe('esquemaDeCriacaoDePedidoCompra — preço unitário do item', () => {
  const payloadCif = {
    ...payloadBase,
    modalidadeTransporte: 'CIF' as const,
  }

  it('rejeita preço unitário zero', () => {
    const resultado = esquemaDeCriacaoDePedidoCompra.safeParse({
      ...payloadCif,
      itens: [{ ...itemBase, precoUnitario: 0 }],
    })

    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.errors.some((e) => e.path.includes('precoUnitario'))).toBe(true)
    }
  })

  it('rejeita preço unitário negativo', () => {
    const resultado = esquemaDeCriacaoDePedidoCompra.safeParse({
      ...payloadCif,
      itens: [{ ...itemBase, precoUnitario: -1 }],
    })

    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.errors.some((e) => e.path.includes('precoUnitario'))).toBe(true)
    }
  })
})

describe('esquemaDeCriacaoDePedidoCompra — modalidade de transporte', () => {
  it('rejeita criação sem tipo de frete', () => {
    const resultado = esquemaDeCriacaoDePedidoCompra.safeParse(payloadBase)
    expect(resultado.success).toBe(false)
  })

  it('aceita CIF sem transportadora', () => {
    const resultado = esquemaDeCriacaoDePedidoCompra.safeParse({
      ...payloadBase,
      modalidadeTransporte: 'CIF',
      transportadoraPessoaId: transportadoraId,
      valorFrete: 50,
    })

    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.modalidadeTransporte).toBe('CIF')
      expect(resultado.data.transportadoraPessoaId).toBeNull()
      expect(resultado.data.valorFrete).toBeNull()
    }
  })

  it('exige transportadora para FOB', () => {
    const resultado = esquemaDeCriacaoDePedidoCompra.safeParse({
      ...payloadBase,
      modalidadeTransporte: 'FOB_NOTA',
    })

    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.errors.some((e) => e.path.includes('transportadoraPessoaId'))).toBe(
        true
      )
    }
  })

  it('aceita FOB com transportadora', () => {
    const resultado = esquemaDeCriacaoDePedidoCompra.safeParse({
      ...payloadBase,
      modalidadeTransporte: 'FOB_CONHECIMENTO',
      transportadoraPessoaId: transportadoraId,
      valorFrete: 25,
    })

    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.transportadoraPessoaId).toBe(transportadoraId)
      expect(resultado.data.valorFrete).toBe(25)
    }
  })

  it('rejeita modalidade legada RETIRA', () => {
    const resultado = esquemaDeCriacaoDePedidoCompra.safeParse({
      ...payloadBase,
      modalidadeTransporte: 'RETIRA',
    })

    expect(resultado.success).toBe(false)
  })
})

describe('esquemaDeCriacaoDePedidoCompra — campos obrigatórios na conclusão', () => {
  const payloadCif = {
    ...payloadBase,
    modalidadeTransporte: 'CIF' as const,
  }

  it('permite rascunho sem datas', () => {
    const resultado = esquemaDeCriacaoDePedidoCompra.safeParse({
      ...payloadCif,
      concluir: false,
    })

    expect(resultado.success).toBe(true)
  })

  it('rejeita conclusão sem data de faturamento', () => {
    const resultado = esquemaDeCriacaoDePedidoCompra.safeParse({
      ...payloadCif,
      concluir: true,
      tipoCompra: 'revenda',
      previsaoEntrega: '2026-07-15',
    })

    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.errors.some((e) => e.path.includes('dataFaturamento'))).toBe(
        true
      )
    }
  })

  it('aceita conclusão com campos obrigatórios preenchidos', () => {
    const resultado = esquemaDeCriacaoDePedidoCompra.safeParse({
      ...payloadCif,
      concluir: true,
      tipoCompra: 'revenda',
      dataFaturamento: '2026-07-01',
      previsaoEntrega: '2026-07-15',
    })

    expect(resultado.success).toBe(true)
  })
})

describe('esquemaDeCriacaoDePedidoCompra — ordem data faturamento e previsão', () => {
  const payloadCif = {
    ...payloadBase,
    modalidadeTransporte: 'CIF' as const,
  }

  it('rejeita previsão de entrega anterior ao faturamento', () => {
    const resultado = esquemaDeCriacaoDePedidoCompra.safeParse({
      ...payloadCif,
      dataFaturamento: '2026-07-15',
      previsaoEntrega: '2026-07-01',
    })

    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.errors.some((e) => e.path.includes('previsaoEntrega'))).toBe(true)
    }
  })

  it('aceita previsão no mesmo dia do faturamento', () => {
    const resultado = esquemaDeCriacaoDePedidoCompra.safeParse({
      ...payloadCif,
      dataFaturamento: '2026-07-01',
      previsaoEntrega: '2026-07-01',
    })

    expect(resultado.success).toBe(true)
  })

  it('aceita previsão posterior ao faturamento', () => {
    const resultado = esquemaDeCriacaoDePedidoCompra.safeParse({
      ...payloadCif,
      dataFaturamento: '2026-07-01',
      previsaoEntrega: '2026-07-15',
    })

    expect(resultado.success).toBe(true)
  })
})
