import { describe, expect, it } from 'vitest'
import { montarDetalheEnderecoWms } from './endereco-wms'

describe('montarDetalheEnderecoWms', () => {
  it('expande A-CQ-01-01-1-01 com nomes de local e área', () => {
    const d = montarDetalheEnderecoWms({
      codigoCompleto: 'A-CQ-01-01-1-01',
      tipoEndereco: 'CX',
    })
    expect(d?.codigo).toBe('A-CQ-01-01-1-01')
    expect(d?.local).toBe('Local A — Prédio principal da fábrica')
    expect(d?.area).toBe('Área CQ — Controle de Qualidade')
    expect(d?.caminho).toBe('Rua 01 · Bloco 01 · Andar 1 · Apartamento 01')
    expect(d?.tipo).toBe('CX — Caixa')
  })
})
