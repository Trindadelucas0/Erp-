import { describe, expect, it } from 'vitest'
import {
  formVazio,
  produtoJaExisteNosItens,
  substituirItemProdutoNosItens,
  validarCamposObrigatoriosLancamento,
} from './pedido-compra-shared'

describe('validarCamposObrigatoriosLancamento', () => {
  const formValido = {
    tipoCompra: 'revenda',
    dataFaturamento: '2026-07-01',
    previsaoEntrega: '2026-07-15',
  }

  it('aceita formulário com campos preenchidos', () => {
    expect(validarCamposObrigatoriosLancamento(formValido)).toBeNull()
  })

  it('exige tipo de compra válido', () => {
    expect(
      validarCamposObrigatoriosLancamento({ ...formValido, tipoCompra: '' })
    ).toBe('Selecione o tipo de compra.')
    expect(
      validarCamposObrigatoriosLancamento({ ...formValido, tipoCompra: 'invalido' })
    ).toBe('Selecione o tipo de compra.')
  })

  it('exige data de faturamento', () => {
    expect(
      validarCamposObrigatoriosLancamento({ ...formValido, dataFaturamento: '' })
    ).toBe('Informe a data de faturamento.')
  })

  it('exige previsão de entrega', () => {
    expect(
      validarCamposObrigatoriosLancamento({ ...formValido, previsaoEntrega: '' })
    ).toBe('Informe a previsão de entrega.')
  })

  it('rejeita previsão anterior ao faturamento', () => {
    expect(
      validarCamposObrigatoriosLancamento({
        ...formValido,
        dataFaturamento: '2026-07-15',
        previsaoEntrega: '2026-07-01',
      })
    ).toBe('Previsão de entrega não pode ser anterior à data de faturamento.')
  })

  it('aceita previsão no mesmo dia do faturamento', () => {
    expect(
      validarCamposObrigatoriosLancamento({
        ...formValido,
        dataFaturamento: '2026-07-01',
        previsaoEntrega: '2026-07-01',
      })
    ).toBeNull()
  })

  it('formVazio sem datas retorna erro de faturamento', () => {
    expect(validarCamposObrigatoriosLancamento(formVazio)).toBe(
      'Informe a data de faturamento.'
    )
  })
})

describe('produtoJaExisteNosItens', () => {
  const itens = [{ produtoId: 'a' }, { produtoId: 'b' }, { produtoId: 'a' }]

  it('retorna false quando produtoId está vazio', () => {
    expect(produtoJaExisteNosItens(itens, '')).toBe(false)
  })

  it('detecta produto já lançado', () => {
    expect(produtoJaExisteNosItens(itens, 'a')).toBe(true)
    expect(produtoJaExisteNosItens(itens, 'c')).toBe(false)
  })

  it('ignora o índice em edição', () => {
    expect(produtoJaExisteNosItens(itens, 'b', 1)).toBe(false)
    expect(produtoJaExisteNosItens(itens, 'a', 0)).toBe(true)
  })
})

describe('substituirItemProdutoNosItens', () => {
  it('substitui o lançamento anterior sem duplicar', () => {
    const itens = [
      { produtoId: 'a', quantidade: '1' },
      { produtoId: 'b', quantidade: '2' },
    ]
    const resultado = substituirItemProdutoNosItens(
      itens,
      { produtoId: 'a', quantidade: '5' },
      null
    )
    expect(resultado).toEqual([
      { produtoId: 'a', quantidade: '5' },
      { produtoId: 'b', quantidade: '2' },
    ])
  })

  it('remove outras ocorrências ao editar para produto já existente', () => {
    const itens = [
      { produtoId: 'a', quantidade: '1' },
      { produtoId: 'b', quantidade: '2' },
      { produtoId: 'c', quantidade: '3' },
    ]
    const resultado = substituirItemProdutoNosItens(
      itens,
      { produtoId: 'a', quantidade: '9' },
      2
    )
    expect(resultado).toEqual([
      { produtoId: 'b', quantidade: '2' },
      { produtoId: 'a', quantidade: '9' },
    ])
  })
})
