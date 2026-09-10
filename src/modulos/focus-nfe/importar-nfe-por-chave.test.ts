import { beforeEach, describe, expect, it, vi } from 'vitest'

const buscarPorChave = vi.fn()
const buscarConfigPorEmpresa = vi.fn()
const buscarEmpresaCnpj = vi.fn()
const upsertNfeRecebida = vi.fn()
const manifestar = vi.fn()
const baixarXml = vi.fn()
const consultarNfeRecebida = vi.fn()
const contarItens = vi.fn()
const substituirItensDoXml = vi.fn()
const atualizarNota = vi.fn()
const processarAposXml = vi.fn()

vi.mock('./repositorio-focus-nfe.js', () => ({
  repositorioFocusNfe: {
    buscarPorChave: (...a: unknown[]) => buscarPorChave(...a),
    buscarConfigPorEmpresa: (...a: unknown[]) => buscarConfigPorEmpresa(...a),
    buscarEmpresaCnpj: (...a: unknown[]) => buscarEmpresaCnpj(...a),
    upsertNfeRecebida: (...a: unknown[]) => upsertNfeRecebida(...a),
  },
}))

vi.mock('./cliente-focus-nfe.js', () => ({
  clienteFocusNfe: {
    manifestar: (...a: unknown[]) => manifestar(...a),
    baixarXml: (...a: unknown[]) => baixarXml(...a),
    consultarNfeRecebida: (...a: unknown[]) => consultarNfeRecebida(...a),
  },
}))

vi.mock('../entrada-notas/repositorio-entrada-notas.js', () => ({
  repositorioEntradaNotas: {
    contarItens: (...a: unknown[]) => contarItens(...a),
    substituirItensDoXml: (...a: unknown[]) => substituirItensDoXml(...a),
    atualizarNota: (...a: unknown[]) => atualizarNota(...a),
  },
}))

vi.mock('../entrada-notas/servico-pipeline-entrada.js', () => ({
  servicoEntradaNotas: {
    processarAposXml: (...a: unknown[]) => processarAposXml(...a),
  },
}))

vi.mock('./logs-focus-nfe.js', () => ({
  logFocus: vi.fn(),
}))

import { importarNfePorChave } from './importar-nfe-por-chave.js'

const CHAVE = '52260810921911001004550010002649141156356287'
const XML_RESUMO = `<resNFe><chNFe>${CHAVE}</chNFe><CNPJ>10921911001004</CNPJ><xNome>FORTLEV</xNome><vNF>4143.42</vNF></resNFe>`
const XML_COMPLETO = `<NFe><infNFe Id="NFe${CHAVE}">
  <ide><dhEmi>2026-08-03T10:00:00-03:00</dhEmi></ide>
  <emit><CNPJ>10921911001004</CNPJ><xNome>FORTLEV</xNome></emit>
  <dest><CNPJ>34221243000171</CNPJ></dest>
  <transp><modFrete>0</modFrete></transp>
  <det nItem="1"><prod><cProd>1</cProd><xProd>Item</xProd><qCom>1</qCom><vUnCom>10</vUnCom><vProd>10</vProd></prod></det>
  <total><ICMSTot><vNF>10.00</vNF></ICMSTot></total>
</infNFe></NFe>`

const JSON_COMPLETA = {
  nfe_completa: true,
  requisicao_nota_fiscal: {
    modalidade_frete: '0',
    itens: [
      {
        numero_item: '1',
        codigo_produto: 'ABC123',
        codigo_barras_comercial: '7891234567890',
        descricao: 'Produto Teste',
        codigo_ncm: '22021000',
        cfop: '5102',
        unidade_comercial: 'UN',
        quantidade_comercial: '10.0000',
        valor_unitario_comercial: '5.5000',
        valor_bruto: '55.00',
        icms_origem: '0',
        icms_situacao_tributaria: '00',
      },
    ],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  buscarPorChave.mockResolvedValue(null)
  buscarConfigPorEmpresa.mockResolvedValue({
    ativo: true,
    apiToken: 'token-teste',
    homologacao: true,
  })
  buscarEmpresaCnpj.mockResolvedValue({ cnpj: '34221243000171' })
  upsertNfeRecebida.mockResolvedValue({ registro: { id: 'nota-1' }, criado: true })
  manifestar.mockResolvedValue({ sucesso: true })
  consultarNfeRecebida.mockResolvedValue({ sucesso: true, dados: {} })
  contarItens.mockResolvedValue(0)
  substituirItensDoXml.mockResolvedValue([])
  atualizarNota.mockResolvedValue({})
  processarAposXml.mockResolvedValue({})
})

