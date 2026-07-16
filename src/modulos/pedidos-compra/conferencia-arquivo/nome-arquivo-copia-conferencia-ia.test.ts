import { describe, expect, it } from 'vitest'
import {
  formatarTimestampConferenciaIa,
  nomeArquivoCopiaConferenciaIa,
} from './nome-arquivo-copia-conferencia-ia.js'

describe('nomeArquivoCopiaConferenciaIa', () => {
  it('monta nome com prefixo e timestamp no fuso de São Paulo', () => {
    const conferidoEm = new Date('2026-07-15T18:30:00.000Z')
    expect(formatarTimestampConferenciaIa(conferidoEm)).toBe('15-07-2026 15h30')
    expect(nomeArquivoCopiaConferenciaIa('Pedido Policorda.pdf', conferidoEm)).toBe(
      'Conferência IA - Pedido Policorda - 15-07-2026 15h30.pdf'
    )
  })

  it('remove extensão do nome original', () => {
    const conferidoEm = new Date('2026-01-02T15:05:00.000Z')
    expect(nomeArquivoCopiaConferenciaIa('orcamento.xlsx', conferidoEm)).toMatch(
      /^Conferência IA - orcamento - \d{2}-\d{2}-\d{4} \d{2}h\d{2}\.pdf$/
    )
  })
})
