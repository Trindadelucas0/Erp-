import { describe, expect, it } from 'vitest'
import {
  mensagemBloqueioConsolidar,
  podeConsolidarEstoque,
} from './status-entrada-contagem.js'

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
  it('NFe com produtos: consolidar só com entrada_contagem_ok', () => {
    const fisico = { exigeContagemFisica: true }
    expect(podeConsolidarEstoque('entrada_contagem', fisico)).toBe(false)
    expect(podeConsolidarEstoque('entrada_contagem_ok', fisico)).toBe(true)
    expect(podeConsolidarEstoque('entrada_contagem_divergente', fisico)).toBe(false)
    expect(podeConsolidarEstoque('entrada_consolidada', fisico)).toBe(false)
    expect(mensagemBloqueioConsolidar('entrada_contagem')).toMatch(/contagem logística/i)
    expect(mensagemBloqueioConsolidar('entrada_contagem_divergente')).toMatch(/divergente/i)
  })

  it('documental sem produtos: permite consolidar em pronta_para_consolidar; bloqueia divergente', () => {
    const doc = { exigeContagemFisica: false }
    expect(podeConsolidarEstoque('em_analise', doc)).toBe(false)
    expect(podeConsolidarEstoque('pronta_para_consolidar', doc)).toBe(true)
    expect(podeConsolidarEstoque('entrada_contagem', doc)).toBe(true)
    expect(podeConsolidarEstoque('entrada_contagem_ok', doc)).toBe(false)
    expect(podeConsolidarEstoque('entrada_contagem_divergente', doc)).toBe(false)
    expect(podeConsolidarEstoque('entrada_consolidada', doc)).toBe(false)
  })
})
