import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoBrasilApi } from './servico-brasil-api.js'

const CNPJ_PRINT = '24628580000124'
const RAZAO_PRINT = 'ISMAEL LUCIANO DE BRITO 17955211120'

function jsonResponse(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('servicoBrasilApi.consultarCnpj', () => {
  it('não chama fetch quando o CNPJ é inválido', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(servicoBrasilApi.consultarCnpj('123')).rejects.toMatchObject({
      codigoHttp: 400,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('BrasilAPI 200 não chama a OpenCNPJ', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('brasilapi.com.br')) {
        return jsonResponse(200, {
          razao_social: 'BANCO DO BRASIL SA',
          nome_fantasia: 'DIRECAO GERAL',
          cnae_fiscal: 6422100,
          cnae_fiscal_descricao: 'Bancos múltiplos',
          data_inicio_atividade: '1966-08-01',
          opcao_pelo_simples: false,
          cep: '70040912',
          logradouro: 'SAUN',
          numero: 'SN',
          bairro: 'ASA NORTE',
          municipio: 'BRASILIA',
          uf: 'DF',
          codigo_municipio_ibge: 5300108,
        })
      }
      throw new Error(`URL inesperada: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const dados = await servicoBrasilApi.consultarCnpj('00000000000191')
    expect(dados.nome).toBe('BANCO DO BRASIL SA')
    expect(dados.cnae).toBe('6422100')
    expect(dados.codigoIbge).toBe('5300108')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('brasilapi.com.br')
  })

  it('BrasilAPI 500 + OpenCNPJ 200 preenche razão e CNAE sem SIAFI no IBGE', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const alvo = String(url)
      if (alvo.includes('brasilapi.com.br')) {
        return jsonResponse(500, { message: 'internal' })
      }
      if (alvo.includes('api.opencnpj.org')) {
        return jsonResponse(200, {
          razao_social: RAZAO_PRINT,
          nome_fantasia: '',
          data_inicio_atividade: '2016-04-19',
          opcao_simples: 'S',
          cep: '72155820',
          logradouro: 'QNL 8 BLOCO J',
          numero: '03',
          bairro: 'TAGUATINGA NORTE (TAGUATINGA)',
          municipio: 'BRASILIA',
          uf: 'DF',
          codigo_municipio: '9701',
          cnaes: [
            {
              codigo: '4752100',
              descricao: 'Comércio varejista especializado de equipamentos de telefonia e comunicação',
              is_principal: true,
            },
          ],
          telefones: [{ ddd: '61', numero: '99730911' }],
        })
      }
      if (alvo.includes('viacep.com.br')) {
        return jsonResponse(200, { ibge: '5300108' })
      }
      throw new Error(`URL inesperada: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const dados = await servicoBrasilApi.consultarCnpj(CNPJ_PRINT)
    expect(dados.nome).toBe(RAZAO_PRINT)
    expect(dados.cnae).toBe('4752100')
    expect(dados.simplesNacional).toBe(true)
    expect(dados.codigoIbge).not.toBe('9701')
    expect(dados.codigoIbge).toBe('5300108')
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('brasilapi.com.br'),
        expect.stringContaining('api.opencnpj.org'),
      ])
    )
  })

  it('as duas fontes falhando lançam 502', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(500, { message: 'down' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(servicoBrasilApi.consultarCnpj(CNPJ_PRINT)).rejects.toEqual(
      expect.objectContaining({
        name: 'ErroDaAplicacao',
        codigoHttp: 502,
        message: 'Não foi possível consultar a Receita Federal',
      })
    )
    expect(ErroDaAplicacao).toBeDefined()
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
