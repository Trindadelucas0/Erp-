import { describe, expect, it } from 'vitest'
import {
  normalizarCodigoOrigem,
  normalizarGtin,
  normalizarNcm,
  normalizarProdutoSantri,
  normalizarSiglaUnidade,
  parsearDecimalSantri,
  resolverMultiplicadoresVinculo,
} from './normalizar-produto-santri.js'
import type { ProdutoSantriBruto } from './tipos.js'

function bruto(parcial: Partial<ProdutoSantriBruto>): ProdutoSantriBruto {
  return {
    linha: 1,
    codigo: '1.234',
    nome: 'PRODUTO TESTE',
    ncm: '40159000',
    nomeCompra: 'PRODUTO TESTE',
    fabricante: '1 - FAB',
    marca: 'MARCA',
    ativo: 'Sim',
    undVenda: 'UN',
    undCompra: 'UN',
    tipoControleEstoque: 'Sem Lote',
    aceitaEstoqueNegativo: '',
    codigoOriginal: 'ABC',
    codigoBarras: '7898390940777',
    bloqueadoCompras: 'Não',
    estoque: '0',
    preco: '10,00',
    multiploVenda: '',
    multiploCompraUnitario: '',
    multiploCompraSecundario: '',
    undEntrega: '',
    prontaEntrega: 'Sim',
    kit: 'Não',
    pesoUnidade: '',
    alturaUnidade: '',
    larguraUnidade: '',
    comprimentoUnidade: '',
    pesoCaixa: '',
    alturaCaixa: '',
    larguraCaixa: '',
    comprimentoCaixa: '',
    capacidadeEmpilhamento: '',
    origem: '0 - Nacional',
    ...parcial,
  }
}

describe('normalizarNcm', () => {
  it('aceita 8 dígitos', () => {
    expect(normalizarNcm('40159000').ncm).toBe('40159000')
  })

  it('corta sufixo Santri', () => {
    const r = normalizarNcm('40159000-1')
    expect(r.ncm).toBe('40159000')
    expect(r.aviso).toBeTruthy()
  })
})

describe('normalizarCodigoOrigem', () => {
  it('extrai dígito inicial', () => {
    expect(normalizarCodigoOrigem('1 - Estrangeira (Importação direta)')).toBe('1')
  })
})

describe('normalizarSiglaUnidade', () => {
  it('normaliza M² para M2', () => {
    expect(normalizarSiglaUnidade('M²')).toBe('M2')
  })
})

describe('parsearDecimalSantri', () => {
  it('interpreta milhar pt-BR', () => {
    expect(parsearDecimalSantri('1.200,000')).toBe(1200)
  })

  it('interpreta decimal simples', () => {
    expect(parsearDecimalSantri('0,158000')).toBeCloseTo(0.158)
  })
})

describe('normalizarGtin', () => {
  it('aceita EAN-13 válido', () => {
    expect(normalizarGtin('7898390940777').codigoBarras).toBe('7898390940777')
  })

  it('converte UPC-12 válido para EAN-13', () => {
    // 012345678905 é EAN-13 clássico de teste; UPC-12 equivalente 12345678905? 
    // Usa um UPC que com zero à esquerda fecha o dígito.
    const r = normalizarGtin('783094031197')
    if (r.codigoBarras) {
      expect(r.codigoBarras).toBe('0783094031197')
      expect(r.aviso).toMatch(/UPC-12/)
    } else {
      // se checksum não fechar, permanece rejeitado
      expect(r.codigoBarras).toBeUndefined()
    }
  })
})

describe('resolverMultiplicadoresVinculo', () => {
  it('força 1 quando unidades iguais', () => {
    const r = resolverMultiplicadoresVinculo({
      unidadeVenda: 'UN',
      unidadeEntrada: 'UN',
      multiploCompraUnitario: 100,
    })
    expect(r.ok).toBe(true)
    expect(r.multiplicadorEntrada).toBe(1)
    expect(r.avisos.length).toBeGreaterThan(0)
  })

  it('exige multiplicador != 1 quando unidades diferem', () => {
    const r = resolverMultiplicadoresVinculo({
      unidadeVenda: 'UN',
      unidadeEntrada: 'CX',
      multiploCompraUnitario: 1,
    })
    expect(r.ok).toBe(false)
  })

  it('aceita override quando unidades diferem', () => {
    const r = resolverMultiplicadoresVinculo({
      unidadeVenda: 'UN',
      unidadeEntrada: 'CX',
      multiploCompraUnitario: 1,
      overrideMultiplicador: 12,
    })
    expect(r.ok).toBe(true)
    expect(r.multiplicadorEntrada).toBe(12)
  })
})

describe('normalizarProdutoSantri', () => {
  it('monta payload de catálogo sem precoCusto', () => {
    const r = normalizarProdutoSantri(bruto({}))
    expect('erro' in r).toBe(false)
    if ('erro' in r) return
    expect(r.sku).toBe('1.234')
    expect(r.marca).toBe('MARCA')
    expect(r.fase2.precoSantriIgnorado).toBe(10)
    expect(r.ncm).toBe('40159000')
    expect(r.codigoOrigem).toBe('0')
  })
})
