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
const vinculoUpdate = vi.fn()
const vinculoDelete = vi.fn()
const itemCount = vi.fn()

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
      update: (...a: unknown[]) => vinculoUpdate(...a),
      delete: (...a: unknown[]) => vinculoDelete(...a),
    },
    nfeRecebidaItem: {
      count: (...a: unknown[]) => itemCount(...a),
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
import { ratearProporcionalCentavos } from './rateio-cte-multiplas-nfes.js'
import { servicoVinculoCte } from './servico-vinculo-cte.js'

const CNPJ_EMPRESA = '34221243000171'
const CNPJ_FORTLEV = '10921911001004'
const CNPJ_KNA = '52568377000145'
const CHAVE_NFE = '52260810921911001004550010002649141156356287'
const CHAVE_NFE_2 = '52260810921911001004550010002649221156356288'
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

function xmlCteDuasNfes() {
  return xmlCteTomadorDestinatario().replace(
    `<infDoc><infNFe><chave>${CHAVE_NFE}</chave></infNFe></infDoc>`,
    `<infDoc><infNFe><chave>${CHAVE_NFE}</chave></infNFe><infNFe><chave>${CHAVE_NFE_2}</chave></infNFe></infDoc>`
  )
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
  itemCount.mockResolvedValue(0)
  vinculoFindMany.mockResolvedValue([])
  vinculoUpdate.mockResolvedValue({})
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
      valorTotal: 10,
      statusEntrada: 'em_analise',
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
      valorTotal: 4143.42,
      statusEntrada: 'em_analise',
    })

    const r = await servicoVinculoCte.tentarVincularCteAutomatico('emp-1', 'cte-1', {
      importarFocusSeAusente: false,
    })

    expect(r.vinculado).toBe(false)
    expect(vinculoCreate).not.toHaveBeenCalled()
  })

  it('auto-vincula NF com resumo DistDFe se já houver itens no banco', async () => {
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
      valorTotal: 4143.42,
      statusEntrada: 'em_analise',
    })
    itemCount.mockResolvedValue(1)

    const r = await servicoVinculoCte.tentarVincularCteAutomatico('emp-1', 'cte-1', {
      importarFocusSeAusente: false,
    })

    expect(r.vinculado).toBe(true)
    expect(vinculoCreate).toHaveBeenCalled()
  })

  it('auto-vincula um CT-e às duas NF-e referenciadas e rateia pelo valor das notas', async () => {
    findFirst.mockResolvedValue({
      id: 'cte-1',
      companyId: 'emp-1',
      tipoDocumento: 'cte',
      chaveNfe: CHAVE_CTE,
      chaveNfeReferenciada: CHAVE_NFE,
      xmlConteudo: xmlCteDuasNfes(),
      valorTotal: 638.71,
    })
    const nfes = new Map([
      [CHAVE_NFE, { id: 'nfe-1', tipoDocumento: 'nfe55', xmlConteudo: xmlNfeCompleta(), chaveNfe: CHAVE_NFE, valorTotal: 10, statusEntrada: 'em_analise' }],
      [CHAVE_NFE_2, { id: 'nfe-2', tipoDocumento: 'nfe55', xmlConteudo: xmlNfeCompleta(), chaveNfe: CHAVE_NFE_2, valorTotal: 30, statusEntrada: 'em_analise' }],
    ])
    findUnique.mockImplementation(async ({ where }: { where: { companyId_chaveNfe?: { chaveNfe: string } } }) =>
      where.companyId_chaveNfe ? nfes.get(where.companyId_chaveNfe.chaveNfe) ?? null : null
    )
    const vinculos: Array<Record<string, unknown>> = []
    vinculoFindMany.mockImplementation(async () => [...vinculos])
    vinculoCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      const nfe = [...nfes.values()].find((item) => item.id === data.nfeRecebidaId)!
      const criado = { ...data, nfeRecebida: { valorTotal: nfe.valorTotal, statusEntrada: nfe.statusEntrada } }
      vinculos.push(criado)
      return criado
    })
    vinculoUpdate.mockImplementation(async ({ where, data }: { where: { id: string }; data: { valorFrete: number } }) => {
      const vinculo = vinculos.find((item) => item.id === where.id)
      if (vinculo) vinculo.valorFrete = data.valorFrete
      return vinculo
    })

    const r = await servicoVinculoCte.tentarVincularCteAutomatico('emp-1', 'cte-1', {
      importarFocusSeAusente: false,
    })

    expect(r.vinculado).toBe(true)
    expect(vinculoCreate).toHaveBeenCalledTimes(2)
    expect(vinculos.map((v) => v.valorFrete).sort()).toEqual([159.68, 479.03])
  })

  it('não inclui outra NF-e quando uma nota do mesmo CT-e já saiu da análise', async () => {
    findFirst.mockResolvedValue({
      id: 'cte-1', companyId: 'emp-1', tipoDocumento: 'cte', chaveNfe: CHAVE_CTE,
      chaveNfeReferenciada: CHAVE_NFE, xmlConteudo: xmlCteDuasNfes(), valorTotal: 638.71,
    })
    findUnique.mockImplementation(async ({ where }: { where: { companyId_chaveNfe?: { chaveNfe: string } } }) => ({
      id: where.companyId_chaveNfe?.chaveNfe === CHAVE_NFE ? 'nfe-1' : 'nfe-2',
      tipoDocumento: 'nfe55', xmlConteudo: xmlNfeCompleta(), valorTotal: 100,
      statusEntrada: 'em_analise', chaveNfe: where.companyId_chaveNfe?.chaveNfe,
    }))
    vinculoFindMany.mockResolvedValue([{ id: 'v-1', nfeRecebidaId: 'nfe-1', valorFrete: 638.71, nfeRecebida: { valorTotal: 100, statusEntrada: 'aguardando_chegada' } }])

    await servicoVinculoCte.tentarVincularCteAutomatico('emp-1', 'cte-1', {
      importarFocusSeAusente: false,
    })

    expect(vinculoCreate).not.toHaveBeenCalled()
  })

  it('ao reanalisar a segunda NF-e, encontra CT-e já ligado à primeira e completa o vínculo', async () => {
    findFirst.mockResolvedValue({
      id: 'nfe-2',
      companyId: 'emp-1',
      tipoDocumento: 'nfe55',
      chaveNfe: CHAVE_NFE_2,
      xmlConteudo: xmlNfeCompleta(),
      valorTotal: 30,
      statusEntrada: 'em_analise',
    })
    findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where?.chaveNfeReferenciada) return []
      if (where?.tipoDocumento === 'cte' && where?.xmlConteudo) {
        return [{
          id: 'cte-1',
          chaveNfe: CHAVE_CTE,
          chaveNfeReferenciada: CHAVE_NFE,
          xmlConteudo: xmlCteDuasNfes(),
          valorTotal: 638.71,
        }]
      }
      return []
    })
    const vinculos: Array<Record<string, unknown>> = [{
      id: 'vinculo-nfe-1',
      nfeRecebidaId: 'nfe-1',
      valorFrete: 638.71,
      nfeRecebida: { valorTotal: 10, statusEntrada: 'em_analise' },
    }]
    vinculoFindMany.mockImplementation(async () => [...vinculos])
    vinculoCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      const criado = {
        id: 'vinculo-nfe-2',
        ...data,
        nfeRecebida: { valorTotal: 30, statusEntrada: 'em_analise' },
      }
      vinculos.push(criado)
      return criado
    })
    vinculoUpdate.mockResolvedValue({})

    await servicoVinculoCte.tentarVincularNfesPendentesAoCte('emp-1', 'nfe-2', {
      reanalisarAposVinculo: false,
    })

    expect(vinculoCreate).toHaveBeenCalledTimes(1)
    expect(vinculoCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        nfeRecebidaId: 'nfe-2',
        cteRecebidaId: 'cte-1',
        origemVinculo: 'automatico',
      }),
    }))
    expect(vinculoUpdate).toHaveBeenCalledTimes(2)
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

  it('repararCtesTomadorIndevido cancela CT-e Focus com tomador ≠ empresa', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 'cte-1',
        xmlConteudo: xmlCteTomadorRemetente(),
        chaveNfe: CHAVE_CTE,
      },
    ])
    vinculoFindMany.mockResolvedValueOnce([
      { id: 'v-1', nfeRecebidaId: 'nfe-1' },
    ])
    vinculoDelete.mockResolvedValue({})
    update.mockResolvedValue({})
    findFirst.mockResolvedValue(null)

    const cancelados = await servicoVinculoCte.repararCtesTomadorIndevido('emp-1')

    expect(cancelados).toBe(1)
    expect(vinculoDelete).toHaveBeenCalledWith({ where: { id: 'v-1' } })
    expect(update).toHaveBeenCalledWith({
      where: { id: 'cte-1' },
      data: { statusEntrada: 'cancelada' },
    })
  })

  it('repararCtesTomadorIndevido preserva CT-e com tomador = empresa', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 'cte-ok',
        xmlConteudo: xmlCteTomadorDestinatario(),
        chaveNfe: CHAVE_CTE,
      },
    ])

    const cancelados = await servicoVinculoCte.repararCtesTomadorIndevido('emp-1')

    expect(cancelados).toBe(0)
    expect(update).not.toHaveBeenCalled()
    expect(vinculoDelete).not.toHaveBeenCalled()
  })
})

describe('rateio de CT-e entre várias NF-e', () => {
  it('divide pelo valor total das notas e preserva o total em centavos', () => {
    const parcelas = ratearProporcionalCentavos(1176.8, [
      { id: 'nf-173934', valorBase: 983.51 },
      { id: 'nf-173935', valorBase: 14751.92 },
    ])

    expect(parcelas.get('nf-173934')).toBe(73.55)
    expect(parcelas.get('nf-173935')).toBe(1103.25)
    expect([...parcelas.values()].reduce((soma, valor) => soma + valor, 0)).toBe(1176.8)
  })

  it('recusa NF-e sem valor positivo', () => {
    expect(() =>
      ratearProporcionalCentavos(100, [
        { id: 'nf-1', valorBase: 100 },
        { id: 'nf-2', valorBase: 0 },
      ])
    ).toThrow('Todas as NF-e vinculadas precisam ter valor total positivo')
  })
})
