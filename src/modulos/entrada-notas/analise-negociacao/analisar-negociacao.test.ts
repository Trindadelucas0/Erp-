import { describe, expect, it } from 'vitest'
import { analisarNegociacao } from './analisar-negociacao.js'
import {
  formatarDiasPrazo,
  normalizarPrazoParaDias,
} from './normalizar-prazo-negociacao.js'

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

  it('item do PO sem correspondente na NF → fora_nota aviso (não bloqueia)', () => {
    const resultado = analisarNegociacao({
      itensNf: [
        {
          id: 'item-1',
          produtoId: 'prod-a',
          quantidade: 10,
          valorUnitario: 5,
          nomeSistema: 'PRODUTO A',
        },
      ],
      pedido: {
        id: 'po-1',
        numero: 6,
        condicaoPagamento: '30 dias',
        prazosPagamento: null,
        itens: [
          { produtoId: 'prod-a', quantidade: 10, precoUnitario: 5, nome: 'PRODUTO A' },
          { produtoId: 'prod-b', quantidade: 3, precoUnitario: 8, nome: 'PRODUTO B' },
        ],
      },
      prazoNf: '30 dias',
      prazoInformadoUsuario: null,
    })

    expect(resultado.resultado.status).toBe('aviso')
    expect(resultado.resultado.bloqueios).toHaveLength(0)
    const achados = resultado.resultado.detalhes?.achados as Array<{
      categoria: string
      severidade: string
      mensagem: string
      produto?: string
      numeroPedido?: number
    }>
    expect(achados).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categoria: 'fora_nota',
          severidade: 'aviso',
          mensagem: 'PRODUTO B está no pedido #6 e não está na NF.',
          produto: 'PRODUTO B',
          numeroPedido: 6,
        }),
      ])
    )
    expect(achados.filter((a) => a.categoria === 'fora_nota')).toHaveLength(1)
    expect(resultado.itensCritica[0].criticaNegociacao).toBe(false)
  })

  it('item do PO casado com a NF → não gera fora_nota', () => {
    const resultado = analisarNegociacao({
      itensNf: [
        {
          id: 'item-1',
          produtoId: 'p1',
          quantidade: 10,
          valorUnitario: 5,
          nomeSistema: 'PROD',
        },
      ],
      pedido: {
        id: 'po-1',
        numero: 1,
        condicaoPagamento: '30 dias',
        prazosPagamento: null,
        itens: [{ produtoId: 'p1', quantidade: 10, precoUnitario: 5, nome: 'PROD' }],
      },
      prazoNf: '30 dias',
      prazoInformadoUsuario: null,
    })

    const achados = (resultado.resultado.detalhes?.achados as Array<{ categoria: string }>) ?? []
    expect(achados.filter((a) => a.categoria === 'fora_nota')).toHaveLength(0)
    expect(resultado.resultado.status).toBe('ok')
  })

  it('pedido errado: fora_pedido + fora_nota juntos', () => {
    const resultado = analisarNegociacao({
      itensNf: [
        {
          id: 'item-1',
          produtoId: 'nf-only',
          quantidade: 1,
          valorUnitario: 10,
          nomeSistema: 'ITEM DA NF',
        },
      ],
      pedido: {
        id: 'po-1',
        numero: 9,
        condicaoPagamento: '30 dias',
        prazosPagamento: null,
        itens: [
          { produtoId: 'po-only-1', quantidade: 2, precoUnitario: 3, nome: 'ITEM PO 1' },
          { produtoId: 'po-only-2', quantidade: 4, precoUnitario: 5, nome: 'ITEM PO 2' },
        ],
      },
      prazoNf: '30 dias',
      prazoInformadoUsuario: null,
    })

    expect(resultado.resultado.status).toBe('bloqueante')
    const achados = resultado.resultado.detalhes?.achados as Array<{
      categoria: string
      severidade: string
      produto?: string
    }>
    expect(achados.filter((a) => a.categoria === 'fora_pedido')).toEqual([
      expect.objectContaining({
        categoria: 'fora_pedido',
        severidade: 'bloqueio',
        produto: 'ITEM DA NF',
      }),
    ])
    expect(achados.filter((a) => a.categoria === 'fora_nota')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ categoria: 'fora_nota', severidade: 'aviso', produto: 'ITEM PO 1' }),
        expect.objectContaining({ categoria: 'fora_nota', severidade: 'aviso', produto: 'ITEM PO 2' }),
      ])
    )
    expect(achados.filter((a) => a.categoria === 'fora_nota')).toHaveLength(2)
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

