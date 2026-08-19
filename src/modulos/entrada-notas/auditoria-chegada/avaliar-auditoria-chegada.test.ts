import { describe, expect, it } from 'vitest'
import {
  aceiteValido,
  avaliarAuditoriaChegada,
  fingerprintAchados,
  LIMIAR_SIMILARIDADE_NOME,
  pendenteLiberacaoChegada,
  precoUnitarioVenda,
} from './avaliar-auditoria-chegada.js'

function item(overrides: Partial<Parameters<typeof avaliarAuditoriaChegada>[0]['itens'][0]> = {}) {
  return {
    id: 'item-1',
    nItem: 1,
    produtoId: 'prod-1',
    descricao: 'Martelo',
    valorUnitario: 5.1,
    itensPorEmbalagem: 1,
    nomeSistema: 'Martelo',
    ...overrides,
  }
}

describe('avaliarAuditoriaChegada', () => {
  it('primeira compra (sem histórico) não alerta preço', () => {
    const r = avaliarAuditoriaChegada({
      itens: [item()],
      ultimaPorProduto: new Map(),
    })
    expect(r.achados.filter((a) => a.tipo === 'preco')).toHaveLength(0)
  })

  it('variação ≥ 30% alerta preço (5,10 → 35,00)', () => {
    const r = avaliarAuditoriaChegada({
      itens: [item({ valorUnitario: 35, descricao: 'X', nomeSistema: 'X' })],
      ultimaPorProduto: new Map([['prod-1', { produtoId: 'prod-1', precoUnitarioVenda: 5.1 }]]),
    })
    const preco = r.achados.find((a) => a.tipo === 'preco')
    expect(preco).toBeDefined()
    expect(preco?.precoAtual).toBe(35)
    expect(preco?.precoUltima).toBe(5.1)
  })

  it('variação abaixo de 30% não alerta preço', () => {
    const r = avaliarAuditoriaChegada({
      itens: [item({ valorUnitario: 6, descricao: 'X', nomeSistema: 'X' })],
      ultimaPorProduto: new Map([['prod-1', { produtoId: 'prod-1', precoUnitarioVenda: 5.1 }]]),
    })
    expect(r.achados.filter((a) => a.tipo === 'preco')).toHaveLength(0)
  })

  it('Martelo × Foice alerta nome', () => {
    const r = avaliarAuditoriaChegada({
      itens: [item({ descricao: 'Martelo', nomeSistema: 'Foice' })],
      ultimaPorProduto: new Map(),
    })
    const nome = r.achados.find((a) => a.tipo === 'nome')
    expect(nome).toBeDefined()
    expect(nome?.similaridade).toBeLessThan(LIMIAR_SIMILARIDADE_NOME)
  })

  it('Parafuso 8x40 × Parafuso sextavado 8x40 não alerta nome', () => {
    const r = avaliarAuditoriaChegada({
      itens: [
        item({
          descricao: 'Parafuso 8x40',
          nomeSistema: 'Parafuso sextavado 8x40',
        }),
      ],
      ultimaPorProduto: new Map(),
    })
    expect(r.achados.filter((a) => a.tipo === 'nome')).toHaveLength(0)
  })

  it('item sem produtoId é ignorado', () => {
    const r = avaliarAuditoriaChegada({
      itens: [item({ produtoId: null, descricao: 'A', nomeSistema: 'B' })],
      ultimaPorProduto: new Map(),
    })
    expect(r.achados).toHaveLength(0)
  })

  it('preço por unidade de venda usa itensPorEmbalagem', () => {
    expect(precoUnitarioVenda(100, 10)).toBe(10)
    const r = avaliarAuditoriaChegada({
      itens: [
        item({
          valorUnitario: 100,
          itensPorEmbalagem: 10,
          descricao: 'X',
          nomeSistema: 'X',
        }),
      ],
      ultimaPorProduto: new Map([['prod-1', { produtoId: 'prod-1', precoUnitarioVenda: 10 }]]),
    })
    expect(r.achados.filter((a) => a.tipo === 'preco')).toHaveLength(0)
  })

  it('fingerprint estável e aceite cai se achados mudam', () => {
    const a = avaliarAuditoriaChegada({
      itens: [item({ descricao: 'Martelo', nomeSistema: 'Foice' })],
      ultimaPorProduto: new Map(),
    })
    expect(a.fingerprint).toBe(fingerprintAchados(a.achados))
    const salvo = { ...a, aceitoEm: new Date().toISOString() }
    expect(aceiteValido(a, salvo)).toBe(true)
    expect(pendenteLiberacaoChegada(a, salvo)).toBe(false)

    const b = avaliarAuditoriaChegada({
      itens: [item({ descricao: 'Serrote', nomeSistema: 'Foice' })],
      ultimaPorProduto: new Map(),
    })
    expect(aceiteValido(b, salvo)).toBe(false)
    expect(pendenteLiberacaoChegada(b, null)).toBe(true)
  })

  it('sem achados libera sem aceite', () => {
    const r = avaliarAuditoriaChegada({
      itens: [item({ descricao: 'Mesmo', nomeSistema: 'Mesmo' })],
      ultimaPorProduto: new Map(),
    })
    expect(r.achados).toHaveLength(0)
    expect(pendenteLiberacaoChegada(r, null)).toBe(false)
  })
})
