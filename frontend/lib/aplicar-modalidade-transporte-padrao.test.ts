import { describe, expect, it } from 'vitest'
import { aplicarModalidadeTransportePadraoNoForm } from './pedido-compra-shared'

describe('aplicarModalidadeTransportePadraoNoForm', () => {
  it('retorna vazio quando fornecedor não tem padrão', () => {
    expect(aplicarModalidadeTransportePadraoNoForm(null)).toEqual({})
    expect(aplicarModalidadeTransportePadraoNoForm('')).toEqual({})
  })

  it('aplica CIF e limpa transportadora e frete', () => {
    expect(aplicarModalidadeTransportePadraoNoForm('CIF')).toEqual({
      modalidadeTransporte: 'CIF',
      transportadoraPessoaId: '',
      valorFrete: '',
      valorFreteSugerido: '0',
    })
  })

  it('aplica FOB sem limpar transportadora', () => {
    expect(aplicarModalidadeTransportePadraoNoForm('FOB_NOTA')).toEqual({
      modalidadeTransporte: 'FOB_NOTA',
    })
  })
})
