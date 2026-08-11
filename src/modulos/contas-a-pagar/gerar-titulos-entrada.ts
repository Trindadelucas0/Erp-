import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import {
  extrairDuplicatasCobrancaDoXml,
  extrairCampoXml,
  montarParcelasContaPagarDaNfe,
  normalizarXmlNfe,
} from '../focus-nfe/parser-xml-nfe.js'
import { repositorioDeContasAPagar, ErroBaixa } from './repositorio-contas-a-pagar.js'

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

type ParcelaStub = {
  numeroDocumento?: string | null
  vencimento?: string | Date | null
  valor?: number | string | null
}

function parcelasDoStubDespesa(despesa: {
  numeroDocumento: string | null
  vencimento: Date | null
  valor: unknown
  parcelas: unknown
}): Array<{ numeroDocumento: string | null; vencimento: Date; valor: number }> {
  const lista: ParcelaStub[] =
    Array.isArray(despesa.parcelas) && despesa.parcelas.length > 0
      ? (despesa.parcelas as ParcelaStub[])
      : [
          {
            numeroDocumento: despesa.numeroDocumento,
            vencimento: despesa.vencimento,
            valor: decimalNum(despesa.valor),
          },
        ]

  const out: Array<{ numeroDocumento: string | null; vencimento: Date; valor: number }> = []
  for (const p of lista) {
    const vencimento = dataIsoDia(p.vencimento ?? null)
    const valor = decimalNum(p.valor)
    if (!vencimento || !(valor > 0)) continue
    out.push({
      numeroDocumento: p.numeroDocumento?.toString().trim() || null,
      vencimento,
      valor,
    })
  }
  return out
}

async function primeiroPlanoLiberadoFornecedor(
  companyId: string,
  pessoaId: string | null
): Promise<string | null> {
  if (!pessoaId) return null
  const papel = await clientePrisma.pessoaPapel.findFirst({
    where: { pessoaId, papel: 'fornecedor', ativo: true, pessoa: { companyId } },
    select: {
      dadosFornecedor: {
        select: {
          planosFinanceiros: {
            take: 1,
            select: { planoFinanceiroId: true },
            orderBy: { planoFinanceiroId: 'asc' },
          },
        },
      },
    },
  })
  return papel?.dadosFornecedor?.planosFinanceiros?.[0]?.planoFinanceiroId ?? null
}

async function promoverFreteParaContaPagar(companyId: string, notaMercadoriaId: string) {
  const nota = await clientePrisma.nfeRecebida.findFirst({
    where: { id: notaMercadoriaId, companyId },
    select: {
      id: true,
      modFrete: true,
      vinculosComoNfe: {
        select: {
          cteRecebidaId: true,
          cteRecebida: {
            select: {
              id: true,
              fornecedorPessoaId: true,
              chaveNfe: true,
              dataEmissao: true,
            },
          },
        },
      },
    },
  })
  if (!nota || nota.modFrete !== '1') {
    return [] as Array<{ id: string; codigo: string; origem: string }>
  }

  const criados: Array<{ id: string; codigo: string; origem: string }> = []

  for (const v of nota.vinculosComoNfe) {
    const cteId = v.cteRecebidaId
    const despesa = await clientePrisma.despesaEntradaDocumento.findUnique({
      where: { nfeRecebidaId_origem: { nfeRecebidaId: cteId, origem: 'cte' } },
    })
    if (!despesa) continue

    const parcelas = parcelasDoStubDespesa(despesa)
    if (parcelas.length === 0) continue

    const planoFinanceiroId =
      despesa.planoFinanceiroId ??
      (await primeiroPlanoLiberadoFornecedor(
        companyId,
        despesa.pessoaId ?? v.cteRecebida?.fornecedorPessoaId ?? null
      ))

    try {
      const { conta, criado } = await repositorioDeContasAPagar.criarDeEntrada(companyId, {
        origem: 'cte',
        pessoaId: despesa.pessoaId ?? v.cteRecebida?.fornecedorPessoaId ?? null,
        planoFinanceiroId,
        // Liga à NF de mercadoria para filtrar/listar juntos na Entrada
        nfeRecebidaId: notaMercadoriaId,
        despesaEntradaId: despesa.id,
        numeroDocumento:
          despesa.numeroDocumento ??
          (v.cteRecebida?.chaveNfe ? v.cteRecebida.chaveNfe.slice(-9) : null),
        dataEmissao: v.cteRecebida?.dataEmissao ?? null,
        observacao: `Frete CT-e ${v.cteRecebida?.chaveNfe?.slice(-8) ?? cteId.slice(0, 8)}…`,
        parcelas,
      })
      if (criado) {
        criados.push({ id: conta.id, codigo: conta.codigo, origem: 'cte' })
      }
    } catch (e) {
      if (e instanceof ErroBaixa) {
        throw new ErroDaAplicacao(e.message, 400)
      }
      throw e
    }
  }

  return criados
}

