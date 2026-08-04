import { describe, expect, it } from 'vitest'

/**
 * Contrato da fórmula usada em servico-pipeline-entrada ao montar linhas de estoque:
 * qtd estoque = qtd NF × itensPorEmbalagem
 * precoCusto = (valorUnitario × qtdNF + freteRateado) / qtdEstoque
 */
describe('custo unitário entrada NF (contrato)', () => {
  it('rateia frete e embalagem no custo por unidade de estoque', () => {
    const quantidadeNf = 2
    const valorUnitario = 10
    const custoFreteRateado = 4
    const itensPorEmbalagem = 5
    const quantidadeEstoque =
      Math.round(quantidadeNf * itensPorEmbalagem * 10000) / 10000
    const custoLinha = valorUnitario * quantidadeNf + custoFreteRateado
    const precoCusto = Math.round((custoLinha / quantidadeEstoque) * 10000) / 10000

    expect(quantidadeEstoque).toBe(10)
    expect(precoCusto).toBe(2.4)
  })

  it('sem frete e embalagem 1 mantém valor unitário da NF', () => {
    const quantidadeNf = 3
    const valorUnitario = 7.5
    const custoFreteRateado = 0
    const itensPorEmbalagem = 1
    const quantidadeEstoque = quantidadeNf * itensPorEmbalagem
    const precoCusto =
      Math.round(
        ((valorUnitario * quantidadeNf + custoFreteRateado) / quantidadeEstoque) * 10000
      ) / 10000
    expect(precoCusto).toBe(7.5)
  })
})

describe('fluxo contagem → consolidar (regra de status)', () => {
  it('permite consolidar a partir de entrada_contagem; bloqueia só se já consolidada', () => {
    function podeConsolidar(status: string) {
      if (status === 'entrada_consolidada') return false
      if (status === 'cancelada' || status === 'com_problema' || status === 'problema_resolvido') {
        return false
      }
      // aberta ou entrada_contagem
      return true
    }
    expect(podeConsolidar('entrada_contagem')).toBe(true)
    expect(podeConsolidar('em_analise')).toBe(true)
    expect(podeConsolidar('entrada_consolidada')).toBe(false)
    expect(podeConsolidar('cancelada')).toBe(false)
  })
})
