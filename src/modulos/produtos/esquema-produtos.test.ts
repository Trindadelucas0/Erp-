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
      embalagensMaster: [{ quantidade: null }],
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(mensagemErroZod(r.error)).not.toBe('Invalid input')
    }
  })

  it('rejeita embalagem sem quantidade', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({
      ...payloadMinimo,
      embalagensMaster: [{}],
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

  it('rejeita nomeVenda com mais de 60 caracteres', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({
      ...payloadMinimo,
      nomeVenda: 'A'.repeat(61),
    })
    expect(r.success).toBe(false)
  })

  it('rejeita codigoBarras GTIN invalido na unidade', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({
      ...payloadMinimo,
      codigoBarras: '1234567890123',
    })
    expect(r.success).toBe(false)
  })

  it('aceita codigoBarras EAN-13 valido', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({
      ...payloadMinimo,
      codigoBarras: '7894900011517',
    })
    expect(r.success).toBe(true)
  })

  it('aceita ncm com 8 digitos', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({
      ...payloadMinimo,
      ncm: '84818019',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.ncm).toBe('84818019')
  })

  it('rejeita ncm com menos de 8 digitos', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({
      ...payloadMinimo,
      ncm: '123',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(mensagemErroZod(r.error)).toContain('NCM deve ter 8 dígitos')
    }
  })

  it('rejeita dias e data quando tipoEntrega nao e sob_encomenda', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({
      ...payloadMinimo,
      tipoEntrega: 'pronta_entrega',
      diasParaEntrega: 7,
      dataValidadePreco: '2026-12-31',
    })
    expect(r.success).toBe(false)
  })

  it('aplica flagComissao true por padrao na criacao', () => {
    const { flagComissao: _flagComissao, ...semComissao } = payloadMinimo
    const r = esquemaDeCriacaoDeProduto.safeParse(semComissao)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.flagComissao).toBe(true)
  })

  it('aplica flagDevolucao true por padrao na criacao', () => {
    const { flagDevolucao: _flagDevolucao, ...semDevolucao } = payloadMinimo
    const r = esquemaDeCriacaoDeProduto.safeParse(semDevolucao)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.flagDevolucao).toBe(true)
  })

  it('rejeita codigoBarras GTIN invalido na embalagem master', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({
      ...payloadMinimo,
      embalagensMaster: [{ quantidade: 12, codigoBarras: '84818019' }],
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(mensagemErroZod(r.error)).toContain('Código de barras inválido')
    }
  })

  it('rejeita unidade e master com o mesmo codigo de barras', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({
      ...payloadMinimo,
      codigoBarras: '7894900011517',
      embalagensMaster: [{ quantidade: 12, codigoBarras: '7894900011517' }],
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(mensagemErroZod(r.error)).toContain('duplicado no cadastro do produto')
    }
  })

  it('aceita unidade e master com codigos diferentes e validos', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({
      ...payloadMinimo,
      codigoBarras: '7894900011517',
      embalagensMaster: [{ quantidade: 12, codigoBarras: '10614141000415' }],
    })
    expect(r.success).toBe(true)
  })
})

