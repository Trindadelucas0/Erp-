import { describe, expect, it } from 'vitest'
import { esquemaDeCriacaoDeProduto, mensagemErroZod } from './esquema-produtos.js'

const payloadMinimo = {
  ativo: true,
  nomeVenda: 'Produto Teste',
  marca: 'Marca Teste',
  unidade: 'UN',
  entregaNoAto: false,
  entregaARetirar: false,
  entregar: false,
  entregaPorEncomenda: false,
  flagDevolucao: false,
  controlaEstoque: true,
  flagComissao: false,
  permiteEstoqueNegativo: false,
  bloqueadoCompra: false,
  bloqueadoVenda: false,
  desativarAoZerarEstoque: false,
  embalagensMaster: [],
  enderecosEstoque: [],
  similaresIds: [],
  fornecedores: [],
}

describe('esquemaDeCriacaoDeProduto', () => {
  it('aceita payload mínimo', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse(payloadMinimo)
    expect(r.success).toBe(true)
  })

  it('rejeita produto sem marca', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({ ...payloadMinimo, marca: '' })
    expect(r.success).toBe(false)
  })

  it('aceita array de fornecedores com multiplicadorEntrada', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({
      ...payloadMinimo,
      fornecedores: [
        {
          fornecedorPessoaId: '550e8400-e29b-41d4-a716-446655440000',
          codigoFornecedor: 'ABC123',
          multiploEntrada: 12,
          multiplicadorEntrada: 1.5,
          unidadeEntrada: 'CX',
        },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('rejeita fornecedor sem fornecedorPessoaId', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({
      ...payloadMinimo,
      fornecedores: [{ codigoFornecedor: 'ABC123' }],
    })
    expect(r.success).toBe(false)
  })

  it('rejeita quantidade null em embalagem (NaN do JSON)', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({
      ...payloadMinimo,
      embalagensMaster: [{ quantidade: null, codigoBarras: '123' }],
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(mensagemErroZod(r.error)).not.toBe('Invalid input')
    }
  })

  it('rejeita embalagem sem quantidade', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({
      ...payloadMinimo,
      embalagensMaster: [{ codigoBarras: '123' }],
    })
    expect(r.success).toBe(false)
    if (!r.success) console.log(mensagemErroZod(r.error))
  })

  it('aceita codigoBarras null', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({ ...payloadMinimo, codigoBarras: null })
    expect(r.success).toBe(true)
  })

  it('aceita campos numericos null em fornecedor', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({
      ...payloadMinimo,
      fornecedores: [
        {
          fornecedorPessoaId: '550e8400-e29b-41d4-a716-446655440000',
          multiploEntrada: null,
          multiplicadorEntrada: null,
        },
      ],
    })
    expect(r.success).toBe(true)
  })
})
