import { describe, expect, it } from 'vitest'
import { preencherMultiploSeVazio } from './sincronizar-multiplo-embalagem.js'
import { esquemaDeCriacaoDeProduto } from './esquema-produtos.js'

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

describe('preencherMultiploSeVazio', () => {
  it('copia embalagem para múltiplo quando múltiplo está vazio', () => {
    expect(
      preencherMultiploSeVazio({
        multiplicadorEntrada: 6,
        multiploEntrada: null,
      })
    ).toEqual({ multiplicadorEntrada: 6, multiploEntrada: 6 })
  })

  it('mantém múltiplo existente', () => {
    expect(
      preencherMultiploSeVazio({
        multiplicadorEntrada: 6,
        multiploEntrada: 12,
      })
    ).toEqual({ multiplicadorEntrada: 6, multiploEntrada: 12 })
  })
})

describe('esquemaDeCriacaoDeProduto sync multiplo', () => {
  it('preenche multiploEntrada a partir de multiplicadorEntrada quando múltiplo omisso', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({
      ...payloadMinimo,
      fornecedores: [
        {
          fornecedorPessoaId: '550e8400-e29b-41d4-a716-446655440000',
          multiplicadorEntrada: 6,
          unidadeEntrada: 'CX',
        },
      ],
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.fornecedores[0]?.multiplicadorEntrada).toBe(6)
      expect(r.data.fornecedores[0]?.multiploEntrada).toBe(6)
    }
  })

  it('não sobrescreve multiploEntrada já informado', () => {
    const r = esquemaDeCriacaoDeProduto.safeParse({
      ...payloadMinimo,
      fornecedores: [
        {
          fornecedorPessoaId: '550e8400-e29b-41d4-a716-446655440000',
          multiploEntrada: 12,
          multiplicadorEntrada: 6,
          unidadeEntrada: 'CX',
        },
      ],
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.fornecedores[0]?.multiplicadorEntrada).toBe(6)
      expect(r.data.fornecedores[0]?.multiploEntrada).toBe(12)
    }
  })
})
