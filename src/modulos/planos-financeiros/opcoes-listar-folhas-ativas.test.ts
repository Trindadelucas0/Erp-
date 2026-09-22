import { describe, expect, it } from 'vitest'
import { montarOpcoesListarFolhasAtivas } from './opcoes-listar-folhas-ativas.js'

describe('montarOpcoesListarFolhasAtivas', () => {
  it('sem q: todas as folhas, sem take', () => {
    const opcoes = montarOpcoesListarFolhasAtivas('company-001', undefined, 'despesa')

    expect(opcoes).toEqual({
      where: {
        companyId: 'company-001',
        ativo: true,
        children: { none: {} },
        tipo: 'despesa',
      },
      orderBy: { codigo: 'asc' },
    })
    expect(opcoes).not.toHaveProperty('take')
  })

  it('com q: take 50 e filtro textual nas folhas', () => {
    const opcoes = montarOpcoesListarFolhasAtivas('company-001', 'ates', 'despesa')

    expect(opcoes.take).toBe(50)
    expect(opcoes.where).toMatchObject({
      companyId: 'company-001',
      ativo: true,
      children: { none: {} },
      tipo: 'despesa',
    })
    expect(opcoes.where).toHaveProperty('OR')
  })

  it('somenteSubgrupo exige parentId', () => {
    const opcoes = montarOpcoesListarFolhasAtivas(
      'company-001',
      undefined,
      'despesa',
      true
    )

    expect(opcoes.where).toMatchObject({
      parentId: { not: null },
      children: { none: {} },
    })
    expect(opcoes).not.toHaveProperty('take')
  })
})
