import { describe, expect, it } from 'vitest'
import { contagemCegaInterno } from './servico-contagens.js'

describe('contagem cega — bip e comparação', () => {
  const itensSessao = [
    {
      produtoId: 'p1',
      produto: {
        codigoBarras: '7894174203803',
        embalagensMaster: [{ codigoBarras: '17894174203800', quantidade: 12 }],
      },
    },
    {
      produtoId: 'p2',
      produto: {
        codigoBarras: '7891234567895',
        embalagensMaster: [],
      },
    },
  ]

  it('bip unidade incrementa 1 (sem dividir)', () => {
    const r = contagemCegaInterno.resolverBipNaSessao('7894174203803', itensSessao)
    expect(r).toEqual({ tipo: 'unidade', produtoId: 'p1', incremento: 1 })
    expect(contagemCegaInterno.incrementoBipEmUnidadeVenda(r!.incremento)).toBe(1)
  })

  it('bip caixa master incrementa quantidade da embalagem', () => {
    const r = contagemCegaInterno.resolverBipNaSessao('17894174203800', itensSessao)
    expect(r).toEqual({ tipo: 'master', produtoId: 'p1', incremento: 12 })
    expect(contagemCegaInterno.incrementoBipEmUnidadeVenda(r!.incremento)).toBe(12)
  })

  it('bip código fora da sessão retorna null', () => {
    expect(contagemCegaInterno.resolverBipNaSessao('0000000000000', itensSessao)).toBeNull()
  })

  it('esperado = qtd NF × multiplicador (unidade de venda)', () => {
    expect(contagemCegaInterno.calcularQtdEsperadaVenda(2, 12)).toBe(24)
    expect(contagemCegaInterno.calcularQtdEsperadaVenda(10, 1)).toBe(10)
  })

  it('descrição do ! no formato novo (sem revelar qtd da NF)', () => {
    expect(
      contagemCegaInterno.formatarDescricaoEmbalagem({
        multiplicador: 12,
        nomeUnidadeCompra: 'Fardo',
        nomeUnidadeVenda: 'Unidade',
        embalagensMaster: [],
      })
    ).toBe('1 fardo = 12 unidades')
    expect(
      contagemCegaInterno.formatarDescricaoEmbalagem({
        multiplicador: 1,
        nomeUnidadeCompra: 'Caixa',
        nomeUnidadeVenda: 'Unidade',
        embalagensMaster: [{ descricao: 'Caixa master', quantidade: 4 }],
      })
    ).toBe('Caixa master: 4 unidades')
    expect(
      contagemCegaInterno.formatarDescricaoEmbalagem({
        multiplicador: 1,
        nomeUnidadeCompra: 'Unidade',
        nomeUnidadeVenda: 'Unidade',
        embalagensMaster: [{ quantidade: 1 }],
      })
    ).toBeNull()
  })

  it('comparar 24 vs 24 OK', () => {
    const { divergentes, updates } = contagemCegaInterno.compararItens([
      { id: 'i1', nomeExibicao: 'Produto A', qtdEsperada: 24, qtdContada: 24 },
      { id: 'i2', nomeExibicao: 'Produto B', qtdEsperada: 24, qtdContada: 20 },
    ])
    expect(divergentes).toEqual(['Produto B'])
    expect(updates).toEqual([
      { id: 'i1', statusItem: 'ok' },
      { id: 'i2', statusItem: 'divergente' },
    ])
  })

  it('compararItens lista só nomes divergentes e marca status', () => {
    const { divergentes, updates } = contagemCegaInterno.compararItens([
      { id: 'i1', nomeExibicao: 'Anel', qtdEsperada: 10, qtdContada: 10 },
      { id: 'i2', nomeExibicao: 'Cola PVC', qtdEsperada: 5, qtdContada: 4 },
    ])
    expect(divergentes).toEqual(['Cola PVC'])
    expect(updates).toEqual([
      { id: 'i1', statusItem: 'ok' },
      { id: 'i2', statusItem: 'divergente' },
    ])
  })

  it('multiplicador embalagem default 1', () => {
    expect(contagemCegaInterno.resolverItensPorEmbalagem(undefined, 'f1')).toBe(1)
    expect(
      contagemCegaInterno.resolverItensPorEmbalagem(
        [{ fornecedorPessoaId: 'f1', multiplicadorEntrada: 6 }],
        'f1'
      )
    ).toBe(6)
  })

  it('extrai série e número da chave 44', () => {
    const chave =
      '35260812345678000190550010002651121234567890'
    const { serie, numero } = contagemCegaInterno.extrairSerieNumeroChave(chave)
    expect(serie).toBe('1')
    expect(numero).toBe('265112')
  })
})
