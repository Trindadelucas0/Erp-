import { describe, expect, it } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { parsearStatusesQuery } from './filtro-status-pedido.js'

describe('parsearStatusesQuery', () => {
  it('retorna undefined quando ausente', () => {
    expect(parsearStatusesQuery(undefined)).toBeUndefined()
    expect(parsearStatusesQuery('')).toBeUndefined()
  })

  it('parseia CSV em array válido', () => {
    expect(parsearStatusesQuery('rascunho,enviado')).toEqual(['rascunho', 'enviado'])
  })

  it('remove duplicados', () => {
    expect(parsearStatusesQuery('rascunho,rascunho,enviado')).toEqual(['rascunho', 'enviado'])
  })

  it('aceita array de query strings', () => {
    expect(parsearStatusesQuery(['rascunho', 'enviado,parcial'])).toEqual([
      'rascunho',
      'enviado',
      'parcial',
    ])
  })

  it('rejeita status inválido', () => {
    expect(() => parsearStatusesQuery('rascunho,invalido')).toThrow(ErroDaAplicacao)
  })
})
