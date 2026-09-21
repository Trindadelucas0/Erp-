import { describe, expect, it } from 'vitest'
import {
  extrairItensDoXml,
  mapaDespesasPorNItemDoXml,
  mapaImpostosPorNItemDoXml,
} from './parser-xml-nfe.js'

const xmlComImpostos = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe35260900000000000000550010000000011000000011">
      <det nItem="1">
        <prod>
          <cProd>SKU1</cProd>
          <xProd>Item teste</xProd>
          <qCom>2.0000</qCom>
          <vUnCom>50.0000</vUnCom>
          <vProd>100.00</vProd>
          <vSeg>3.50</vSeg>
          <vOutro>1.25</vOutro>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <pICMS>18.00</pICMS>
              <vICMS>18.00</vICMS>
            </ICMS00>
          </ICMS>
          <PIS>
            <PISAliq>
              <CST>01</CST>
              <pPIS>1.65</pPIS>
              <vPIS>1.65</vPIS>
            </PISAliq>
          </PIS>
          <COFINS>
            <COFINSAliq>
              <CST>01</CST>
              <pCOFINS>7.60</pCOFINS>
              <vCOFINS>7.60</vCOFINS>
            </COFINSAliq>
          </COFINS>
        </imposto>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`

const xmlSemPisCofins = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe35260900000000000000550010000000011000000012">
      <det nItem="1">
        <prod>
          <cProd>SKU1</cProd>
          <xProd>Item sem PIS</xProd>
          <qCom>1.0000</qCom>
          <vUnCom>10.0000</vUnCom>
          <vProd>10.00</vProd>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <pICMS>12.00</pICMS>
              <vICMS>1.20</vICMS>
            </ICMS00>
          </ICMS>
        </imposto>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`

describe('mapaImpostosPorNItemDoXml', () => {
  it('lê vICMS/vPIS/vCOFINS e alíquotas do det', () => {
    const mapa = mapaImpostosPorNItemDoXml(xmlComImpostos)
    const item = mapa.get(1)
    expect(item?.valorIcms).toBe(18)
    expect(item?.aliquotaIcms).toBe(18)
    expect(item?.valorPis).toBe(1.65)
    expect(item?.aliquotaPis).toBe(1.65)
    expect(item?.valorCofins).toBe(7.6)
    expect(item?.aliquotaCofins).toBe(7.6)
  })

  it('XML sem PIS/COFINS deixa créditos PIS/COFINS nulos (não inventa p% × base)', () => {
    const item = extrairItensDoXml(xmlSemPisCofins)[0]
    expect(item.valorIcms).toBe(1.2)
    expect(item.aliquotaIcms).toBe(12)
    expect(item.valorPis).toBeNull()
    expect(item.aliquotaPis).toBeNull()
    expect(item.valorCofins).toBeNull()
    expect(item.aliquotaCofins).toBeNull()
  })
})

describe('mapaDespesasPorNItemDoXml', () => {
  it('lê vSeg e vOutro do prod', () => {
    const mapa = mapaDespesasPorNItemDoXml(xmlComImpostos)
    const item = mapa.get(1)
    expect(item?.valorSeguro).toBe(3.5)
    expect(item?.valorOutrasDespesas).toBe(1.25)
  })

  it('XML sem vSeg/vOutro deixa despesas nulas (não inventa valor)', () => {
    const item = extrairItensDoXml(xmlSemPisCofins)[0]
    expect(item.valorSeguro).toBeNull()
    expect(item.valorOutrasDespesas).toBeNull()
    const mapa = mapaDespesasPorNItemDoXml(xmlSemPisCofins)
    expect(mapa.get(1)?.valorSeguro).toBeNull()
    expect(mapa.get(1)?.valorOutrasDespesas).toBeNull()
  })
})
