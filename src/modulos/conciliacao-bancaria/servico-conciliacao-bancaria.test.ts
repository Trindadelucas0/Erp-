import { describe, expect, it } from 'vitest'
import { sugerirCorrespondencias } from './servico-conciliacao-bancaria.js'

const data = new Date('2026-10-03T00:00:00.000Z')

describe('sugerirCorrespondencias', () => {
  it('sugere quando valor assinado e dia são iguais', () => {
    const sugestoes = sugerirCorrespondencias(
      [{ id: 'linha', data, valor: -42, documento: 'TAR 1', historico: 'Tarifa' }],
      [{ id: 'baixa', data, valor: -42, documento: 'TAR 1', conciliacaoId: null }]
    )
    expect(sugestoes).toEqual([{ linhaId: 'linha', baixaId: 'baixa' }])
  })

  it('não sugere valor com sinal oposto nem baixa já conciliada', () => {
    expect(
      sugerirCorrespondencias(
        [{ id: 'linha', data, valor: 42, documento: null, historico: 'TED' }],
        [{ id: 'baixa', data, valor: -42, documento: null, conciliacaoId: null }]
      )
    ).toEqual([])
    expect(
      sugerirCorrespondencias(
        [{ id: 'linha', data, valor: 42, documento: null, historico: 'TED' }],
        [{ id: 'baixa', data, valor: 42, documento: null, conciliacaoId: 'conciliada' }]
      )
    ).toEqual([])
  })

  it('não sugere quando dois candidatos continuam empatados', () => {
    const linha = [{ id: 'linha', data, valor: 100, documento: null, historico: 'PIX' }]
    const baixas = [
      { id: 'a', data, valor: 100, documento: null, conciliacaoId: null },
      { id: 'b', data, valor: 100, documento: null, conciliacaoId: null },
    ]
    expect(sugerirCorrespondencias(linha, baixas)).toEqual([])
  })
})
