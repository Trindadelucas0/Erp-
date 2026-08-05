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

describe('analisarNegociacao — mensagens e categorias', () => {
  it('item vinculado fora do PO usa nomeSistema e categoria fora_pedido', () => {
    const resultado = analisarNegociacao({
      itensNf: [
        {
          id: 'item-1',
          produtoId: 'prod-joeiro',
          quantidade: 10,
          valorUnitario: 5,
          nomeSistema: 'JOEIRO 90',
          descricaoNf: 'JOEIRO DESC NF',
        },
      ],
      pedido: {
        id: 'po-1',
        numero: 6,
        condicaoPagamento: '30 dias',
        prazosPagamento: null,
        itens: [{ produtoId: 'outro-prod', quantidade: 10, precoUnitario: 5, nome: 'OUTRO' }],
      },
      prazoNf: '30 dias',
      prazoInformadoUsuario: null,
    })

    expect(resultado.resultado.status).toBe('bloqueante')
    expect(resultado.resultado.bloqueios[0]).toBe('JOEIRO 90 não está no pedido #6.')
    const achados = resultado.resultado.detalhes?.achados as
      | Array<{ categoria: string; severidade: string; mensagem: string }>
      | undefined
    expect(achados).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categoria: 'fora_pedido',
          severidade: 'bloqueio',
          mensagem: 'JOEIRO 90 não está no pedido #6.',
          produto: 'JOEIRO 90',
          numeroPedido: 6,
        }),
      ])
    )
    expect(resultado.itensCritica[0].criticaNegociacao).toBe(true)
  })

  it('sem nomeSistema usa descricaoNf como fallback', () => {
    const resultado = analisarNegociacao({
      itensNf: [
        {
          id: 'item-1',
          produtoId: 'prod-x',
          quantidade: 1,
          valorUnitario: 1,
          descricaoNf: 'PRODUTO DA NF',
        },
      ],
      pedido: {
        id: 'po-1',
        numero: 2,
        condicaoPagamento: 'à vista',
        prazosPagamento: null,
        itens: [],
      },
      prazoNf: 'à vista',
      prazoInformadoUsuario: null,
    })

    expect(resultado.resultado.bloqueios[0]).toBe('PRODUTO DA NF não está no pedido #2.')
  })

  it('quantidade acima inclui nome e categoria quantidade', () => {
    const resultado = analisarNegociacao({
      itensNf: [
        {
          id: 'item-1',
          produtoId: 'p1',
          quantidade: 440,
          valorUnitario: 2.25,
          nomeSistema: 'JOELHO LR 25X1/2',
        },
      ],
      pedido: {
        id: 'po-1',
        numero: 6,
        condicaoPagamento: '30 dias',
        prazosPagamento: null,
        itens: [{ produtoId: 'p1', quantidade: 420, precoUnitario: 2.25, nome: 'JOELHO LR 25X1/2' }],
      },
      prazoNf: '30 dias',
      prazoInformadoUsuario: null,
    })

    expect(resultado.resultado.bloqueios[0]).toContain('Quantidade acima do pedido')
    expect(resultado.resultado.bloqueios[0]).toContain('JOELHO LR 25X1/2')
    const achados = resultado.resultado.detalhes?.achados as Array<{
      categoria: string
      produto?: string
      valorNf?: number
      valorPedido?: number
    }>
    expect(achados).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categoria: 'quantidade',
          produto: 'JOELHO LR 25X1/2',
          valorNf: 440,
          valorPedido: 420,
        }),
      ])
    )
  })
})
