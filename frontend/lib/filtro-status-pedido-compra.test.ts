import { describe, expect, it } from 'vitest'
import {
  rotuloResumoStatusFiltro,
  STATUS_FILTRO_PADRAO,
  statusesIguais,
} from './pedido-compra-shared'

describe('filtro de status — pedido de compra', () => {
  it('padrão não inclui cancelado nem recebido', () => {
    expect(STATUS_FILTRO_PADRAO).not.toContain('cancelado')
    expect(STATUS_FILTRO_PADRAO).not.toContain('recebido')
    expect(STATUS_FILTRO_PADRAO).toEqual(['rascunho', 'enviado', 'parcial'])
  })

  it('statusesIguais ignora ordem', () => {
    expect(statusesIguais(['rascunho', 'enviado'], ['enviado', 'rascunho'])).toBe(true)
    expect(statusesIguais(['rascunho'], ['enviado'])).toBe(false)
  })

  it('rotuloResumoStatusFiltro resume múltiplos status', () => {
    expect(rotuloResumoStatusFiltro(['rascunho', 'enviado'])).toBe('Rascunho, Enviado')
    expect(rotuloResumoStatusFiltro(['rascunho', 'enviado', 'parcial', 'recebido'])).toBe(
      'Rascunho, Enviado +2'
    )
    expect(rotuloResumoStatusFiltro(['rascunho', 'enviado', 'parcial', 'recebido', 'cancelado'])).toBe(
      'Todos os status'
    )
  })
})
