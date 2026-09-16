import { describe, expect, it } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { TETO_GERAR_ENDERECOS_WMS } from '../enderecos-wms/nomenclatura-endereco-wms.js'
import { calcularFaixasGeracao, exemplosCodigoGeracao } from './gerar-estrutura-wms.js'

describe('calcularFaixasGeracao', () => {
  it('calcula o total da faixa', () => {
    const r = calcularFaixasGeracao({
      localId: 'l',
      areaId: 'a',
      blocoInicio: '01',
      blocoFim: '02',
      andarInicio: '1',
      andarFim: '2',
      apartamentoInicio: '01',
      apartamentoFim: '02',
      tipoPadrao: 'CH',
      ruaInicio: '01',
      ruaFim: '02',
    })
    expect(r.total).toBe(2 * 2 * 2 * 2)
  })

  it('recusa acima do teto de 10 mil', () => {
    expect(() =>
      calcularFaixasGeracao({
        localId: 'l',
        areaId: 'a',
        blocoInicio: '01',
        blocoFim: '10',
        andarInicio: '1',
        andarFim: '10',
        apartamentoInicio: '01',
        apartamentoFim: '50',
        tipoPadrao: 'CH',
        ruaInicio: '01',
        ruaFim: '50',
      })
    ).toThrow(ErroDaAplicacao)
    try {
      calcularFaixasGeracao({
        localId: 'l',
        areaId: 'a',
        blocoInicio: '01',
        blocoFim: '10',
        andarInicio: '1',
        andarFim: '10',
        apartamentoInicio: '01',
        apartamentoFim: '50',
        tipoPadrao: 'CH',
        ruaInicio: '01',
        ruaFim: '50',
      })
    } catch (e) {
      expect((e as ErroDaAplicacao).message).toContain(String(TETO_GERAR_ENDERECOS_WMS))
    }
  })
})

describe('exemplosCodigoGeracao', () => {
  it('mostra A-RC-20-01-2-05', () => {
    expect(
      exemplosCodigoGeracao({
        local: 'A',
        area: 'RC',
        ruas: ['20'],
        blocos: ['01'],
        andares: ['2'],
        aps: ['05'],
      })
    ).toEqual(['A-RC-20-01-2-05'])
  })
})
