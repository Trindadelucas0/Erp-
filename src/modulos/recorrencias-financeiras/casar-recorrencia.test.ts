import { describe, expect, it } from 'vitest'
import {
  casarRecorrencia,
  mensagemValorDivergenteRecorrencia,
  valoresIguaisEmCentavos,
} from './casar-recorrencia.js'

describe('valoresIguaisEmCentavos', () => {
  it('aceita iguais', () => {
    expect(valoresIguaisEmCentavos(2600, 2600)).toBe(true)
    expect(valoresIguaisEmCentavos(2600.0, 2600)).toBe(true)
    expect(valoresIguaisEmCentavos(10.1, 10.1)).toBe(true)
  })

  it('rejeita diferença de 1 centavo', () => {
    expect(valoresIguaisEmCentavos(2600, 2600.01)).toBe(false)
    expect(valoresIguaisEmCentavos(10.1, 10.11)).toBe(false)
  })
})

describe('casarRecorrencia', () => {
  const regras = [
    { id: 'r1', valor: 2600, produtoId: 'p1', produtoNome: 'Limpeza' },
    { id: 'r2', valor: 150, produtoId: 'p2', produtoNome: 'Água' },
  ]

  it('sem fornecedor → sem_recorrencia', () => {
    expect(
      casarRecorrencia({
        fornecedorPessoaId: null,
        valorTotal: 2600,
        recorrenciasAtivas: regras,
      }).status
    ).toBe('sem_recorrencia')
  })

  it('sem regras ativas → sem_recorrencia', () => {
    expect(
      casarRecorrencia({
        fornecedorPessoaId: 'f1',
        valorTotal: 2600,
        recorrenciasAtivas: [],
      }).status
    ).toBe('sem_recorrencia')
  })

  it('valor igual → casou', () => {
    const r = casarRecorrencia({
      fornecedorPessoaId: 'f1',
      valorTotal: 2600,
      recorrenciasAtivas: regras,
    })
    expect(r.status).toBe('casou')
    if (r.status === 'casou') {
      expect(r.recorrencia.id).toBe('r1')
      expect(r.recorrencia.produtoNome).toBe('Limpeza')
    }
  })

  it('valor diferente → valor_divergente', () => {
    const r = casarRecorrencia({
      fornecedorPessoaId: 'f1',
      valorTotal: 2500,
      recorrenciasAtivas: regras,
    })
    expect(r.status).toBe('valor_divergente')
    if (r.status === 'valor_divergente') {
      expect(r.valorNota).toBe(2500)
      expect(r.esperados).toHaveLength(2)
    }
  })

  it('mensagem de divergência cita valores', () => {
    const msg = mensagemValorDivergenteRecorrencia(2500, [
      { valor: 2600, produtoNome: 'Limpeza' },
    ])
    expect(msg).toContain('2.500')
    expect(msg).toContain('2.600')
    expect(msg).toContain('Limpeza')
  })
})
