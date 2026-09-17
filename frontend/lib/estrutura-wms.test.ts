import { describe, expect, it } from 'vitest'
import {
  FORM_GERAR_WMS_VAZIO,
  cadastroWmsProntoParaPreview,
  corpoGerarEstruturaWms,
  formGerarAPartirDoNo,
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

describe('formGerarAPartirDoNo', () => {
  it('trava ancestrais da rua e deixa faixa de bloco em diante', () => {
    const arvore = [
      {
        id: 'local-A',
        nivel: 'local',
        codigo: 'A',
        nome: 'A',
        ativo: true,
        filhos: [
          {
            id: 'area-RC',
            nivel: 'area',
            codigo: 'RC',
            nome: 'RC',
            ativo: true,
            parentId: 'local-A',
            filhos: [
              {
                id: 'rua-20',
                nivel: 'rua',
                codigo: '20',
                nome: '20',
                ativo: true,
                parentId: 'area-RC',
                filhos: [],
              },
            ],
          },
        ],
      },
    ]
    const form = formGerarAPartirDoNo(arvore, arvore[0]!.filhos![0]!.filhos![0]!)
    expect(form.localId).toBe('local-A')
    expect(form.areaId).toBe('area-RC')
    expect(form.ruaId).toBe('rua-20')
    expect(form.novoLocal).toBe(false)
    expect(form.novaArea).toBe(false)
  })
})
