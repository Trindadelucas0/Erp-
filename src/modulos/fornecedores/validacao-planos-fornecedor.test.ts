import { describe, expect, it } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  MSG_PLANO_SUBGRUPO_DESPESA,
  assertTodosPlanosSubgrupoDespesaEncontrados,
  coletarIdsPlanosFinanceiros,
} from './validacao-planos-fornecedor.js'

describe('coletarIdsPlanosFinanceiros', () => {
  it('deduplica IDs de planos liberados e pares', () => {
    const ids = coletarIdsPlanosFinanceiros({
      planosFinanceirosIds: ['p1', 'p2'],
      paresPlanoCfopPadrao: [{ planoFinanceiroId: 'p2', cfopId: 'c1' }],
    })
    expect(ids).toEqual(['p1', 'p2'])
  })
})

describe('assertTodosPlanosSubgrupoDespesaEncontrados', () => {
  it('aceita quando todos os subgrupos despesa foram encontrados', () => {
    expect(() =>
      assertTodosPlanosSubgrupoDespesaEncontrados(['d1', 'd2'], [{ id: 'd1' }, { id: 'd2' }])
    ).not.toThrow()
  })

  it('rejeita quando plano não é subgrupo despesa ativo', () => {
    expect(() =>
      assertTodosPlanosSubgrupoDespesaEncontrados(['grupo-2-2'], [])
    ).toThrow(ErroDaAplicacao)

    try {
      assertTodosPlanosSubgrupoDespesaEncontrados(['grupo-2-2'], [])
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDaAplicacao)
      expect((erro as ErroDaAplicacao).message).toBe(MSG_PLANO_SUBGRUPO_DESPESA)
      expect((erro as ErroDaAplicacao).statusCode).toBe(400)
    }
  })

  it('ignora validação quando não há planos vinculados', () => {
    expect(() => assertTodosPlanosSubgrupoDespesaEncontrados([], [])).not.toThrow()
  })
})