describe('importarNfePorChave', () => {
  it('retry 2,5s: 1º XML resNFe e 2º com det → ok e processarAposXml', async () => {
    vi.useFakeTimers()
    baixarXml
      .mockResolvedValueOnce({ sucesso: true, dados: XML_RESUMO })
      .mockResolvedValueOnce({ sucesso: true, dados: XML_COMPLETO })

    const promessa = importarNfePorChave('emp-1', CHAVE)
    await vi.advanceTimersByTimeAsync(3000)
    const r = await promessa
    vi.useRealTimers()

    expect(r).toEqual({ ok: true, notaId: 'nota-1', jaExistia: false })
    expect(baixarXml).toHaveBeenCalledTimes(2)
    expect(processarAposXml).toHaveBeenCalledWith('emp-1', 'nota-1')
    expect(substituirItensDoXml).not.toHaveBeenCalled()
    expect(upsertNfeRecebida).toHaveBeenCalledWith(
      expect.objectContaining({ nfeCompleta: true, xmlConteudo: XML_COMPLETO })
    )
  })

  it('ambos XML resNFe + JSON completa=1 com itens → ok e grava itens', async () => {
    vi.useFakeTimers()
    baixarXml.mockResolvedValue({ sucesso: true, dados: XML_RESUMO })
    consultarNfeRecebida
      .mockResolvedValueOnce({ sucesso: true, dados: {} })
      .mockResolvedValueOnce({ sucesso: true, dados: JSON_COMPLETA })

    const promessa = importarNfePorChave('emp-1', CHAVE)
    await vi.advanceTimersByTimeAsync(3000)
    const r = await promessa
    vi.useRealTimers()

    expect(r).toEqual({ ok: true, notaId: 'nota-1', jaExistia: false })
    expect(baixarXml).toHaveBeenCalledTimes(2)
    expect(consultarNfeRecebida).toHaveBeenCalledTimes(2)
    expect(consultarNfeRecebida).toHaveBeenLastCalledWith(
      'token-teste',
      true,
      CHAVE,
      expect.objectContaining({ completa: true })
    )
    expect(substituirItensDoXml).toHaveBeenCalledWith(
      'nota-1',
      expect.arrayContaining([expect.objectContaining({ codigoProduto: 'ABC123' })])
    )
    expect(processarAposXml).not.toHaveBeenCalled()
    expect(upsertNfeRecebida).toHaveBeenCalledWith(
      expect.objectContaining({ nfeCompleta: false })
    )
  })

  it('ambos XML resNFe + consulta sem itens → ok false DistDFe', async () => {
    vi.useFakeTimers()
    baixarXml.mockResolvedValue({ sucesso: true, dados: XML_RESUMO })
    consultarNfeRecebida.mockResolvedValue({ sucesso: true, dados: {} })

    const promessa = importarNfePorChave('emp-1', CHAVE)
    await vi.advanceTimersByTimeAsync(3000)
    const r = await promessa
    vi.useRealTimers()

    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.mensagem).toMatch(/resumo DistDFe/i)
    }
    expect(processarAposXml).not.toHaveBeenCalled()
    expect(substituirItensDoXml).not.toHaveBeenCalled()
  })

  it('não chama Focus se a NF local já tem itens no banco', async () => {
    buscarPorChave.mockResolvedValue({
      id: 'nota-local',
      xmlConteudo: XML_RESUMO,
      nfeCompleta: false,
    })
    contarItens.mockResolvedValue(2)

    const r = await importarNfePorChave('emp-1', CHAVE)

    expect(r).toEqual({ ok: true, notaId: 'nota-local', jaExistia: true })
    expect(baixarXml).not.toHaveBeenCalled()
    expect(manifestar).not.toHaveBeenCalled()
  })
})
