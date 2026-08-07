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

  it('bip unidade incrementa 1', () => {
    const r = contagemCegaInterno.resolverBipNaSessao('7894174203803', itensSessao)
    expect(r).toEqual({ tipo: 'unidade', produtoId: 'p1', incremento: 1 })
  })

  it('bip caixa master incrementa quantidade da embalagem', () => {
    const r = contagemCegaInterno.resolverBipNaSessao('17894174203800', itensSessao)
    expect(r).toEqual({ tipo: 'master', produtoId: 'p1', incremento: 12 })
  })

  it('bip código fora da sessão retorna null', () => {
    expect(contagemCegaInterno.resolverBipNaSessao('0000000000000', itensSessao)).toBeNull()
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
    // cUF AAMM CNPJ mod serie(3) nNF(9) ...
    const chave =
      '35260812345678000190550010002651121234567890'
    // positions: serie 22-24 = 001, nNF 25-33 = 000265112
    const { serie, numero } = contagemCegaInterno.extrairSerieNumeroChave(chave)
    expect(serie).toBe('1')
    expect(numero).toBe('265112')
  })
})
