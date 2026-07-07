import { describe, expect, it } from 'vitest'
import {
  nomeVendaParaCopia,
  prepararFormularioDuplicacaoProduto,
  type FormProdutoDuplicavel,
} from './preparar-formulario-duplicacao-produto'

const formBase: FormProdutoDuplicavel = {
  sku: '100',
  ativo: false,
  nomeVenda: 'PRODUTO TESTE',
  marca: 'MARCA',
  unidade: 'UN',
  caracteristicas: 'Detalhes',
  tipoEntrega: 'pronta_entrega',
  diasParaEntrega: '',
  dataValidadePreco: '',
  entregaNoAto: true,
  entregaARetirar: true,
  entregar: true,
  entregaPorEncomenda: false,
  flagDevolucao: true,
  controlaEstoque: true,
  flagComissao: true,
  permiteEstoqueNegativo: false,
  bloqueadoCompra: false,
  bloqueadoVenda: false,
  desativarAoZerarEstoque: false,
  codigoBarras: '7894900011517',
  pesoKg: '1',
  alturaCm: '10',
  larguraCm: '20',
  comprimentoCm: '30',
  capacidadeEmpilhamento: '5',
  normaPalete: 'PBR',
  embalagensMaster: [
    {
      quantidade: '12',
      codigoBarras: '10614141000415',
      alturaCm: '40',
      larguraCm: '50',
      comprimentoCm: '60',
    },
  ],
  enderecosEstoque: [{ endereco: 'A1' }],
  nomeCompra: 'COMPRA TESTE',
  fornecedores: [
    {
      fornecedorPessoaId: '550e8400-e29b-41d4-a716-446655440000',
      codigoFornecedor: 'ABC',
      multiploEntrada: '12',
      multiplicadorEntrada: '1',
      unidadeEntrada: 'CX',
    },
  ],
  similares: [
    { id: 'origem-id', nomeVenda: 'ORIGEM', sku: '1' },
    { id: 'outro-id', nomeVenda: 'OUTRO', sku: '2' },
  ],
  agruparSimilaresRuptura: true,
  ncm: '84818019',
  codigoOrigem: '0',
}

describe('nomeVendaParaCopia', () => {
  it('adiciona sufixo (CÓPIA)', () => {
    expect(nomeVendaParaCopia('Produto A')).toBe('PRODUTO A (CÓPIA)')
  })

  it('trunca nome longo para caber em 60 caracteres', () => {
    const nome = 'A'.repeat(60)
    const copia = nomeVendaParaCopia(nome)
    expect(copia.length).toBeLessThanOrEqual(60)
    expect(copia.endsWith(' (CÓPIA)')).toBe(true)
  })
})

describe('prepararFormularioDuplicacaoProduto', () => {
  it('limpa sku e codigos de barras', () => {
    const r = prepararFormularioDuplicacaoProduto(formBase, 'origem-id')
    expect(r.sku).toBe('')
    expect(r.codigoBarras).toBe('')
    expect(r.embalagensMaster[0]?.codigoBarras).toBe('')
  })

  it('remove produto origem dos similares', () => {
    const r = prepararFormularioDuplicacaoProduto(formBase, 'origem-id')
    expect(r.similares).toEqual([{ id: 'outro-id', nomeVenda: 'OUTRO', sku: '2' }])
  })

  it('preserva fornecedores ncm e dimensoes', () => {
    const r = prepararFormularioDuplicacaoProduto(formBase, 'origem-id')
    expect(r.fornecedores).toEqual(formBase.fornecedores)
    expect(r.ncm).toBe('84818019')
    expect(r.pesoKg).toBe('1')
    expect(r.embalagensMaster[0]?.quantidade).toBe('12')
  })

  it('usa nome informado pelo usuario', () => {
    const r = prepararFormularioDuplicacaoProduto(formBase, 'origem-id', 'NOVO NOME')
    expect(r.nomeVenda).toBe('NOVO NOME')
    expect(r.ativo).toBe(true)
  })
})
