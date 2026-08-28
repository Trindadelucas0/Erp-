/**
 * Monta prévia financeira e resumo de pedido para o dossiê documental (NFS-e / custo / consumo).
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { resolverPlanoFinanceiroEntrada } from '../contas-a-pagar/resolver-plano-financeiro-entrada.js'
import { resolverParcelasRecorrencia } from '../contas-a-pagar/resolver-parcelas-recorrencia.js'
import { repositorioEntradaNotas } from './repositorio-entrada-notas.js'

const TOLERANCIA_VALOR = 0.01

function decimalNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  return Number(v)
}

function formatarDataIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null
  const d = v instanceof Date ? v : new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

export type LinhaResumoPedido = {
  pedidoNumero: string
  item: string
  esperado: number
  nota: number
  divergencia: string
  situacao: 'ok' | 'divergente' | 'aviso'
}

export type ResumoPedidoCompraDocumental = {
  vinculado: boolean
  semPedidoInformado: boolean
  pedido?: { id: string; numero: number }
  linhas: LinhaResumoPedido[]
}

export type PreviaFinanceiraDocumental = {
  parcelas: Array<{
    numero: number
    numeroDocumento: string | null
    vencimento: string | null
    valor: number
    planoFinanceiro: { id: string; codigo: string; nome: string } | null
    tipo: string
    status: 'a_gerar' | 'gerado'
  }>
  total: number
  origemPlano: 'nota' | 'fornecedor' | 'recorrencia' | 'cfop' | null
  planoFinanceiroId: string | null
  planoFinanceiro: { id: string; codigo: string; nome: string } | null
  completo: boolean
  bloqueios: string[]
}

function parcelasGravadasNaNota(nota: {
  valorTotal: unknown
  parcelasFinanceiras: unknown
}): Array<{ numeroDocumento: string | null; vencimento: string | null; valor: number }> {
  if (Array.isArray(nota.parcelasFinanceiras) && nota.parcelasFinanceiras.length > 0) {
    return (nota.parcelasFinanceiras as Array<{
      numeroDocumento?: string | null
      vencimento?: string | null
      valor?: number | null
    }>).map((p) => ({
      numeroDocumento: p.numeroDocumento ?? null,
      vencimento: p.vencimento ?? null,
      valor: decimalNum(p.valor),
    }))
  }
  const valor = decimalNum(nota.valorTotal)
  return [{ numeroDocumento: null, vencimento: null, valor }]
}

function financeiroCompleto(nota: {
  planoFinanceiroId: string | null
  valorTotal: unknown
  parcelasFinanceiras: unknown
}): boolean {
  if (!nota.planoFinanceiroId) return false
  const parcelas = parcelasGravadasNaNota(nota)
  return parcelas.every((p) => Boolean(p.vencimento?.trim()) && p.valor > 0)
}

export async function montarResumoPedidoCompraDocumental(
  companyId: string,
  nota: {
    pedidoCompraId: string | null
    valorTotal: unknown
  }
): Promise<ResumoPedidoCompraDocumental> {
  if (!nota.pedidoCompraId) {
    return {
      vinculado: false,
      semPedidoInformado: true,
      linhas: [],
    }
  }

  const pedido = await repositorioEntradaNotas.buscarPedidoComItens(
    companyId,
    nota.pedidoCompraId
  )
  if (!pedido) {
    return {
      vinculado: false,
      semPedidoInformado: true,
      linhas: [],
    }
  }

  const valorNota = decimalNum(nota.valorTotal)
  const pedidoNumero = `PC-${String(pedido.numero).padStart(6, '0')}`

  if (pedido.itens.length === 0) {
    const divergencia =
      Math.abs(valorNota) < TOLERANCIA_VALOR
        ? '—'
        : formatarDivergenciaMoeda(valorNota, 0)
    return {
      vinculado: true,
      semPedidoInformado: false,
      pedido: { id: pedido.id, numero: pedido.numero },
      linhas: [
        {
          pedidoNumero,
          item: 'Serviço',
          esperado: 0,
          nota: valorNota,
          divergencia,
          situacao: Math.abs(valorNota) <= TOLERANCIA_VALOR ? 'ok' : 'divergente',
        },
      ],
    }
  }

  const linhas: LinhaResumoPedido[] = pedido.itens.map((item) => {
    const esperado = decimalNum(item.quantidade) * decimalNum(item.precoUnitario)
    const nome = item.produto?.nomeVenda?.trim() || 'Item do pedido'
    const divergencia = formatarDivergenciaMoeda(valorNota, esperado)
    const ok = Math.abs(valorNota - esperado) <= TOLERANCIA_VALOR
    return {
      pedidoNumero,
      item: nome,
      esperado,
      nota: valorNota,
      divergencia: ok ? '—' : divergencia,
      situacao: ok ? 'ok' : 'divergente',
    }
  })

  // NFS-e sem itens: uma linha agregada quando há vários itens no pedido
  if (linhas.length > 1) {
    const somaEsperada = linhas.reduce((s, l) => s + l.esperado, 0)
    const ok = Math.abs(valorNota - somaEsperada) <= TOLERANCIA_VALOR
    return {
      vinculado: true,
      semPedidoInformado: false,
      pedido: { id: pedido.id, numero: pedido.numero },
      linhas: [
        {
          pedidoNumero,
          item: 'Serviço (total do pedido)',
          esperado: somaEsperada,
          nota: valorNota,
          divergencia: ok ? '—' : formatarDivergenciaMoeda(valorNota, somaEsperada),
          situacao: ok ? 'ok' : 'divergente',
        },
      ],
    }
  }

  return {
    vinculado: true,
    semPedidoInformado: false,
    pedido: { id: pedido.id, numero: pedido.numero },
    linhas,
  }
}

function formatarDivergenciaMoeda(nota: number, esperado: number): string {
  const delta = nota - esperado
  if (Math.abs(delta) <= TOLERANCIA_VALOR) return '—'
  const sinal = delta > 0 ? '+' : ''
  return `${sinal}${delta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
}

export async function montarPreviaFinanceiraDocumental(
  companyId: string,
  nota: {
    id: string
    tipoDocumento: string | null
    valorTotal: unknown
    fornecedorPessoaId: string | null
    cfopEntradaId: string | null
    planoFinanceiroId: string | null
    parcelasFinanceiras: unknown
    xmlConteudo: string | null
    prazoPagamentoXml: string | null
    prazoPagamentoTexto: string | null
    dataEmissao: Date | null
    recorrenciaFinanceiraId: string | null
    planoFinanceiro?: { id: string; codigo: string; nome: string } | null
  },
  opcoes?: { titulosGerados?: boolean }
): Promise<PreviaFinanceiraDocumental> {
  const bloqueios: string[] = []
  const total = decimalNum(nota.valorTotal)
  const titulosGerados = opcoes?.titulosGerados === true

  let origemPlano: PreviaFinanceiraDocumental['origemPlano'] = null
  let planoId = nota.planoFinanceiroId
  let planoObj = nota.planoFinanceiro ?? null

  if (planoId) {
    origemPlano = 'nota'
    if (!planoObj) {
      planoObj = await clientePrisma.planoFinanceiro.findFirst({
        where: { id: planoId, companyId, ativo: true },
        select: { id: true, codigo: true, nome: true },
      })
    }
  } else {
    const sugerido = await resolverPlanoFinanceiroEntrada(companyId, {
      notaId: nota.id,
      fornecedorPessoaId: nota.fornecedorPessoaId,
      cfopEntradaId: nota.cfopEntradaId,
      planoGravadoNaNota: null,
    })
    if (sugerido) {
      planoId = sugerido
      origemPlano = nota.recorrenciaFinanceiraId ? 'recorrencia' : 'fornecedor'
      planoObj = await clientePrisma.planoFinanceiro.findFirst({
        where: { id: sugerido, companyId, ativo: true },
        select: { id: true, codigo: true, nome: true },
      })
    }
  }

  if (!planoId) {
    bloqueios.push('Informe o plano financeiro antes de consolidar.')
  }

  let parcelasRaw = parcelasGravadasNaNota(nota)

  const temVencimentoGravado = parcelasRaw.some((p) => Boolean(p.vencimento?.trim()))
  if (
    !temVencimentoGravado &&
    nota.recorrenciaFinanceiraId &&
    nota.fornecedorPessoaId &&
    total > 0
  ) {
    const montagem = await resolverParcelasRecorrencia({
      companyId,
      fornecedorPessoaId: nota.fornecedorPessoaId,
      valorTotal: total,
      dataEmissao: nota.dataEmissao,
      xmlConteudo: nota.xmlConteudo,
      prazoPagamentoXml: nota.prazoPagamentoXml,
      prazoPagamentoTexto: nota.prazoPagamentoTexto,
      recorrenciaFinanceiraId: nota.recorrenciaFinanceiraId,
    })
    if (montagem.ok) {
      parcelasRaw = montagem.parcelas.map((p) => ({
        numeroDocumento: p.numeroDocumento,
        vencimento: formatarDataIso(p.vencimento),
        valor: p.valor,
      }))
      if (!origemPlano) origemPlano = 'recorrencia'
    }
  }

  if (!parcelasRaw.every((p) => Boolean(p.vencimento?.trim()))) {
    bloqueios.push('Informe a data de vencimento de cada parcela na prévia financeira.')
  }
  if (!parcelasRaw.every((p) => p.valor > 0)) {
    bloqueios.push('Informe o valor de cada parcela na prévia financeira.')
  }

  const completo = financeiroCompleto({
    planoFinanceiroId: planoId,
    valorTotal: nota.valorTotal,
    parcelasFinanceiras: temVencimentoGravado ? nota.parcelasFinanceiras : parcelasRaw,
  })

  const parcelas = parcelasRaw.map((p, i) => ({
    numero: i + 1,
    numeroDocumento: p.numeroDocumento,
    vencimento: p.vencimento,
    valor: p.valor,
    planoFinanceiro: planoObj,
    tipo: 'Duplicata',
    status: titulosGerados ? ('gerado' as const) : ('a_gerar' as const),
  }))

  return {
    parcelas,
    total,
    origemPlano,
    planoFinanceiroId: planoId,
    planoFinanceiro: planoObj,
    completo,
    bloqueios: [...new Set(bloqueios)],
  }
}
