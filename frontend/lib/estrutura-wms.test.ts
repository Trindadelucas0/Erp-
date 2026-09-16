import { describe, expect, it } from 'vitest'
import {
  FORM_GERAR_WMS_VAZIO,
  cadastroWmsProntoParaPreview,
  corpoGerarEstruturaWms,
} from './estrutura-wms'

describe('corpoGerarEstruturaWms', () => {
  it('no modo um envia o mesmo valor como início e fim', () => {
    const corpo = corpoGerarEstruturaWms({
      ...FORM_GERAR_WMS_VAZIO,
      modo: 'um',
      novoLocal: true,
      novaArea: true,
      localCodigo: 'A',
      areaCodigo: 'RC',
      ruaInicio: '20',
      ruaFim: '99',
      blocoInicio: '01',
      blocoFim: '08',
      andarInicio: '2',
      andarFim: '9',
      apartamentoInicio: '05',
      apartamentoFim: '12',
    })
    expect(corpo.localCodigo).toBe('A')
    expect(corpo.localId).toBeUndefined()
    expect(corpo.ruaInicio).toBe('20')
    expect(corpo.ruaFim).toBe('20')
    expect(corpo.apartamentoFim).toBe('05')
  })
})

describe('cadastroWmsProntoParaPreview', () => {
  it('exige local e área', () => {
    expect(cadastroWmsProntoParaPreview(FORM_GERAR_WMS_VAZIO)).toBe(false)
    expect(
      cadastroWmsProntoParaPreview({
        ...FORM_GERAR_WMS_VAZIO,
        localId: 'l1',
        areaId: 'a1',
      })
    ).toBe(true)
  })
})
