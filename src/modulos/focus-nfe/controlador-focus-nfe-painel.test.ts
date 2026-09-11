import { describe, expect, it } from 'vitest'
import {
  PAINEIS_ENTRADA_LISTAGEM,
  normalizarPainelEntradaListagem,
} from './paineis-entrada-listagem.js'

describe('normalizarPainelEntradaListagem', () => {
  it('aceita pronta_consolidar (não cai em analise)', () => {
    expect(normalizarPainelEntradaListagem('pronta_consolidar')).toBe('pronta_consolidar')
  })

  it('painel desconhecido cai em analise', () => {
    expect(normalizarPainelEntradaListagem('inexistente')).toBe('analise')
  })

  it('whitelist cobre todos os painéis da UI', () => {
    expect([...PAINEIS_ENTRADA_LISTAGEM]).toEqual([
      'analise',
      'aguardando_chegada',
      'contagem',
      'pronta_consolidar',
      'consolidada',
      'problemas',
      'cancelada',
    ])
  })
})
