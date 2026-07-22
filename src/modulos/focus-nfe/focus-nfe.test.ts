import { describe, expect, it } from 'vitest'
import { montarAuthParaTeste } from './cliente-focus-nfe-auth-teste.js'
import {
  extrairChaveNfeDoXml,
  extrairChaveNfseDoXml,
  extrairChaveCteDoXml,
  extrairCamposResumoDoXml,
  detectarDocumentoFiscalXml,
  montarVisualizacaoDoXml,
} from './parser-xml-nfe.js'
import {
  mascararCnpj,
  mensagemErroFocusAmigavel,
} from './mensagens-focus-nfe.js'
import { analisarFiscalBasico } from '../entrada-notas/analise-fiscal/analisar-fiscal-basico.js'

describe('Focus NFe — Basic Auth', () => {
  it('monta Basic com token e senha vazia', () => {
    const header = montarAuthParaTeste('meuToken123')
    const decodificado = Buffer.from(header.replace('Basic ', ''), 'base64').toString('utf8')
    expect(decodificado).toBe('meuToken123:')
  })
})

describe('mensagens Focus', () => {
  it('mascara CNPJ mostrando só os 4 últimos', () => {
    expect(mascararCnpj('12345678000199')).toBe('**********0199')
  })

  it('traduz 401 para mensagem de token/ambiente', () => {
    const msg = mensagemErroFocusAmigavel({
      codigoHttp: 401,
      mensagemOriginal: 'Access token inválido (host: homologacao.focusnfe.com.br)',
      ambiente: 'homolog',
    })
    expect(msg).toMatch(/Token inválido/i)
    expect(msg).toMatch(/homologacao/i)
  })

  it('traduz 400 CNPJ priorizando Recebimento de NFes / homolog', () => {
    const msg = mensagemErroFocusAmigavel({
      codigoHttp: 400,
      mensagemOriginal: 'CNPJ do emitente não autorizado ou não informado',
      ambiente: 'homolog',
      cnpjMascarado: '**********0199',
    })
    expect(msg).toContain('**********0199')
    expect(msg).toMatch(/Recebimento de NFes|habilita_manifestacao_homologacao/i)
  })

  it('menciona fonte=banco preferível quando veio do .env', () => {
    const msg = mensagemErroFocusAmigavel({
      codigoHttp: 400,
      mensagemOriginal: 'CNPJ do emitente não autorizado ou não informado',
      ambiente: 'producao',
      cnpjMascarado: '**********0102',
      fonte: 'env',
    })
    expect(msg).toMatch(/fonte=banco/i)
    expect(msg).toMatch(/Recebimento de NFes|habilita_manifestacao/i)
  })

  it('trata 403 CNPJ igual ao 400 (OpenAPI Focus)', () => {
    const msg = mensagemErroFocusAmigavel({
      codigoHttp: 403,
      mensagemOriginal: 'CNPJ do emitente não autorizado.',
      ambiente: 'homolog',
      cnpjMascarado: '**********0102',
    })
    expect(msg).toMatch(/habilita_manifestacao_homologacao|Recebimento/i)
  })
})

