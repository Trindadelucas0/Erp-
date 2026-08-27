import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({
  clientePrisma: {
    pessoaPapel: { findFirst: vi.fn() },
  },
}))

vi.mock('../focus-nfe/parser-xml-nfe.js', () => ({
  normalizarXmlNfe: (xml: string) => xml,
  extrairDuplicatasCobrancaDoXml: vi.fn(() => []),
  montarParcelasContaPagarDaNfe: vi.fn(() => ({
    ok: false,
    mensagem: 'sem vencimento no XML',
  })),
}))

import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { montarParcelasContaPagarDaNfe } from '../focus-nfe/parser-xml-nfe.js'
import { resolverParcelasRecorrencia } from './resolver-parcelas-recorrencia.js'

describe('resolverParcelasRecorrencia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(montarParcelasContaPagarDaNfe).mockReturnValue({
      ok: false,
      mensagem: 'sem vencimento no XML',
    })
  })

  it('usa duplicatas/prazo da nota quando disponíveis', async () => {
    const venc = new Date('2026-09-15T00:00:00.000Z')
    vi.mocked(montarParcelasContaPagarDaNfe).mockReturnValue({
      ok: true,
      parcelas: [{ numeroDocumento: '1', vencimento: venc, valor: 2600 }],
    })

    const r = await resolverParcelasRecorrencia({
      companyId: 'c1',
      fornecedorPessoaId: 'f1',
      valorTotal: 2600,
      dataEmissao: new Date('2026-08-01'),
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.parcelas[0]?.valor).toBe(2600)
      expect(r.parcelas[0]?.vencimento).toEqual(venc)
    }
    expect(clientePrisma.pessoaPapel.findFirst).not.toHaveBeenCalled()
  })

  it('usa dataEmissão + prazoPagamento1 do fornecedor', async () => {
    vi.mocked(clientePrisma.pessoaPapel.findFirst).mockResolvedValue({
      dadosFornecedor: { prazoPagamento1: 30 },
    } as never)

    const r = await resolverParcelasRecorrencia({
      companyId: 'c1',
      fornecedorPessoaId: 'f1',
      valorTotal: 2600,
      dataEmissao: new Date('2026-08-01T12:00:00'),
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.parcelas).toHaveLength(1)
      expect(r.parcelas[0]?.valor).toBe(2600)
      const v = r.parcelas[0]!.vencimento
      expect(v.getDate()).toBe(31) // 1 + 30 = 31 ago
      expect(v.getMonth()).toBe(7)
    }
  })

  it('fail-closed sem prazo no fornecedor', async () => {
    vi.mocked(clientePrisma.pessoaPapel.findFirst).mockResolvedValue({
      dadosFornecedor: { prazoPagamento1: null },
    } as never)

    const r = await resolverParcelasRecorrencia({
      companyId: 'c1',
      fornecedorPessoaId: 'f1',
      valorTotal: 2600,
      dataEmissao: new Date('2026-08-01'),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.mensagem).toMatch(/prazo/i)
    }
  })

  it('fail-closed sem valor', async () => {
    const r = await resolverParcelasRecorrencia({
      companyId: 'c1',
      fornecedorPessoaId: 'f1',
      valorTotal: 0,
      dataEmissao: new Date('2026-08-01'),
    })
    expect(r.ok).toBe(false)
  })
})
