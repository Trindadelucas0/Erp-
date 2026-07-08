import { describe, expect, it } from 'vitest'
import { statusAposEdicao } from './resolver-status-edicao-pedido.js'

describe('statusAposEdicao', () => {
  it('promove rascunho para enviado quando concluir é true', () => {
    expect(statusAposEdicao('rascunho', true)).toBe('enviado')
  })

  it('não altera status quando concluir é false', () => {
    expect(statusAposEdicao('rascunho', false)).toBeUndefined()
  })

  it('não altera status quando concluir é omitido', () => {
    expect(statusAposEdicao('rascunho')).toBeUndefined()
  })

  it('não promove pedido já enviado', () => {
    expect(statusAposEdicao('enviado', true)).toBeUndefined()
  })

  it('não promove pedido parcial ou recebido', () => {
    expect(statusAposEdicao('parcial', true)).toBeUndefined()
    expect(statusAposEdicao('recebido', true)).toBeUndefined()
  })
})
