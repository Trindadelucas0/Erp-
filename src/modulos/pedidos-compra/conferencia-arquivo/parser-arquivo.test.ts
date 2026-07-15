import { describe, expect, it } from 'vitest'
import { detectarTipoArquivo, mapearLinhasParaItens } from './parser-arquivo.js'

describe('detectarTipoArquivo', () => {
  it('reconhece pdf, excel e csv pelo mime type', () => {
    expect(detectarTipoArquivo('application/pdf')).toBe('pdf')
    expect(detectarTipoArquivo('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('excel')
    expect(detectarTipoArquivo('application/vnd.ms-excel')).toBe('excel')
    expect(detectarTipoArquivo('text/csv')).toBe('csv')
    expect(detectarTipoArquivo('image/png')).toBe('desconhecido')
  })
})

describe('mapearLinhasParaItens', () => {
  it('extrai itens quando o cabeçalho é reconhecido', () => {
    const linhas = [
      ['Código', 'Descrição', 'Qtd', 'Preço Unit', 'Total'],
      ['001', 'Produto A', '10', '20,50', '205,00'],
      ['002', 'Produto B', '5', '1.234,00', '6.170,00'],
    ]

    const { itens, avisos } = mapearLinhasParaItens(linhas)

    expect(itens).toHaveLength(2)
    expect(itens[0]).toMatchObject({
      codigo: '001',
      descricao: 'Produto A',
      quantidade: 10,
      precoUnitario: 20.5,
      valorTotalItem: 205,
    })
    expect(itens[1].precoUnitario).toBe(1234)
    expect(avisos).toHaveLength(0)
  })

  it('avisa e ignora linha com quantidade/preço inválido', () => {
    const linhas = [
      ['Código', 'Descrição', 'Qtd', 'Preço Unit'],
      ['001', 'Produto A', 'abc', '20,00'],
    ]

    const { itens, avisos } = mapearLinhasParaItens(linhas)

    expect(itens).toHaveLength(0)
    expect(avisos).toHaveLength(1)
  })

  it('avisa quando não reconhece o cabeçalho da tabela', () => {
    const linhas = [['Foo', 'Bar']]
    const { itens, avisos } = mapearLinhasParaItens(linhas)
    expect(itens).toHaveLength(0)
    expect(avisos[0]).toMatch(/cabeçalho/i)
  })
})