describe('parser XML NF-e', () => {
  it('detecta NFS-e nacional e não confunde com NFe 55', () => {
    const xml =
      '<?xml version="1.0"?><NFSe versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse">' +
      '<infNFSe Id="NFS53001082267790913000120000000000000126078819880480"></infNFSe></NFSe>'
    expect(detectarDocumentoFiscalXml(xml)).toBe('nfse')
  })

  it('extrai chave/prestador/valor de NFS-e nacional', () => {
    const xml = `<?xml version="1.0"?>
      <NFSe xmlns="http://www.sped.fazenda.gov.br/nfse">
        <infNFSe Id="NFS53001082267790913000120000000000000126078819880480">
          <dhEmi>2026-07-08T10:00:00-03:00</dhEmi>
          <emit><CNPJ>67790913000120</CNPJ><xNome>LUCAS PRESTADOR</xNome></emit>
          <toma><CNPJ>34221243000171</CNPJ></toma>
          <valores><vServ>3000.00</vServ><vLiq>3000.00</vLiq></valores>
        </infNFSe>
      </NFSe>`
    expect(extrairChaveNfseDoXml(xml)).toBe(
      'NFS53001082267790913000120000000000000126078819880480'
    )
    const c = extrairCamposResumoDoXml(xml)
    expect(c.tipoDocumento).toBe('nfse')
    expect(c.chaveNfe).toBe('NFS53001082267790913000120000000000000126078819880480')
    expect(c.nomeEmitente).toBe('LUCAS PRESTADOR')
    expect(c.documentoEmitente).toBe('67790913000120')
    expect(c.cnpjDestinatario).toBe('34221243000171')
    expect(c.valorTotal).toBe(3000)
  })

  it('detecta CTe e extrai emitente/valor', () => {
    // Chave com modelo 57 nas posições 21-22
    const chave =
      '35240712345678000185570010000000011000000015'
    const xml = `<?xml version="1.0"?>
      <cteProc>
        <CTe xmlns="http://www.portalfiscal.inf.br/cte">
          <infCte Id="CTe${chave}">
            <ide><dhEmi>2024-07-10T14:00:00-03:00</dhEmi><nCT>1</nCT><serie>1</serie><natOp>PRESTACAO DE SERVICO</natOp></ide>
            <emit><CNPJ>12345678000185</CNPJ><xNome>TRANSPORTADORA SA</xNome></emit>
            <dest><CNPJ>29859815000102</CNPJ><xNome>DESTINATARIO LTDA</xNome></dest>
            <vPrest><vTPrest>450.75</vTPrest><vRec>450.75</vRec></vPrest>
          </infCte>
        </CTe>
      </cteProc>`
    expect(detectarDocumentoFiscalXml(xml)).toBe('cte')
    expect(extrairChaveCteDoXml(xml)).toBe(chave)
    const c = extrairCamposResumoDoXml(xml)
    expect(c.tipoDocumento).toBe('cte')
    expect(c.chaveNfe).toBe(chave)
    expect(c.nomeEmitente).toBe('TRANSPORTADORA SA')
    expect(c.documentoEmitente).toBe('12345678000185')
    expect(c.cnpjDestinatario).toBe('29859815000102')
    expect(c.valorTotal).toBe(450.75)
    const v = montarVisualizacaoDoXml(xml)
    expect(v.tipoDocumento).toBe('cte')
    expect(v.itens).toHaveLength(0)
  })

  it('detecta NFe 55', () => {
    const xml = `<nfeProc><NFe><infNFe Id="NFe35200114200166000187550010000000011000000015"></infNFe></NFe></nfeProc>`
    expect(detectarDocumentoFiscalXml(xml)).toBe('nfe55')
  })

  it('extrai chave do atributo Id', () => {
    const xml = `<infNFe Id="NFe35200114200166000187550010000000011000000015" />`
    expect(extrairChaveNfeDoXml(xml)).toBe('35200114200166000187550010000000011000000015')
  })

  it('extrai chave da tag chNFe', () => {
    const xml = `<protNFe><chNFe>35200114200166000187550010000000011000000015</chNFe></protNFe>`
    expect(extrairChaveNfeDoXml(xml)).toBe('35200114200166000187550010000000011000000015')
  })

  it('extrai chave com BOM e namespace', () => {
    const xml =
      '\uFEFF<?xml version="1.0"?><nfeProc><NFe xmlns="http://www.portalfiscal.inf.br/nfe">' +
      '<infNFe versao="4.00" Id="NFe35200114200166000187550010000000011000000015">' +
      '</infNFe></NFe></nfeProc>'
    expect(extrairChaveNfeDoXml(xml)).toBe('35200114200166000187550010000000011000000015')
  })

  it('extrai chNFe com prefixo de namespace', () => {
    const xml = `<nfe:protNFe><nfe:chNFe>35200114200166000187550010000000011000000015</nfe:chNFe></nfe:protNFe>`
    expect(extrairChaveNfeDoXml(xml)).toBe('35200114200166000187550010000000011000000015')
  })

  it('extrai emitente/data/valor do bloco emit (não do dest)', () => {
    const xml = `
      <NFe><infNFe Id="NFe35200114200166000187550010000000011000000015">
        <ide><dhEmi>2024-03-15T10:00:00-03:00</dhEmi></ide>
        <emit><CNPJ>11222333000181</CNPJ><xNome>FORNECEDOR SA</xNome></emit>
        <dest><CNPJ>29859815000102</CNPJ><xNome>EXITO CONTABILIDADE LTDA</xNome></dest>
        <total><ICMSTot><vNF>1500.50</vNF></ICMSTot></total>
      </infNFe></NFe>`
    const c = extrairCamposResumoDoXml(xml)
    expect(c.nomeEmitente).toBe('FORNECEDOR SA')
    expect(c.documentoEmitente).toBe('11222333000181')
    expect(c.cnpjDestinatario).toBe('29859815000102')
    expect(c.valorTotal).toBe(1500.5)
    expect(c.dataEmissao?.toISOString().startsWith('2024-03-15')).toBe(true)
  })

  it('extrai valor em formato brasileiro 1.500,50', () => {
    const xml = `
      <NFe><infNFe Id="NFe35200114200166000187550010000000011000000015">
        <total><ICMSTot><vNF>1.500,50</vNF></ICMSTot></total>
      </infNFe></NFe>`
    expect(extrairCamposResumoDoXml(xml).valorTotal).toBe(1500.5)
  })

  it('extrai valor em CDATA', () => {
    const xml = `
      <NFe><infNFe Id="NFe35200114200166000187550010000000011000000015">
        <total><ICMSTot><vNF><![CDATA[2500.75]]></vNF></ICMSTot></total>
      </infNFe></NFe>`
    expect(extrairCamposResumoDoXml(xml).valorTotal).toBe(2500.75)
  })

  it('soma vProd dos itens quando vNF está ausente', () => {
    const xml = `
      <NFe><infNFe Id="NFe35200114200166000187550010000000011000000015">
        <det nItem="1"><prod><xProd>A</xProd><vProd>100.00</vProd></prod></det>
        <det nItem="2"><prod><xProd>B</xProd><vProd>50.50</vProd></prod></det>
      </infNFe></NFe>`
    expect(extrairCamposResumoDoXml(xml).valorTotal).toBe(150.5)
  })

  it('monta visualização legível com emitente, destinatário e itens', () => {
    const xml = `
      <NFe><infNFe Id="NFe35200114200166000187550010000000011000000015">
        <ide><nNF>123</nNF><serie>1</serie><natOp>Compra</natOp><dhEmi>2024-03-15T10:00:00-03:00</dhEmi></ide>
        <emit><CNPJ>11222333000181</CNPJ><xNome>FORNECEDOR SA</xNome></emit>
        <dest><CNPJ>29859815000102</CNPJ><xNome>EXITO LTDA</xNome></dest>
        <det nItem="1"><prod><cProd>SKU1</cProd><xProd>Parafuso</xProd><NCM>73181500</NCM><CFOP>5102</CFOP><qCom>2</qCom><vUnCom>10.00</vUnCom><vProd>20.00</vProd></prod></det>
        <total><ICMSTot><vNF>20.00</vNF></ICMSTot></total>
      </infNFe></NFe>`
    const v = montarVisualizacaoDoXml(xml)
    expect(v.tipoDocumento).toBe('nfe55')
    expect(v.numero).toBe('123')
    expect(v.emitente.nome).toBe('FORNECEDOR SA')
    expect(v.destinatario.nome).toBe('EXITO LTDA')
    expect(v.itens).toHaveLength(1)
    expect(v.itens[0].descricao).toBe('Parafuso')
    expect(v.valorTotal).toBe(20)
  })
})

describe('análise fiscal (gate)', () => {
  it('retorna pendente_configuracao quando ativo=false', () => {
    const r = analisarFiscalBasico({ ativo: false, checks: ['ncm'] })
    expect(r.status).toBe('pendente_configuracao')
    expect(r.bloqueios).toEqual([])
    expect(r.avisos[0]).toMatch(/desligada/i)
  })

  it('retorna ok quando ativo=true sem checks extras', () => {
    const r = analisarFiscalBasico({ ativo: true })
    expect(r.status).toBe('ok')
  })
})

describe('sanitizarRegrasFiscais', () => {
  it('remove menção a Paulo da observação', async () => {
    const { sanitizarObservacaoFiscal, REGRAS_FISCAIS_PADRAO } = await import(
      './esquema-focus-nfe.js'
    )
    expect(sanitizarObservacaoFiscal('Preencher com Paulo — regras fiscais de entrada NF')).toBe(
      REGRAS_FISCAIS_PADRAO.observacao
    )
    expect(sanitizarObservacaoFiscal('Confere NCM na entrada')).toBe('Confere NCM na entrada')
  })
})
