import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

function decimalNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  return Number(v)
}

export type ItemCfopEntradaPrevalencia = {
  cfopEntradaId: string | null
  valorTotal: unknown
  quantidade: unknown
  nItem: number
}

type GrupoCfopPrevalente = {
  cfopEntradaId: string
  somaValorTotal: number
  somaQuantidade: number
  menorNItem: number
}

/** CFOP de entrada com maior soma de valorTotal nos itens (desempate: quantidade, depois menor nItem). */
export function cfopEntradaPrevalenteDosItens(
  itens: ItemCfopEntradaPrevalencia[]
): string | null {
  const grupos = new Map<string, GrupoCfopPrevalente>()

  for (const item of itens) {
    if (!item.cfopEntradaId) continue
    const valor = decimalNum(item.valorTotal)
    const qtd = decimalNum(item.quantidade)
    const existente = grupos.get(item.cfopEntradaId)
    if (existente) {
      existente.somaValorTotal += valor
      existente.somaQuantidade += qtd
      existente.menorNItem = Math.min(existente.menorNItem, item.nItem)
    } else {
      grupos.set(item.cfopEntradaId, {
        cfopEntradaId: item.cfopEntradaId,
        somaValorTotal: valor,
        somaQuantidade: qtd,
        menorNItem: item.nItem,
      })
    }
  }

  if (grupos.size === 0) return null

  const ordenados = [...grupos.values()].sort((a, b) => {
    if (b.somaValorTotal !== a.somaValorTotal) return b.somaValorTotal - a.somaValorTotal
    if (b.somaQuantidade !== a.somaQuantidade) return b.somaQuantidade - a.somaQuantidade
    return a.menorNItem - b.menorNItem
  })

  return ordenados[0]?.cfopEntradaId ?? null
}

export async function primeiroPlanoLiberadoFornecedor(
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

async function planoPadraoDoCfop(
  companyId: string,
  cfopEntradaId: string
): Promise<string | null> {
  const cfop = await clientePrisma.cfop.findFirst({
    where: { id: cfopEntradaId, companyId, ativo: true },
    select: {
      planoFinanceiroPadraoId: true,
      planoFinanceiroPadrao: {
        select: { id: true, ativo: true },
      },
    },
  })
  if (!cfop?.planoFinanceiroPadraoId) return null
  if (!cfop.planoFinanceiroPadrao?.ativo) return null
  return cfop.planoFinanceiroPadraoId
}

async function planoDoParFornecedorCfop(
  companyId: string,
  fornecedorPessoaId: string | null,
  cfopEntradaId: string
): Promise<string | null> {
  if (!fornecedorPessoaId) return null
  const papel = await clientePrisma.pessoaPapel.findFirst({
    where: { pessoaId: fornecedorPessoaId, papel: 'fornecedor', ativo: true, pessoa: { companyId } },
    select: {
      dadosFornecedor: {
        select: {
          paresPlanoCfopPadrao: {
            where: { cfopId: cfopEntradaId },
            orderBy: { ordem: 'asc' },
            take: 1,
            select: { planoFinanceiroId: true },
          },
        },
      },
    },
  })
  return papel?.dadosFornecedor?.paresPlanoCfopPadrao?.[0]?.planoFinanceiroId ?? null
}

/**
 * Resolve o plano financeiro do título de mercadoria (NFe) na Entrada:
 * CFOP prevalente → plano padrão do CFOP → par fornecedor+CFOP → primeiro plano do fornecedor.
 */
export async function resolverPlanoFinanceiroMercadoriaNfe(
  companyId: string,
  params: { notaId: string; fornecedorPessoaId: string | null }
): Promise<string | null> {
  const itens = await clientePrisma.nfeRecebidaItem.findMany({
    where: { nfeRecebidaId: params.notaId, nfeRecebida: { companyId } },
    select: {
      cfopEntradaId: true,
      valorTotal: true,
      quantidade: true,
      nItem: true,
    },
  })

  const cfopPrevalente = cfopEntradaPrevalenteDosItens(itens)
  if (cfopPrevalente) {
    const planoCfop = await planoPadraoDoCfop(companyId, cfopPrevalente)
    if (planoCfop) return planoCfop

    const planoPar = await planoDoParFornecedorCfop(
      companyId,
      params.fornecedorPessoaId,
      cfopPrevalente
    )
    if (planoPar) return planoPar
  }

  return primeiroPlanoLiberadoFornecedor(companyId, params.fornecedorPessoaId)
}