async function gerarTituloMercadoriaNfe(
  companyId: string,
  notaId: string,
  opcoes?: { exigirVencimento?: boolean }
) {
  const nota = await clientePrisma.nfeRecebida.findFirst({
    where: { id: notaId, companyId },
    select: {
      id: true,
      tipoDocumento: true,
      xmlConteudo: true,
      valorTotal: true,
      dataEmissao: true,
      fornecedorPessoaId: true,
      chaveNfe: true,
      prazoPagamentoXml: true,
      prazoPagamentoTexto: true,
    },
  })
  if (!nota) return null
  if (nota.tipoDocumento && nota.tipoDocumento !== 'nfe55') return null

  const existente = await repositorioDeContasAPagar.buscarPorNfeOrigem(companyId, notaId, 'nfe')
  if (existente) return { conta: existente, criado: false as const }

  const xml = nota.xmlConteudo ? normalizarXmlNfe(nota.xmlConteudo) : ''
  const dupsXml = xml ? extrairDuplicatasCobrancaDoXml(xml) : []
  const valorTotal = decimalNum(nota.valorTotal)
  const montagem = montarParcelasContaPagarDaNfe({
    duplicatasXml: dupsXml,
    valorTotalNf: valorTotal,
    prazoPagamentoXml: nota.prazoPagamentoXml,
    prazoPagamentoTexto: nota.prazoPagamentoTexto,
  })
  if (!montagem.ok) {
    if (opcoes?.exigirVencimento === false) return null
    throw new ErroDaAplicacao(montagem.mensagem, 400)
  }

  const nNF = xml ? extrairCampoXml(xml, 'nNF') : null
  const planoFinanceiroId = await primeiroPlanoLiberadoFornecedor(
    companyId,
    nota.fornecedorPessoaId
  )

  try {
    return await repositorioDeContasAPagar.criarDeEntrada(companyId, {
      origem: 'nfe',
      pessoaId: nota.fornecedorPessoaId,
      planoFinanceiroId,
      nfeRecebidaId: notaId,
      despesaEntradaId: null,
      numeroDocumento: nNF ?? (nota.chaveNfe ? nota.chaveNfe.slice(-9) : null),
      dataEmissao: nota.dataEmissao,
      observacao: 'Gerado automaticamente na Entrada de Notas',
      parcelas: montagem.parcelas,
    })
  } catch (e) {
    if (e instanceof ErroBaixa) {
      throw new ErroDaAplicacao(e.message, 400)
    }
    throw e
  }
}

/**
 * Gera Contas a Pagar da mercadoria (NFe) e promove stubs de frete (CT-e).
 * Idempotente — seguro chamar em Liberar contagem e Consolidar.
 */
export async function gerarTitulosContasPagarDaEntrada(
  companyId: string,
  notaId: string,
  opcoes?: { exigirVencimentoMercadoria?: boolean }
) {
  const criados: Array<{ id: string; codigo: string; origem: string }> = []

  const mercadoria = await gerarTituloMercadoriaNfe(companyId, notaId, {
    exigirVencimento: opcoes?.exigirVencimentoMercadoria !== false,
  })
  if (mercadoria?.criado) {
    criados.push({
      id: mercadoria.conta.id,
      codigo: mercadoria.conta.codigo,
      origem: 'nfe',
    })
  }

  const fretes = await promoverFreteParaContaPagar(companyId, notaId)
  criados.push(...fretes)

  return {
    gerados: criados.length,
    contas: criados,
  }
}
