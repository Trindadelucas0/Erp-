import { describe, expect, it } from 'vitest'
import {
  extrairCfopDoXmlCte,
  extrairDadosTransporteDoXmlNfe,
  extrairIcmsDoXmlCte,
  extrairSugestaoFinanceiroDoXmlCte,
} from './parser-xml-nfe.js'

describe('extrairDadosTransporteDoXmlNfe', () => {
  it('soma volumes e pesos de vários vol e lê vFrete', () => {
    const xml = `<?xml version="1.0"?>
<nfeProc><NFe><infNFe Id="NFe35240111111111111111550010000000011123456789">
  <total><ICMSTot><vFrete>50.00</vFrete><vNF>100.00</vNF></ICMSTot></total>
  <transp>
    <modFrete>1</modFrete>
    <vol><qVol>2</qVol><pesoB>10.5</pesoB><pesoL>9.0</pesoL></vol>
    <vol><qVol>3</qVol><pesoB>5.0</pesoB><pesoL>4.5</pesoL></vol>
  </transp>
</infNFe></NFe></nfeProc>`
    const dados = extrairDadosTransporteDoXmlNfe(xml)
    expect(dados).toEqual({
      qtdVolumes: 5,
      pesoBruto: 15.5,
      pesoLiquido: 13.5,
      valorFreteNf: 50,
    })
  })
})

describe('extrairCfopDoXmlCte', () => {
  it('lê CFOP de ide/CFOP', () => {
    const xml = `<?xml version="1.0"?>
<cteProc><CTe><infCte Id="CTe35240111111111111111570010000000011123456789">
  <ide><CFOP>5353</CFOP><nCT>1</nCT><serie>1</serie></ide>
  <vPrest><vTPrest>742.10</vTPrest></vPrest>
</infCte></CTe></cteProc>`
    expect(extrairCfopDoXmlCte(xml)).toBe('5353')
  })

  it('retorna null quando não há CFOP', () => {
    const xml = `<?xml version="1.0"?>
<cteProc><CTe><infCte Id="CTe35240111111111111111570010000000011123456789">
  <ide><nCT>1</nCT></ide>
</infCte></CTe></cteProc>`
    expect(extrairCfopDoXmlCte(xml)).toBeNull()
  })
})

describe('extrairSugestaoFinanceiroDoXmlCte', () => {
  it('lê nCT e vRec para a prévia financeira', () => {
    const xml = `<?xml version="1.0"?>
<cteProc><CTe><infCte Id="CTe35240111111111111111570010000000011123456789">
  <ide><CFOP>5353</CFOP><nCT>5406</nCT><serie>1</serie></ide>
  <vPrest><vTPrest>800.00</vTPrest><vRec>742.10</vRec></vPrest>
</infCte></CTe></cteProc>`
    expect(extrairSugestaoFinanceiroDoXmlCte(xml)).toEqual({
      numeroDocumento: '5406',
      valor: 742.1,
    })
  })

  it('não usa vTPrest quando vRec está ausente', () => {
    const xml = `<?xml version="1.0"?>
<cteProc><CTe><infCte Id="CTe35240111111111111111570010000000011123456789">
  <ide><nCT>99</nCT></ide>
  <vPrest><vTPrest>800.00</vTPrest></vPrest>
</infCte></CTe></cteProc>`
    expect(extrairSugestaoFinanceiroDoXmlCte(xml)).toEqual({
      numeroDocumento: '99',
      valor: null,
    })
  })
})

describe('extrairIcmsDoXmlCte', () => {
  it('lê vBC pICMS vICMS do grupo ICMS00', () => {
    const xml = `<?xml version="1.0"?>
<cteProc><CTe><infCte Id="CTe35240111111111111111570010000000011123456789">
  <imp><ICMS><ICMS00>
    <CST>00</CST>
    <vBC>742.10</vBC>
    <pICMS>12.00</pICMS>
    <vICMS>89.05</vICMS>
  </ICMS00></ICMS></imp>
  <vPrest><vTPrest>742.10</vTPrest></vPrest>
</infCte></CTe></cteProc>`
    expect(extrairIcmsDoXmlCte(xml)).toEqual({
      baseCalculoIcms: 742.1,
      aliquotaIcms: 12,
      valorIcms: 89.05,
    })
  })

  it('lê vBCOutraUF pICMSOutraUF vICMSOutraUF do grupo ICMSOutraUF', () => {
    const xml = `<?xml version="1.0"?>
<cteProc><CTe><infCte Id="CTe35240111111111111111570010000000011123456789">
  <imp><ICMS><ICMSOutraUF>
    <CST>90</CST>
    <vBCOutraUF>742.10</vBCOutraUF>
    <pICMSOutraUF>12.00</pICMSOutraUF>
    <vICMSOutraUF>89.05</vICMSOutraUF>
  </ICMSOutraUF></ICMS></imp>
  <vPrest><vTPrest>742.10</vTPrest></vPrest>
</infCte></CTe></cteProc>`
    expect(extrairIcmsDoXmlCte(xml)).toEqual({
      baseCalculoIcms: 742.1,
      aliquotaIcms: 12,
      valorIcms: 89.05,
    })
  })
})
