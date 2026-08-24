/**
 * Import CT-e por chave: rejeita quando tomador ≠ CNPJ da empresa.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const buscarPorChave = vi.fn()
const buscarEmpresaCnpj = vi.fn()
const buscarConfigPorEmpresa = vi.fn()
const upsertNfeRecebida = vi.fn()
const baixarXmlCte = vi.fn()

vi.mock('./repositorio-focus-nfe.js', () => ({
  repositorioFocusNfe: {
    buscarPorChave: (...a: unknown[]) => buscarPorChave(...a),
    buscarEmpresaCnpj: (...a: unknown[]) => buscarEmpresaCnpj(...a),
    buscarConfigPorEmpresa: (...a: unknown[]) => buscarConfigPorEmpresa(...a),
    upsertNfeRecebida: (...a: unknown[]) => upsertNfeRecebida(...a),
  },
}))

vi.mock('./cliente-focus-nfe.js', () => ({
  clienteFocusNfe: {
    baixarXmlCte: (...a: unknown[]) => baixarXmlCte(...a),
  },
}))

vi.mock('./logs-focus-nfe.js', () => ({
  logFocus: vi.fn(),
}))

import { importarCtePorChave } from './importar-cte-por-chave.js'

const CNPJ_EMPRESA = '34221243000171'
const CNPJ_FORTLEV = '10921911001004'
const CNPJ_KNA = '52568377000145'
const CHAVE_CTE = '52260852568377000145570010000091741865753725'
const CHAVE_NFE = '52260810921911001004550010002649141156356287'

function xmlCteTomadorRemetente() {
  return `<?xml version="1.0"?>
    <cteProc>
      <CTe>
        <infCte Id="CTe${CHAVE_CTE}">
          <ide><dhEmi>2026-08-03T16:05:44-03:00</dhEmi><toma>0</toma></ide>
          <emit><CNPJ>${CNPJ_KNA}</CNPJ><xNome>KNA</xNome></emit>
          <rem><CNPJ>${CNPJ_FORTLEV}</CNPJ><xNome>FORTLEV</xNome></rem>
          <dest><CNPJ>${CNPJ_EMPRESA}</CNPJ><xNome>CONEXAO</xNome></dest>
          <infDoc><infNFe><chave>${CHAVE_NFE}</chave></infNFe></infDoc>
          <vPrest><vTPrest>638.71</vTPrest></vPrest>
        </infCte>
      </CTe>
    </cteProc>`
}

function xmlCteTomadorDestinatario() {
  return `<?xml version="1.0"?>
    <cteProc>
      <CTe>
        <infCte Id="CTe${CHAVE_CTE}">
          <ide><dhEmi>2026-08-03T16:05:44-03:00</dhEmi><toma>3</toma></ide>
          <emit><CNPJ>${CNPJ_KNA}</CNPJ><xNome>KNA</xNome></emit>
          <rem><CNPJ>${CNPJ_FORTLEV}</CNPJ><xNome>FORTLEV</xNome></rem>
          <dest><CNPJ>${CNPJ_EMPRESA}</CNPJ><xNome>CONEXAO</xNome></dest>
          <infDoc><infNFe><chave>${CHAVE_NFE}</chave></infNFe></infDoc>
          <vPrest><vTPrest>638.71</vTPrest></vPrest>
        </infCte>
      </CTe>
    </cteProc>`
}

beforeEach(() => {
  vi.clearAllMocks()
  buscarPorChave.mockResolvedValue(null)
  buscarEmpresaCnpj.mockResolvedValue({ cnpj: CNPJ_EMPRESA })
  buscarConfigPorEmpresa.mockResolvedValue({
    ativo: true,
    apiToken: 'token-teste',
    homologacao: true,
  })
})

describe('importarCtePorChave — filtro tomador', () => {
  it('rejeita CT-e cujo tomador é o remetente (não a empresa)', async () => {
    baixarXmlCte.mockResolvedValue({ sucesso: true, dados: xmlCteTomadorRemetente() })

    const r = await importarCtePorChave('emp-1', CHAVE_CTE)

    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('tomador_nao_empresa')
    expect(upsertNfeRecebida).not.toHaveBeenCalled()
  })

  it('grava CT-e quando tomador é o destinatário (empresa)', async () => {
    baixarXmlCte.mockResolvedValue({ sucesso: true, dados: xmlCteTomadorDestinatario() })
    upsertNfeRecebida.mockResolvedValue({
      criado: true,
      registro: { id: 'cte-novo' },
    })

    const r = await importarCtePorChave('emp-1', CHAVE_CTE, { pularPipeline: true })

    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.criado).toBe(true)
      expect(r.cteId).toBe('cte-novo')
    }
    expect(upsertNfeRecebida).toHaveBeenCalled()
  })

  it('CT-e Focus já completo com tomador ≠ empresa não retorna ok', async () => {
    buscarPorChave.mockResolvedValue({
      id: 'cte-legado',
      xmlConteudo: xmlCteTomadorRemetente(),
      nfeCompleta: true,
      origem: 'focus',
    })

    const r = await importarCtePorChave('emp-1', CHAVE_CTE)

    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('tomador_nao_empresa')
    expect(upsertNfeRecebida).not.toHaveBeenCalled()
  })

  it('CT-e origem=xml já completo com tomador ≠ empresa continua ok (emergência)', async () => {
    buscarPorChave.mockResolvedValue({
      id: 'cte-xml',
      xmlConteudo: xmlCteTomadorRemetente(),
      nfeCompleta: true,
      origem: 'xml',
    })

    const r = await importarCtePorChave('emp-1', CHAVE_CTE)

    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.cteId).toBe('cte-xml')
      expect(r.jaExistia).toBe(true)
    }
  })
})
