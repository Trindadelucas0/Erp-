import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { extrairItensComIa } from './extrair-itens-com-ia.js'

const ENV_ORIGINAL = { ...process.env }

beforeEach(() => {
  process.env.IA_PROVIDER = 'anthropic'
  process.env.IA_API_KEY = 'chave-teste'
})

afterEach(() => {
  process.env = { ...ENV_ORIGINAL }
  vi.unstubAllGlobals()
})

const RESPOSTA_VALIDA = {
  cabecalho: {
    fornecedorNome: 'Fornecedor Teste',
    fornecedorCnpj: null,
    numeroDocumentoFornecedor: null,
    dataEmissao: null,
    condicaoPagamento: '30/60 dias',
    prazoEntregaDias: null,
    modalidadeTransporte: 'CIF',
    valorTotalGeral: 100,
  },
  itens: [
    {
      codigo: '001',
      codigoBarras: null,
      ncm: null,
      descricao: 'Produto Teste',
      unidade: 'UN',
      quantidade: 10,
      precoUnitario: 10,
      precoUnitarioComImposto: null,
      valorTotalItem: 100,
    },
  ],
  avisos: [],
}

describe('extrairItensComIa', () => {
  it('retorna dados validados quando a IA responde um JSON correto', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ text: JSON.stringify(RESPOSTA_VALIDA) }] }),
      })
    )

    const resultado = await extrairItensComIa('texto do documento')

    expect(resultado.sucesso).toBe(true)
    if (resultado.sucesso) {
      expect(resultado.dados.itens).toHaveLength(1)
      expect(resultado.dados.cabecalho.fornecedorNome).toBe('Fornecedor Teste')
      expect(resultado.provider).toBe('anthropic')
    }
  })

  it('lida com resposta da IA cercada por markdown ```json', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ text: '```json\n' + JSON.stringify(RESPOSTA_VALIDA) + '\n```' }] }),
      })
    )

    const resultado = await extrairItensComIa('texto do documento')
    expect(resultado.sucesso).toBe(true)
  })

  it('retorna falha quando a IA não está configurada', async () => {
    delete process.env.IA_PROVIDER
    delete process.env.IA_API_KEY

    const resultado = await extrairItensComIa('texto do documento')
    expect(resultado.sucesso).toBe(false)
  })

  it('retorna falha quando a resposta não é um JSON válido', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ text: 'isso não é json' }] }),
      })
    )

    const resultado = await extrairItensComIa('texto do documento')
    expect(resultado.sucesso).toBe(false)
    if (!resultado.sucesso) {
      expect(resultado.mensagem).toMatch(/JSON/)
    }
  })

  it('retorna falha quando o JSON não segue o schema esperado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ text: JSON.stringify({ foo: 'bar' }) }] }),
      })
    )

    const resultado = await extrairItensComIa('texto do documento')
    expect(resultado.sucesso).toBe(false)
  })
})
