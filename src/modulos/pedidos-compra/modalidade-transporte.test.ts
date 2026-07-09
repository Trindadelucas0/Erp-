import { describe, expect, it } from 'vitest'
import {
  exigeDadosTransporte,
  normalizarModalidadeTransporte,
} from './modalidade-transporte.js'

describe('modalidade-transporte', () => {
  it('converte RETIRA legado para CIF', () => {
    expect(normalizarModalidadeTransporte('RETIRA')).toBe('CIF')
    expect(normalizarModalidadeTransporte('retira')).toBe('CIF')
  })

  it('mantém modalidades atuais', () => {
    expect(normalizarModalidadeTransporte('FOB_NOTA')).toBe('FOB_NOTA')
    expect(normalizarModalidadeTransporte('CIF')).toBe('CIF')
  })

  it('identifica FOB como exigindo dados de transporte', () => {
    expect(exigeDadosTransporte('FOB_NOTA')).toBe(true)
    expect(exigeDadosTransporte('FOB_CONHECIMENTO')).toBe(true)
    expect(exigeDadosTransporte('CIF')).toBe(false)
    expect(exigeDadosTransporte('RETIRA')).toBe(false)
  })
})
