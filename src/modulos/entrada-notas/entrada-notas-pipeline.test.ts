import { describe, expect, it } from 'vitest'
import { extrairItensDoXml, extrairCamposResumoDoXml } from '../focus-nfe/parser-xml-nfe.js'
import { analisarNegociacao } from './analise-negociacao/analisar-negociacao.js'
import { analisarFiscalItens } from './analise-fiscal/analisar-fiscal-itens.js'

const xmlAmostra = `
<NFe><infNFe Id="NFe35200114200166000187550010000000011000000015">
  <ide><dhEmi>2024-03-15T10:00:00-03:00</dhEmi></ide>
  <emit><CNPJ>11222333000181</CNPJ><xNome>FORNECEDOR SA</xNome></emit>
  <dest><CNPJ>29859815000102</CNPJ><xNome>EXITO</xNome></dest>
  <det nItem="1">
    <prod>
      <cProd>ABC123</cProd>
      <cEAN>7891234567890</cEAN>
      <xProd>Produto Teste</xProd>
      <NCM>22021000</NCM>
      <CFOP>5102</CFOP>
      <qCom>10.0000</qCom>
      <vUnCom>5.5000</vUnCom>
      <vProd>55.00</vProd>
    </prod>
    <imposto><ICMS><ICMS00><orig>0</orig><CST>00</CST></ICMS00></ICMS></imposto>
  </det>
  <total><ICMSTot><vNF>55.00</vNF></ICMSTot></total>
  <cobr><dup><dVenc>2024-04-15</dVenc></dup></cobr>
</infNFe></NFe>`

describe('parser itens XML', () => {
  it('extrai item com GTIN, NCM e imposto', () => {
    const itens = extrairItensDoXml(xmlAmostra)
    expect(itens).toHaveLength(1)
    expect(itens[0].gtin).toBe('7891234567890')
    expect(itens[0].codigoProduto).toBe('ABC123')
    expect(itens[0].ncm).toBe('22021000')
    expect(itens[0].cfop).toBe('5102')
    expect(itens[0].cst).toBe('00')
    expect(itens[0].origem).toBe('0')
    expect(itens[0].quantidade).toBe(10)
    expect(itens[0].valorUnitario).toBe(5.5)
  })

  it('extrai prazo dos vencimentos', () => {
    const c = extrairCamposResumoDoXml(xmlAmostra)
    expect(c.prazoPagamentoXml).toContain('2024-04-15')
  })
})

describe('negociação', () => {
  it('classifica preço menor como positiva', () => {
    const r = analisarNegociacao({
      itensNf: [{ id: '1', produtoId: 'p1', quantidade: 10, valorUnitario: 4 }],
      pedido: {
        id: 'po1',
        numero: 1,
        condicaoPagamento: '30 dias',
        prazosPagamento: null,
        itens: [{ produtoId: 'p1', quantidade: 10, precoUnitario: 5, nome: 'X' }],
      },
      prazoNf: '30 dias',
      prazoInformadoUsuario: null,
    })
    expect(r.classificacao).toBe('positiva')
    expect(r.resultado.status).not.toBe('bloqueante')
  })

  it('bloqueia sem pedido', () => {
    const r = analisarNegociacao({
      itensNf: [{ id: '1', produtoId: 'p1', quantidade: 1, valorUnitario: 1 }],
      pedido: null,
      prazoNf: '30',
      prazoInformadoUsuario: null,
    })
    expect(r.classificacao).toBe('sem_pedido')
    expect(r.resultado.status).toBe('bloqueante')
  })
})

describe('fiscal itens', () => {
  it('não bloqueia NCM divergente com regras inativas', () => {
    const r = analisarFiscalItens({
      regras: { ativo: false },
      itens: [
        {
          id: '1',
          produtoId: 'p1',
          ncm: '11111111',
          cfop: '5102',
          cst: '00',
          origem: '0',
          produtoNcm: '22222222',
          produtoOrigem: '0',
        },
      ],
    })
    expect(r.resultado.status).not.toBe('bloqueante')
    expect(r.resultado.avisos.length).toBeGreaterThan(0)
  })

  it('bloqueia NCM divergente como liberável (não exige manifesto)', () => {
    const r = analisarFiscalItens({
      regras: { ativo: true, checks: ['ncm', 'origem', 'cst_cfop'] },
      itens: [
        {
          id: '1',
          produtoId: 'p1',
          ncm: '11111111',
          cfop: '5102',
          cst: '00',
          origem: '0',
          produtoNcm: '22222222',
          produtoOrigem: '0',
        },
      ],
    })
    expect(r.resultado.status).toBe('bloqueante')
    expect(r.resultado.exigeManifesto).toBe(false)
    expect(r.resultado.bloqueiosNaoLiberaveis ?? []).toHaveLength(0)
    expect(r.resultado.bloqueios.some((m) => /NCM diverge/i.test(m))).toBe(true)
  })

  it('bloqueia produto sem NCM quando NF tem NCM (liberável)', () => {
    const r = analisarFiscalItens({
      regras: { ativo: true, checks: ['ncm'] },
      itens: [
        {
          id: '1',
          produtoId: 'p1',
          ncm: '22021000',
          cfop: '5102',
          cst: '00',
          origem: '0',
          produtoNcm: null,
          produtoOrigem: '0',
        },
      ],
    })
    expect(r.resultado.status).toBe('bloqueante')
    expect(r.resultado.exigeManifesto).toBe(false)
    expect(r.resultado.bloqueios.some((m) => /Produto sem NCM/i.test(m))).toBe(true)
  })

  it('bloqueia CST/CFOP ausente com regras ativas e aponta desconhecimento (não liberável)', () => {
    const r = analisarFiscalItens({
      regras: { ativo: true, checks: ['cst_cfop'] },
      itens: [
        {
          id: '1',
          produtoId: 'p1',
          ncm: '11111111',
          cfop: null,
          cst: null,
          origem: '0',
          produtoNcm: '11111111',
          produtoOrigem: '0',
        },
      ],
    })
    expect(r.resultado.status).toBe('bloqueante')
    expect(r.resultado.exigeManifesto).toBe(true)
    expect((r.resultado.bloqueiosNaoLiberaveis ?? []).length).toBeGreaterThan(0)
    expect(r.resultado.bloqueios.some((m) => /desconhecimento/i.test(m))).toBe(true)
  })
})
