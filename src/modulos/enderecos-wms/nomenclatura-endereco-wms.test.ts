import { describe, expect, it } from 'vitest'
import {
  extrasBuscaEnderecoWms,
  montarCodigoEnderecoWms,
  parsearCodigoEnderecoWms,
  validarComponentesEnderecoWms,
} from './nomenclatura-endereco-wms.js'

describe('validarComponentesEnderecoWms / montarCodigoEnderecoWms', () => {
  it('monta A-RC-CH-20-2-05', () => {
    const c = validarComponentesEnderecoWms({
      local: 'A',
      area: 'RC',
      tipo: 'CH',
      rua: '20',
      andar: '2',
      posicao: '05',
    })
    expect(montarCodigoEnderecoWms(c)).toBe('A-RC-CH-20-2-05')
  })

  it('completa zero à esquerda em rua e posição', () => {
    const c = validarComponentesEnderecoWms({
      local: 'b',
      area: 'ex',
      tipo: 'pp',
      rua: '5',
      andar: '0',
      posicao: '7',
    })
    expect(c.local).toBe('B')
    expect(c.rua).toBe('05')
    expect(c.posicao).toBe('07')
    expect(montarCodigoEnderecoWms(c)).toBe('B-EX-PP-05-0-07')
  })

  it('rejeita letra no lugar da rua (caso A RC CH C 20 2)', () => {
    expect(() =>
      validarComponentesEnderecoWms({
        local: 'A',
        area: 'RC',
        tipo: 'CH',
        rua: 'C',
        andar: '20',
        posicao: '2',
      })
    ).toThrow('Rua deve ter 2 números')
  })

  it('rejeita local fora da lista', () => {
    expect(() =>
      validarComponentesEnderecoWms({
        local: 'C',
        area: 'RC',
        tipo: 'CH',
        rua: '20',
        andar: '2',
        posicao: '05',
      })
    ).toThrow('Local deve ser A ou B')
  })

  it('rejeita área inválida', () => {
    expect(() =>
      validarComponentesEnderecoWms({
        local: 'A',
        area: 'XX',
        tipo: 'CH',
        rua: '20',
        andar: '2',
        posicao: '05',
      })
    ).toThrow('Área deve ser RC, EX ou CQ')
  })

  it('rejeita tipo inválido', () => {
    expect(() =>
      validarComponentesEnderecoWms({
        local: 'A',
        area: 'RC',
        tipo: 'ZZ',
        rua: '20',
        andar: '2',
        posicao: '05',
      })
    ).toThrow('Tipo de endereço deve ser PP, CX, CH ou BC')
  })

  it('rejeita tamanho errado de andar e posição', () => {
    expect(() =>
      validarComponentesEnderecoWms({
        local: 'A',
        area: 'RC',
        tipo: 'CH',
        rua: '20',
        andar: '',
        posicao: '05',
      })
    ).toThrow('Andar deve ter 1 número')
  })
})

describe('parsearCodigoEnderecoWms', () => {
  it('lê o código canônico', () => {
    expect(parsearCodigoEnderecoWms('A-RC-CH-20-2-05')).toEqual({
      local: 'A',
      area: 'RC',
      tipo: 'CH',
      rua: '20',
      andar: '2',
      posicao: '05',
    })
  })

  it('rejeita compacto e formato antigo com letra na rua', () => {
    expect(parsearCodigoEnderecoWms('ARCCH20205')).toBeNull()
    expect(parsearCodigoEnderecoWms('A-RC-CH-C-20-2')).toBeNull()
  })
})

describe('extrasBuscaEnderecoWms', () => {
  it('casa rótulo Recebimento com RC', () => {
    expect(extrasBuscaEnderecoWms('recebimento').areas).toEqual(['RC'])
  })

  it('casa chao acentuado com CH', () => {
    expect(extrasBuscaEnderecoWms('chao').tipos).toEqual(['CH'])
  })

  it('casa código curto EXATO (RC) e não trecho de 1 letra em rótulo', () => {
    expect(extrasBuscaEnderecoWms('RC').areas).toEqual(['RC'])
    expect(extrasBuscaEnderecoWms('a').locais).toEqual(['A'])
  })
})
