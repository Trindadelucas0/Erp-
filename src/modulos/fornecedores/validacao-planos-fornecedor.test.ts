import { describe, expect, it } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  assertTodosPlanosDespesaEncontrados,
  coletarIdsPlanosFinanceiros,
} from './validacao-planos-fornecedor.js'

describe('coletarIdsPlanosFinanceiros', () => {
  it('deduplica IDs de planos liberados, alternativo e pares', () => {
    const ids = coletarIdsPlanosFinanceiros({
      planosFinanceirosIds: ['p1', 'p2'],
      planoFinanceiroAlternativoId: 'p2',
      paresPlanoCfopPadrao: [{ planoFinanceiroId: 'p3', cfopId: 'c1' }],
    })
    expect(ids).toEqual(['p1', 'p2', 'p3'])
  })
})

describe('assertTodosPlanosDespesaEncontrados', () => {
  it('aceita quando todos os planos despesa foram encontrados', () => {
    expect(() =>
      assertTodosPlanosDespesaEncontrados(['d1', 'd2'], [{ id: 'd1' }, { id: 'd2' }])
    ).not.toThrow()
  })

  it('rejeita quando plano de receita não consta no resultado (filtro despesa)', () => {
    expect(() =>
      assertTodosPlanosDespesaEncontrados(['receita-1'], [])
    ).toThrow(ErroDaAplicacao)

    try {
      assertTodosPlanosDespesaEncontrados(['receita-1'], [])
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDaAplicacao)
      expect((erro as ErroDaAplicacao).message).toBe('Plano financeiro deve ser do tipo Despesas')
      expect((erro as ErroDaAplicacao).statusCode).toBe(400)
    }
  })

  it('ignora validação quando não há planos vinculados', () => {
    expect(() => assertTodosPlanosDespesaEncontrados([], [])).not.toThrow()
  })
})