describe('normalizarPrazoParaDias', () => {
  it('converte vencimentos ISO em dias a partir da emissão', () => {
    expect(
      normalizarPrazoParaDias(
        '2026-09-08, 2026-09-21, 2026-10-05, 2026-10-19, 2026-11-03',
        '2026-08-11'
      )
    ).toEqual([28, 41, 55, 69, 84])
  })

  it('sem emissão e só datas → null', () => {
    expect(normalizarPrazoParaDias('2026-09-08, 2026-09-21', null)).toBeNull()
  })

  it('extrai dias de texto do pedido', () => {
    expect(normalizarPrazoParaDias('28/42/56/70/84')).toEqual([28, 42, 56, 70, 84])
    expect(normalizarPrazoParaDias('30 dias')).toEqual([30])
    expect(formatarDiasPrazo([28, 42, 56])).toBe('28/42/56')
  })
})

describe('analisarNegociacao — prazo em dias', () => {
  const itensOk = [
    {
      id: 'item-1',
      produtoId: 'p1',
      quantidade: 10,
      valorUnitario: 5,
      nomeSistema: 'PROD',
    },
  ]
  const itensPo = [{ produtoId: 'p1', quantidade: 10, precoUnitario: 5, nome: 'PROD' }]

  it('datas da NF equivalentes aos dias do pedido → sem aviso de prazo', () => {
    // 2026-08-11 + 28/42/56/70/84
    const resultado = analisarNegociacao({
      itensNf: itensOk,
      pedido: {
        id: 'po-1',
        numero: 1,
        condicaoPagamento: '28/42/56/70/84',
        prazosPagamento: null,
        itens: itensPo,
      },
      prazoNf: '2026-09-08, 2026-09-22, 2026-10-06, 2026-10-20, 2026-11-03',
      prazoInformadoUsuario: null,
      dataEmissao: '2026-08-11',
    })

    expect(resultado.resultado.avisos.filter((a) => a.includes('Prazo de pagamento'))).toHaveLength(
      0
    )
    expect(resultado.classificacao).toBe('ok')
  })

  it('datas da NF divergentes → aviso com dias nos dois lados', () => {
    const resultado = analisarNegociacao({
      itensNf: itensOk,
      pedido: {
        id: 'po-1',
        numero: 1,
        condicaoPagamento: '30/60',
        prazosPagamento: null,
        itens: itensPo,
      },
      prazoNf: '2026-09-08, 2026-09-22, 2026-10-06, 2026-10-20, 2026-11-03',
      prazoInformadoUsuario: null,
      dataEmissao: '2026-08-11',
    })

    expect(resultado.resultado.avisos[0]).toBe(
      'Prazo de pagamento diverge do pedido (NF: 28/42/56/70/84 × pedido: 30/60).'
    )
    expect(resultado.classificacao).toBe('positiva')
  })

  it('texto já em dias (30 dias × 30) → ok', () => {
    const resultado = analisarNegociacao({
      itensNf: itensOk,
      pedido: {
        id: 'po-1',
        numero: 1,
        condicaoPagamento: '30',
        prazosPagamento: null,
        itens: itensPo,
      },
      prazoNf: '30 dias',
      prazoInformadoUsuario: null,
    })

    expect(resultado.resultado.avisos.filter((a) => a.includes('Prazo de pagamento'))).toHaveLength(
      0
    )
    expect(resultado.classificacao).toBe('ok')
  })

  it('sem emissão e só datas na NF → mantém aviso (não inventa match)', () => {
    const resultado = analisarNegociacao({
      itensNf: itensOk,
      pedido: {
        id: 'po-1',
        numero: 1,
        condicaoPagamento: '28/42/56/70/84',
        prazosPagamento: null,
        itens: itensPo,
      },
      prazoNf: '2026-09-08, 2026-09-22, 2026-10-06, 2026-10-20, 2026-11-03',
      prazoInformadoUsuario: null,
      dataEmissao: null,
    })

    expect(resultado.resultado.avisos.some((a) => a.includes('Prazo de pagamento diverge'))).toBe(
      true
    )
  })
})
