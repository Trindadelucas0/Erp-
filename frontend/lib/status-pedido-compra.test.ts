import { describe, expect, it } from 'vitest'
import { podeConcluirPedido, rotuloStatusUi, varianteStatusUi } from './status-pedido-compra'

describe('status-pedido-compra', () => {
  it('exibe rótulos distintos por status do banco', () => {
    expect(rotuloStatusUi('rascunho')).toBe('Rascunho')
    expect(rotuloStatusUi('enviado')).toBe('Enviado')
    expect(rotuloStatusUi('aprovado')).toBe('Aprovado')
    expect(rotuloStatusUi('parcial')).toBe('Entregue parcialmente')
    expect(rotuloStatusUi('recebido')).toBe('Concluído')
    expect(rotuloStatusUi('cancelado')).toBe('Cancelado')
  })

  it('usa variantes distintas por status', () => {
    expect(varianteStatusUi('rascunho')).toBe('inativo')
    expect(varianteStatusUi('enviado')).toBe('aguardando')
    expect(varianteStatusUi('aprovado')).toBe('ativo')
    expect(varianteStatusUi('parcial')).toBe('pendente')
    expect(varianteStatusUi('recebido')).toBe('ativo')
    expect(varianteStatusUi('cancelado')).toBe('reprovado')
  })

  it('permite concluir apenas rascunho', () => {
    expect(podeConcluirPedido('rascunho')).toBe(true)
    expect(podeConcluirPedido('enviado')).toBe(false)
    expect(podeConcluirPedido('aprovado')).toBe(false)
    expect(podeConcluirPedido('parcial')).toBe(false)
    expect(podeConcluirPedido('recebido')).toBe(false)
  })
})
