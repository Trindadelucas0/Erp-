/**
 * Caso Fortlev↔KNA (imagens Entrada): tomador = Fortlev → sem auto-vínculo;
 * tomador = empresa → vincula; NFe sem itens → não vincula.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const findFirst = vi.fn()
const findUnique = vi.fn()
const findMany = vi.fn()
const update = vi.fn()
const create = vi.fn()
const deleteFn = vi.fn()
const vinculoFindUnique = vi.fn()
const vinculoFindMany = vi.fn()
const vinculoCreate = vi.fn()
const vinculoDelete = vi.fn()

vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({
  clientePrisma: {
    nfeRecebida: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      findUnique: (...a: unknown[]) => findUnique(...a),
      findMany: (...a: unknown[]) => findMany(...a),
      update: (...a: unknown[]) => update(...a),
    },
    nfeCteVinculo: {
      findUnique: (...a: unknown[]) => vinculoFindUnique(...a),
      findMany: (...a: unknown[]) => vinculoFindMany(...a),
      create: (...a: unknown[]) => vinculoCreate(...a),
      delete: (...a: unknown[]) => vinculoDelete(...a),
    },
  },
}))

vi.mock('../focus-nfe/repositorio-focus-nfe.js', () => ({
  repositorioFocusNfe: {
    buscarEmpresaCnpj: vi.fn(),
  },
}))

vi.mock('../focus-nfe/importar-nfe-por-chave.js', () => ({
  importarNfePorChave: vi.fn(),
}))

vi.mock('../focus-nfe/logs-focus-nfe.js', () => ({
  logFocus: vi.fn(),
  logTabelaVinculoCte: vi.fn(),
}))

import { repositorioFocusNfe } from '../focus-nfe/repositorio-focus-nfe.js'
import { servicoVinculoCte } from './servico-vinculo-cte.js'

const CNPJ_EMPRESA = '34221243000171'
const CNPJ_FORTLEV = '10921911001004'
const CNPJ_KNA = '52568377000145'
const CHAVE_NFE = '52260810921911001004550010002649141156356287'
const CHAVE_CTE = '52260852568377000145570010000091741865753725'

function xmlCteTomadorRemetente() {
  return `<?xml version="1.0"?>
    <cteProc>
      <CTe>
        <infCte Id="CTe${CHAVE_CTE}">
          <ide><dhEmi>2026-08-03T16:05:44-03:00</dhEmi><toma>0</toma></ide>
          <emit><CNPJ>${CNPJ_KNA}</CNPJ><xNome>KNA TRANSPORTES</xNome></emit>
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
          <emit><CNPJ>${CNPJ_KNA}</CNPJ><xNome>KNA TRANSPORTES</xNome></emit>
          <rem><CNPJ>${CNPJ_FORTLEV}</CNPJ><xNome>FORTLEV</xNome></rem>
          <dest><CNPJ>${CNPJ_EMPRESA}</CNPJ><xNome>CONEXAO</xNome></dest>
          <infDoc><infNFe><chave>${CHAVE_NFE}</chave></infNFe></infDoc>
          <vPrest><vTPrest>638.71</vTPrest></vPrest>
        </infCte>
      </CTe>
    </cteProc>`
}

function xmlNfeCompleta() {
  return `<NFe><infNFe Id="NFe${CHAVE_NFE}">
    <ide><dhEmi>2026-08-03T10:00:00-03:00</dhEmi></ide>
    <emit><CNPJ>${CNPJ_FORTLEV}</CNPJ><xNome>FORTLEV</xNome></emit>
    <dest><CNPJ>${CNPJ_EMPRESA}</CNPJ><xNome>CONEXAO</xNome></dest>
    <transp><modFrete>0</modFrete></transp>
    <det nItem="1"><prod><cProd>1</cProd><xProd>Item</xProd><qCom>1</qCom><vUnCom>10</vUnCom><vProd>10</vProd></prod></det>
    <total><ICMSTot><vNF>10.00</vNF></ICMSTot></total>
  </infNFe></NFe>`
}

function xmlNfeResumo() {
  return `<resNFe><chNFe>${CHAVE_NFE}</chNFe><CNPJ>${CNPJ_FORTLEV}</CNPJ><xNome>FORTLEV</xNome><vNF>4143.42</vNF></resNFe>`
}

beforeEach(() => {
  vi.clearAllMocks()
  update.mockResolvedValue({})
  vinculoCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'vinculo-1',
    ...data,
  }))
  vi.mocked(repositorioFocusNfe.buscarEmpresaCnpj).mockResolvedValue({
    cnpj: CNPJ_EMPRESA,
  } as never)
})

describe('servicoVinculoCte — caso Fortlev/KNA', () => {
  it('não auto-vincula quando tomador do CT-e é a Fortlev (remetente), não a empresa', async () => {
    findFirst.mockResolvedValue({
      id: 'cte-1',
      companyId: 'emp-1',
      tipoDocumento: 'cte',
      chaveNfe: CHAVE_CTE,
      chaveNfeReferenciada: CHAVE_NFE,
      xmlConteudo: xmlCteTomadorRemetente(),
      valorTotal: 638.71,
    })

    const r = await servicoVinculoCte.tentarVincularCteAutomatico('emp-1', 'cte-1', {
      importarFocusSeAusente: false,
    })

    expect(r.vinculado).toBe(false)
    expect(r.tomadorNaoEmpresa).toBe(true)
    expect(vinculoCreate).not.toHaveBeenCalled()
  })

  it('auto-vincula quando tomador é a empresa (destinatário) e NF tem itens', async () => {
    findFirst.mockResolvedValue({
      id: 'cte-1',
      companyId: 'emp-1',
      tipoDocumento: 'cte',
      chaveNfe: CHAVE_CTE,
      chaveNfeReferenciada: CHAVE_NFE,
      xmlConteudo: xmlCteTomadorDestinatario(),
      valorTotal: 638.71,
    })
    vinculoFindUnique.mockResolvedValue(null)
    findUnique.mockResolvedValue({
      id: 'nfe-1',
      tipoDocumento: 'nfe55',
      xmlConteudo: xmlNfeCompleta(),
      nfeCompleta: true,
      chaveNfe: CHAVE_NFE,
    })

    const r = await servicoVinculoCte.tentarVincularCteAutomatico('emp-1', 'cte-1', {
      importarFocusSeAusente: false,
    })

    expect(r.vinculado).toBe(true)
    expect(vinculoCreate).toHaveBeenCalled()
  })

  it('não auto-vincula NF só com resumo DistDFe (sem itens), mesmo com tomador = empresa', async () => {
    findFirst.mockResolvedValue({
      id: 'cte-1',
      companyId: 'emp-1',
      tipoDocumento: 'cte',
      chaveNfe: CHAVE_CTE,
      chaveNfeReferenciada: CHAVE_NFE,
      xmlConteudo: xmlCteTomadorDestinatario(),
      valorTotal: 638.71,
    })
    vinculoFindUnique.mockResolvedValue(null)
    findUnique.mockResolvedValue({
      id: 'nfe-1',
      tipoDocumento: 'nfe55',
      xmlConteudo: xmlNfeResumo(),
      nfeCompleta: false,
      chaveNfe: CHAVE_NFE,
    })

    const r = await servicoVinculoCte.tentarVincularCteAutomatico('emp-1', 'cte-1', {
      importarFocusSeAusente: false,
    })

    expect(r.vinculado).toBe(false)
    expect(vinculoCreate).not.toHaveBeenCalled()
  })

  it('repararVinculosCteTomadorIndevido remove vínculo automático Fortlev↔KNA', async () => {
    vinculoFindMany.mockResolvedValue([
      {
        id: 'v-1',
        companyId: 'emp-1',
        nfeRecebidaId: 'nfe-1',
        cteRecebidaId: 'cte-1',
        origemVinculo: 'automatico',
        cteRecebida: {
          id: 'cte-1',
          xmlConteudo: xmlCteTomadorRemetente(),
          chaveNfe: CHAVE_CTE,
        },
        nfeRecebida: { id: 'nfe-1' },
      },
    ])
    vinculoDelete.mockResolvedValue({})
    // reanalisarCteAposVinculo → dynamic import analisarNota — mock findFirst for reanalise path
    findFirst.mockResolvedValue(null)

    const removidos = await servicoVinculoCte.repararVinculosCteTomadorIndevido('emp-1')

    expect(removidos).toBe(1)
    expect(vinculoDelete).toHaveBeenCalledWith({ where: { id: 'v-1' } })
  })
})
