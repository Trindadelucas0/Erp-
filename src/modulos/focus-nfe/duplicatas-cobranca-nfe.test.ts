import { describe, expect, it } from 'vitest'
import {
  extrairDuplicatasCobrancaDoXml,
  montarParcelasContaPagarDaNfe,
} from './parser-xml-nfe.js'

const xmlDuasDups = `<?xml version="1.0"?>
<nfeProc>
  <NFe><infNFe>
    <cobr>
      <dup><nDup>001</nDup><dVenc>2024-04-15</dVenc><vDup>100.00</vDup></dup>
      <dup><nDup>002</nDup><dVenc>2024-05-15</dVenc><vDup>50.50</vDup></dup>
    </cobr>
  </infNFe></NFe>
</nfeProc>`

describe('extrairDuplicatasCobrancaDoXml', () => {
  it('extrai nDup, dVenc e vDup', () => {
    const dups = extrairDuplicatasCobrancaDoXml(xmlDuasDups)
    expect(dups).toHaveLength(2)
    expect(dups[0].numeroDocumento).toBe('001')
    expect(dups[0].vencimento?.toISOString().slice(0, 10)).toBe('2024-04-15')
    expect(dups[0].valor).toBe(100)
    expect(dups[1].valor).toBe(50.5)
  })
})

describe('montarParcelasContaPagarDaNfe', () => {
  it('usa valores do XML quando todas as dups têm vDup', () => {
    const dups = extrairDuplicatasCobrancaDoXml(xmlDuasDups)
    const r = montarParcelasContaPagarDaNfe({
      duplicatasXml: dups,
      valorTotalNf: 150.5,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.parcelas).toHaveLength(2)
    expect(r.parcelas[0].valor).toBe(100)
    expect(r.parcelas[1].valor).toBe(50.5)
  })

  it('reparte valorTotal quando há dVenc sem vDup', () => {
    const r = montarParcelasContaPagarDaNfe({
      duplicatasXml: [
        { numeroDocumento: '1', vencimento: new Date('2024-04-15T00:00:00.000Z'), valor: null },
        { numeroDocumento: '2', vencimento: new Date('2024-05-15T00:00:00.000Z'), valor: null },
      ],
      valorTotalNf: 100,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.parcelas[0].valor + r.parcelas[1].valor).toBeCloseTo(100, 2)
  })

  it('falha sem vencimento (fail-closed)', () => {
    const r = montarParcelasContaPagarDaNfe({
      duplicatasXml: [],
      valorTotalNf: 100,
      prazoPagamentoXml: null,
      prazoPagamentoTexto: null,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.mensagem).toMatch(/sem duplicatas\/vencimento/i)
  })

  it('aceita datas do prazoPagamentoTexto', () => {
    const r = montarParcelasContaPagarDaNfe({
      duplicatasXml: [],
      valorTotalNf: 90,
      prazoPagamentoTexto: '15/04/2024, 15/05/2024',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.parcelas).toHaveLength(2)
    expect(r.parcelas[0].valor + r.parcelas[1].valor).toBeCloseTo(90, 2)
  })
})
