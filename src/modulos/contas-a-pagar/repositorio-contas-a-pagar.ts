import { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { FiltroListagemContasPagar } from './esquema-contas-a-pagar.js'

export class ErroBaixa extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErroBaixa'
  }
}

const includeDetalhe = {
  pessoa: { select: { id: true, nome: true, nomeFantasia: true, cnpj: true, cpf: true } },
  planoFinanceiro: { select: { id: true, codigo: true, nome: true } },
  parcelas: { orderBy: { numeroParcela: 'asc' as const } },
} satisfies Prisma.ContaPagarInclude

function decimalParaNumero(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  return Number(v)
}

function formatarCodigoArmazenado(seq: number): string {
  return String(seq)
}

/** Exibe o código no estilo EXITO (ex.: 451.113). */
export function formatarCodigoContaPagar(codigo: string): string {
  const n = Number(codigo.replace(/\D/g, ''))
  if (!Number.isFinite(n) || n <= 0) return codigo
  return n.toLocaleString('pt-BR')
}

export function mapearContaPagar(
  row: Prisma.ContaPagarGetPayload<{ include: typeof includeDetalhe }>
) {
  const parcela = row.parcelas[0] ?? null
  const vencimento = parcela?.vencimento ?? null
  const valorParcela = parcela ? decimalParaNumero(parcela.valor) : decimalParaNumero(row.valorTotal)
  const valorPago = parcela ? decimalParaNumero(parcela.valorPago) : 0
  const saldoDevedor = Math.max(0, Math.round((valorParcela - valorPago) * 100) / 100)

  return {
    id: row.id,
    codigo: row.codigo,
    codigoExibicao: formatarCodigoContaPagar(row.codigo),
    tipo: row.tipo,
    tipoTributo: row.tipoTributo,
    codigoReceita: row.codigoReceita,
    numeroReferencia: row.numeroReferencia,
    pessoaId: row.pessoaId,
    pessoa: row.pessoa
      ? {
          id: row.pessoa.id,
          nome: row.pessoa.nome,
          nomeFantasia: row.pessoa.nomeFantasia,
          documento: row.pessoa.cnpj ?? row.pessoa.cpf ?? null,
        }
      : null,
    planoFinanceiroId: row.planoFinanceiroId,
    planoFinanceiro: row.planoFinanceiro
      ? {
          id: row.planoFinanceiro.id,
          codigo: row.planoFinanceiro.codigo,
          nome: row.planoFinanceiro.nome,
        }
      : null,
    origem: row.origem,
    numeroDocumento: row.numeroDocumento,
    dataEmissao: row.dataEmissao?.toISOString() ?? null,
    dataCadastro: row.createdAt.toISOString(),
    vencimento: vencimento?.toISOString() ?? null,
    status: row.status,
    valorTotal: decimalParaNumero(row.valorTotal),
    valorDesconto: decimalParaNumero(row.valorDesconto),
    valorJuros: decimalParaNumero(row.valorJuros),
    valorMulta: decimalParaNumero(row.valorMulta),
    valorImpostoRetido: decimalParaNumero(row.valorImpostoRetido),
    valorLiquido:
      decimalParaNumero(row.valorTotal) -
      decimalParaNumero(row.valorDesconto) -
      decimalParaNumero(row.valorImpostoRetido),
    saldoDevedor,
    parcelaId: parcela?.id ?? null,
    observacao: row.observacao,
    parcelas: row.parcelas.map((p) => ({
      id: p.id,
      numeroParcela: p.numeroParcela,
      numeroDocumento: p.numeroDocumento,
      vencimento: p.vencimento.toISOString(),
      valor: decimalParaNumero(p.valor),
      valorPago: decimalParaNumero(p.valorPago),
      saldoDevedor: Math.max(
        0,
        Math.round((decimalParaNumero(p.valor) - decimalParaNumero(p.valorPago)) * 100) / 100
      ),
      status: p.status,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function alocarProximoCodigo(
  tx: Prisma.TransactionClient,
  companyId: string
): Promise<string> {
  const row = await tx.contaPagarCodigoSeq.upsert({
    where: { companyId },
    create: { companyId, proximo: 2 },
    update: { proximo: { increment: 1 } },
  })
  return formatarCodigoArmazenado(row.proximo - 1)
}

function montarWhere(
  companyId: string,
  filtro: FiltroListagemContasPagar
): Prisma.ContaPagarWhereInput {
  const where: Prisma.ContaPagarWhereInput = { companyId }

  if (filtro.pessoaId) where.pessoaId = filtro.pessoaId
  if (filtro.planoFinanceiroId) where.planoFinanceiroId = filtro.planoFinanceiroId
  if (filtro.tipo) where.tipo = filtro.tipo
  if (filtro.status) where.status = filtro.status
  if (filtro.codigo) {
    const digits = filtro.codigo.replace(/\D/g, '')
    where.OR = [
      { codigo: { contains: filtro.codigo, mode: 'insensitive' } },
      ...(digits ? [{ codigo: { contains: digits } }] : []),
    ]
  }
  if (filtro.numeroDocumento) {
    where.numeroDocumento = { contains: filtro.numeroDocumento, mode: 'insensitive' }
  }
  if (filtro.valorMin != null || filtro.valorMax != null) {
    where.valorTotal = {}
    if (filtro.valorMin != null) where.valorTotal.gte = filtro.valorMin
    if (filtro.valorMax != null) where.valorTotal.lte = filtro.valorMax
  }

  const vencimentoFiltro: Prisma.DateTimeFilter = {}
  if (filtro.vencimentoDe) {
    const d = new Date(filtro.vencimentoDe)
    if (!Number.isNaN(d.getTime())) vencimentoFiltro.gte = d
  }
  if (filtro.vencimentoAte) {
    const d = new Date(filtro.vencimentoAte)
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999)
      vencimentoFiltro.lte = d
    }
  }
  if (Object.keys(vencimentoFiltro).length > 0) {
    where.parcelas = { some: { vencimento: vencimentoFiltro } }
  }

  if (filtro.q) {
    const q = filtro.q.trim()
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { codigo: { contains: q, mode: 'insensitive' } },
          { numeroDocumento: { contains: q, mode: 'insensitive' } },
          { pessoa: { nome: { contains: q, mode: 'insensitive' } } },
          { pessoa: { nomeFantasia: { contains: q, mode: 'insensitive' } } },
        ],
      },
    ]
  }

  return where
}

