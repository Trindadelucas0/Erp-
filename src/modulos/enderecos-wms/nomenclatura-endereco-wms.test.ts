import { describe, expect, it } from 'vitest'
import {
  extrasBuscaEnderecoWms,
  LIMITE_LISTAGEM_ENDERECO_WMS_BUSCA,
  montarCodigoEnderecoWms,
  parsearCodigoEnderecoWms,
  parsearCodigoLegadoComTipo,
  resolverTakeListagemEnderecoWms,
  validarComponentesEnderecoWms,
} from './nomenclatura-endereco-wms.js'

describe('validarComponentesEnderecoWms / montarCodigoEnderecoWms', () => {
  it('monta A-RC-20-01-2-05', () => {
    const c = validarComponentesEnderecoWms({
      local: 'A',
      area: 'RC',
      rua: '20',
      bloco: '01',
      andar: '2',
      posicao: '05',
    })
    expect(montarCodigoEnderecoWms(c)).toBe('A-RC-20-01-2-05')
  })

  it('completa zero à esquerda em rua, bloco e apartamento', () => {
    const c = validarComponentesEnderecoWms({
      local: 'b',
      area: 'ex',
      rua: '5',
      bloco: '1',
      andar: '0',
      posicao: '7',
    })
    expect(c.local).toBe('B')
    expect(c.rua).toBe('05')
    expect(c.bloco).toBe('01')
    expect(c.posicao).toBe('07')
    expect(montarCodigoEnderecoWms(c)).toBe('B-EX-05-01-0-07')
  })

  it('rejeita letra no lugar da rua', () => {
    expect(() =>
      validarComponentesEnderecoWms({
        local: 'A',
        area: 'RC',
        rua: 'C',
        bloco: '01',
        andar: '2',
        posicao: '05',
      })
    ).toThrow('Rua deve ter números')
  })

  it('aceita local alfanumérico (catálogo decide depois)', () => {
    const c = validarComponentesEnderecoWms({
      local: 'C1',
      area: 'RC',
      rua: '20',
      bloco: '01',
      andar: '2',
      posicao: '05',
    })
    expect(montarCodigoEnderecoWms(c)).toBe('C1-RC-20-01-2-05')
  })

  it('rejeita área vazia', () => {
    expect(() =>
      validarComponentesEnderecoWms({
        local: 'A',
        area: '',
        rua: '20',
        bloco: '01',
        andar: '2',
        posicao: '05',
      })
    ).toThrow('Área deve ter 1 a 6 letras ou números')
  })
})

describe('parsearCodigoEnderecoWms', () => {
  it('lê o código canônico novo', () => {
    expect(parsearCodigoEnderecoWms('A-RC-20-01-2-05')).toEqual({
      local: 'A',
      area: 'RC',
      rua: '20',
      bloco: '01',
      andar: '2',
      posicao: '05',
    })
  })

  it('não interpreta o legado com tipo no meio como canônico', () => {
    expect(parsearCodigoEnderecoWms('A-RC-CH-20-2-05')).toBeNull()
  })

  it('rejeita compacto', () => {
    expect(parsearCodigoEnderecoWms('ARCCH20205')).toBeNull()
  })
})

describe('parsearCodigoLegadoComTipo', () => {
  it('migra A-RC-CH-20-2-05 para A-RC-20-01-2-05 com tipo CH', () => {
    expect(parsearCodigoLegadoComTipo('A-RC-CH-20-2-05')).toEqual({
      tipoEndereco: 'CH',
      componentes: {
        local: 'A',
        area: 'RC',
        rua: '20',
        bloco: '01',
        andar: '2',
        posicao: '05',
      },
    })
  })
})

describe('extrasBuscaEnderecoWms', () => {
  it('casa rótulo Recebimento com RC', () => {
    expect(extrasBuscaEnderecoWms('recebimento').areas).toEqual(['RC'])
  })

  it('casa chao acentuado com CH', () => {
    expect(extrasBuscaEnderecoWms('chao').tipos).toEqual(['CH'])
  })

  it('casa código curto EXATO (RC)', () => {
    expect(extrasBuscaEnderecoWms('RC').areas).toEqual(['RC'])
  })
})

describe('resolverTakeListagemEnderecoWms', () => {
  it('limita busca por q sem andar', () => {
    expect(resolverTakeListagemEnderecoWms({ q: 'RC 20' })).toBe(LIMITE_LISTAGEM_ENDERECO_WMS_BUSCA)
    expect(resolverTakeListagemEnderecoWms({ q: 'RC', take: 10 })).toBe(10)
  })

  it('não limita listagem por andar', () => {
    expect(resolverTakeListagemEnderecoWms({ andarId: 'andar-1', q: '05', take: 10 })).toBeUndefined()
  })

  it('não limita listagem sem termo', () => {
    expect(resolverTakeListagemEnderecoWms({})).toBeUndefined()
  })
})
