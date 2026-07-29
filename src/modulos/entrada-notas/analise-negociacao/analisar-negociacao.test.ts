import { describe, expect, it } from 'vitest'
import { analisarNegociacao } from './analisar-negociacao.js'

describe('analisarNegociacao — modo documental', () => {
  it('sem PO e modoDocumental=true → aviso, não bloqueante', () => {
    const resultado = analisarNegociacao({
      itensNf: [{ id: 'item-1', produtoId: null, quantidade: 1, valorUnitario: 10 }],
      pedido: null,
      prazoNf: null,
      prazoInformadoUsuario: null,
      modoDocumental: true,
    })

    expect(resultado.resultado.status).toBe('aviso')
    expect(resultado.resultado.bloqueios).toHaveLength(0)
    expect(resultado.resultado.avisos[0]).toContain('documental')
    expect(resultado.classificacao).toBe('sem_pedido')
    expect(resultado.itensCritica[0].criticaNegociacao).toBe(false)
  })

  it('sem PO e modoDocumental=false → bloqueante (comportamento atual)', () => {
    const resultado = analisarNegociacao({
      itensNf: [{ id: 'item-1', produtoId: null, quantidade: 1, valorUnitario: 10 }],
      pedido: null,
      prazoNf: null,
      prazoInformadoUsuario: null,
    })

    expect(resultado.resultado.status).toBe('bloqueante')
    expect(resultado.resultado.bloqueios[0]).toContain('pedido de compra')
  })
})