export const repositorioDeContasAPagar = {
  async listar(companyId: string, filtro: FiltroListagemContasPagar) {
    const rows = await clientePrisma.contaPagar.findMany({
      where: montarWhere(companyId, filtro),
      include: includeDetalhe,
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
    })
    return rows.map(mapearContaPagar)
  },

  async buscarPorId(companyId: string, id: string) {
    const row = await clientePrisma.contaPagar.findFirst({
      where: { id, companyId },
      include: includeDetalhe,
    })
    return row ? mapearContaPagar(row) : null
  },

  async criar(
    companyId: string,
    dados: {
      tipo: string
      tipoTributo: string | null
      codigoReceita: string | null
      numeroReferencia: string | null
      pessoaId: string | null
      planoFinanceiroId: string | null
      numeroDocumento: string | null
      dataEmissao: Date | null
      valorTotal: number
      valorDesconto: number
      valorJuros: number
      valorMulta: number
      valorImpostoRetido: number
      observacao: string | null
      vencimento: Date
    }
  ) {
    const row = await clientePrisma.$transaction(async (tx) => {
      const codigo = await alocarProximoCodigo(tx, companyId)
      return tx.contaPagar.create({
        data: {
          companyId,
          codigo,
          tipo: dados.tipo,
          tipoTributo: dados.tipoTributo,
          codigoReceita: dados.codigoReceita,
          numeroReferencia: dados.numeroReferencia,
          pessoaId: dados.pessoaId,
          planoFinanceiroId: dados.planoFinanceiroId,
          origem: 'manual',
          numeroDocumento: dados.numeroDocumento,
          dataEmissao: dados.dataEmissao,
          status: 'aberto',
          valorTotal: dados.valorTotal,
          valorDesconto: dados.valorDesconto,
          valorJuros: dados.valorJuros,
          valorMulta: dados.valorMulta,
          valorImpostoRetido: dados.valorImpostoRetido,
          observacao: dados.observacao,
          parcelas: {
            create: [
              {
                numeroParcela: 1,
                numeroDocumento: dados.numeroDocumento,
                vencimento: dados.vencimento,
                valor: dados.valorTotal,
                status: 'aberta',
              },
            ],
          },
        },
        include: includeDetalhe,
      })
    })
    return mapearContaPagar(row)
  },

  async atualizar(
    companyId: string,
    id: string,
    dados: {
      tipo: string
      tipoTributo: string | null
      codigoReceita: string | null
      numeroReferencia: string | null
      pessoaId: string | null
      planoFinanceiroId: string | null
      numeroDocumento: string | null
      dataEmissao: Date | null
      valorTotal: number
      valorDesconto: number
      valorJuros: number
      valorMulta: number
      valorImpostoRetido: number
      observacao: string | null
      vencimento: Date
    }
  ) {
    const row = await clientePrisma.$transaction(async (tx) => {
      const existente = await tx.contaPagar.findFirst({
        where: { id, companyId },
        include: { parcelas: true },
      })
      if (!existente) return null

      await tx.contaPagar.update({
        where: { id },
        data: {
          tipo: dados.tipo,
          tipoTributo: dados.tipoTributo,
          codigoReceita: dados.codigoReceita,
          numeroReferencia: dados.numeroReferencia,
          pessoaId: dados.pessoaId,
          planoFinanceiroId: dados.planoFinanceiroId,
          numeroDocumento: dados.numeroDocumento,
          dataEmissao: dados.dataEmissao,
          valorTotal: dados.valorTotal,
          valorDesconto: dados.valorDesconto,
          valorJuros: dados.valorJuros,
          valorMulta: dados.valorMulta,
          valorImpostoRetido: dados.valorImpostoRetido,
          observacao: dados.observacao,
        },
      })

      const parcela = existente.parcelas.find((p) => p.numeroParcela === 1) ?? existente.parcelas[0]
      if (parcela) {
        await tx.contaPagarParcela.update({
          where: { id: parcela.id },
          data: {
            numeroDocumento: dados.numeroDocumento,
            vencimento: dados.vencimento,
            valor: dados.valorTotal,
          },
        })
      } else {
        await tx.contaPagarParcela.create({
          data: {
            contaPagarId: id,
            numeroParcela: 1,
            numeroDocumento: dados.numeroDocumento,
            vencimento: dados.vencimento,
            valor: dados.valorTotal,
            status: 'aberta',
          },
        })
      }

      return tx.contaPagar.findFirst({
        where: { id, companyId },
        include: includeDetalhe,
      })
    })
    return row ? mapearContaPagar(row) : null
  },

  async buscarParaExcluir(companyId: string, id: string) {
    return clientePrisma.contaPagar.findFirst({
      where: { id, companyId },
      include: {
        parcelas: { include: { baixas: { take: 1, select: { id: true } } } },
      },
    })
  },

  async deletar(id: string) {
    await clientePrisma.contaPagar.delete({ where: { id } })
  },

  async listarParaBaixar(companyId: string, filtro: FiltroListagemContasPagar) {
    const where = montarWhere(companyId, {
      ...filtro,
      status: undefined,
    })
    where.status = { in: ['aberto', 'parcial'] }
    const rows = await clientePrisma.contaPagar.findMany({
      where,
      include: includeDetalhe,
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
    })
    return rows
      .map(mapearContaPagar)
      .filter((c) => (c.saldoDevedor ?? 0) > 0)
  },

  async executarBaixas(
    companyId: string,
    usuarioId: string,
    pagoEm: Date,
    itens: Array<{
      parcelaId: string
      valorPrincipal: number
      valorJuros: number
      valorMulta: number
      valorDesconto: number
      observacao: string | null
    }>
  ) {
    return clientePrisma.$transaction(async (tx) => {
      const resultados: Array<{
        parcelaId: string
        contaPagarId: string
        codigo: string
        baixaId: string
        saldoDevedor: number
        statusParcela: string
        statusConta: string
      }> = []

      for (const item of itens) {
        const parcela = await tx.contaPagarParcela.findFirst({
          where: {
            id: item.parcelaId,
            contaPagar: { companyId },
          },
          include: {
            contaPagar: { select: { id: true, codigo: true, status: true } },
          },
        })
        if (!parcela) {
          throw new ErroBaixa(`Parcela não encontrada: ${item.parcelaId}`)
        }
        if (parcela.status === 'paga' || parcela.status === 'cancelada') {
          throw new ErroBaixa(`Parcela ${parcela.id} não está aberta para baixa`)
        }

        const valor = decimalParaNumero(parcela.valor)
        const pagoAtual = decimalParaNumero(parcela.valorPago)
        const saldo = Math.round((valor - pagoAtual) * 100) / 100
        if (item.valorPrincipal <= 0) {
          throw new ErroBaixa('Valor principal da baixa deve ser maior que zero')
        }
        if (item.valorPrincipal > saldo + 0.009) {
          throw new ErroBaixa(
            `Principal (${item.valorPrincipal}) maior que o saldo (${saldo}) do título ${parcela.contaPagar.codigo}`
          )
        }

        const baixa = await tx.contaPagarBaixa.create({
          data: {
            contaPagarParcelaId: parcela.id,
            companyId,
            pagoEm,
            valorPrincipal: item.valorPrincipal,
            valorJuros: item.valorJuros,
            valorMulta: item.valorMulta,
            valorDesconto: item.valorDesconto,
            usuarioId,
            observacao: item.observacao,
          },
        })

        const novoPago = Math.round((pagoAtual + item.valorPrincipal) * 100) / 100
        const novoSaldo = Math.max(0, Math.round((valor - novoPago) * 100) / 100)
        const statusParcela = novoSaldo <= 0.009 ? 'paga' : 'parcial'

        await tx.contaPagarParcela.update({
          where: { id: parcela.id },
          data: {
            valorPago: novoPago,
            status: statusParcela,
            pagoEm: statusParcela === 'paga' ? pagoEm : parcela.pagoEm,
          },
        })

        const todas = await tx.contaPagarParcela.findMany({
          where: { contaPagarId: parcela.contaPagarId },
          select: { status: true },
        })
        const todasPagas = todas.every((p) => p.status === 'paga')
        const algumaMovida = todas.some((p) => p.status === 'parcial' || p.status === 'paga')
        const statusConta = todasPagas ? 'pago' : algumaMovida ? 'parcial' : 'aberto'

        await tx.contaPagar.update({
          where: { id: parcela.contaPagarId },
          data: { status: statusConta },
        })

        resultados.push({
          parcelaId: parcela.id,
          contaPagarId: parcela.contaPagarId,
          codigo: parcela.contaPagar.codigo,
          baixaId: baixa.id,
          saldoDevedor: novoSaldo <= 0.009 ? 0 : novoSaldo,
          statusParcela,
          statusConta,
        })
      }

      return resultados
    })
  },
}
