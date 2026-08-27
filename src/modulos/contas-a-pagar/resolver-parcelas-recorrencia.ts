import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import {
  extrairDuplicatasCobrancaDoXml,
  montarParcelasContaPagarDaNfe,
  normalizarXmlNfe,
} from '../focus-nfe/parser-xml-nfe.js'

function decimalNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  return Number(v)
}

function dataIsoDia(v: Date | string | null | undefined): Date | null {
  if (v == null) return null
  const d = v instanceof Date ? new Date(v) : new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Resolve parcelas/vencimento para título gerado por recorrência (NFS-e ou NFe documental).
 * Ordem: duplicatas/prazo da nota → dataEmissão + prazoPagamento1 do fornecedor.
 * Fail-closed (§7.4): sem vencimento resolvível → ok:false.
 */
export async function resolverParcelasRecorrencia(input: {
  companyId: string
  fornecedorPessoaId: string | null
  valorTotal: number
  dataEmissao: Date | null
  xmlConteudo?: string | null
  prazoPagamentoXml?: string | null
  prazoPagamentoTexto?: string | null
}): Promise<
  | {
      ok: true
      parcelas: Array<{ numeroDocumento: string | null; vencimento: Date; valor: number }>
    }
  | { ok: false; mensagem: string }
> {
  const valorTotal = decimalNum(input.valorTotal)
  if (!(valorTotal > 0)) {
    return { ok: false, mensagem: 'Nota sem valor total — não é possível gerar Contas a Pagar.' }
  }

  const xml = input.xmlConteudo ? normalizarXmlNfe(input.xmlConteudo) : ''
  const dupsXml = xml ? extrairDuplicatasCobrancaDoXml(xml) : []
  const montagem = montarParcelasContaPagarDaNfe({
    duplicatasXml: dupsXml,
    valorTotalNf: valorTotal,
    prazoPagamentoXml: input.prazoPagamentoXml,
    prazoPagamentoTexto: input.prazoPagamentoTexto,
  })
  if (montagem.ok) return montagem

  const emissao = dataIsoDia(input.dataEmissao)
  if (!emissao) {
    return {
      ok: false,
      mensagem:
        'Recorrência: nota sem data de emissão e sem vencimento no XML — não é possível gerar Contas a Pagar.',
    }
  }

  if (!input.fornecedorPessoaId) {
    return {
      ok: false,
      mensagem:
        'Recorrência: cadastre o prazo de pagamento no fornecedor (prazo 1) para gerar o vencimento do título.',
    }
  }

  const papel = await clientePrisma.pessoaPapel.findFirst({
    where: {
      pessoaId: input.fornecedorPessoaId,
      papel: 'fornecedor',
      ativo: true,
      pessoa: { companyId: input.companyId },
    },
    select: {
      dadosFornecedor: { select: { prazoPagamento1: true } },
    },
  })
  const prazoDias = papel?.dadosFornecedor?.prazoPagamento1
  if (prazoDias == null || !Number.isFinite(prazoDias) || prazoDias < 0) {
    return {
      ok: false,
      mensagem:
        'Recorrência: cadastre o prazo de pagamento no fornecedor (prazo 1) para gerar o vencimento do título.',
    }
  }

  const vencimento = new Date(emissao)
  vencimento.setDate(vencimento.getDate() + prazoDias)
  vencimento.setHours(0, 0, 0, 0)

  return {
    ok: true,
    parcelas: [{ numeroDocumento: null, vencimento, valor: valorTotal }],
  }
}
