import { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { FiltroListagemContasReceber } from './esquema-contas-a-receber.js'

export class ErroBaixa extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErroBaixa'
  }
}

const includeDetalhe = {
  pessoa: { select: { id: true, nome: true, nomeFantasia: true, cnpj: true, cpf: true } },
  planoFinanceiro: { select: { id: true, codigo: true, nome: true } },
  parcelas: {
    orderBy: { numeroParcela: 'asc' as const },
    include: {
      baixas: {
        orderBy: { pagoEm: 'desc' as const },
        include: {
          usuario: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.ContaReceberInclude

function decimalParaNumero(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  return Number(v)
}

function formatarCodigoArmazenado(seq: number): string {
  return String(seq)
}

/** Exibe o código no estilo EXITO (ex.: 451.113). */
export function formatarCodigoContaReceber(codigo: string): string {
  const n = Number(codigo.replace(/\D/g, ''))
  if (!Number.isFinite(n) || n <= 0) return codigo
  return n.toLocaleString('pt-BR')
}

function mapearBaixa(
  b: {
    id: string
    pagoEm: Date
    valorPrincipal: Prisma.Decimal | number
    valorJuros: Prisma.Decimal | number
    valorMulta: Prisma.Decimal | number
    valorDesconto: Prisma.Decimal | number
    observacao: string | null
    createdAt: Date
    usuario?: { id: string; name: string } | null
  }
) {
  const principal = decimalParaNumero(b.valorPrincipal)
  const juros = decimalParaNumero(b.valorJuros)
  const multa = decimalParaNumero(b.valorMulta)
  const desconto = decimalParaNumero(b.valorDesconto)
  return {
    id: b.id,
    pagoEm: b.pagoEm.toISOString(),
    valorPrincipal: principal,
    valorJuros: juros,
    valorMulta: multa,
    valorDesconto: desconto,
    valorTotalPago: Math.round((principal + juros + multa - desconto) * 100) / 100,
    observacao: b.observacao,
    createdAt: b.createdAt.toISOString(),
    usuario: b.usuario ? { id: b.usuario.id, name: b.usuario.name } : null,
  }
}

export function mapearContaReceber(
  row: Prisma.ContaReceberGetPayload<{ include: typeof includeDetalhe }>
) {
  const parcela = row.parcelas[0] ?? null
  const vencimento = parcela?.vencimento ?? null
  const parcelas = row.parcelas.map((p) => {
    const valor = decimalParaNumero(p.valor)
    const valorPago = decimalParaNumero(p.valorPago)
    const baixas = (p.baixas ?? []).map(mapearBaixa)
    return {
      id: p.id,
      numeroParcela: p.numeroParcela,
      numeroDocumento: p.numeroDocumento,
      vencimento: p.vencimento.toISOString(),
      valor,
      valorPago,
      saldoDevedor: Math.max(0, Math.round((valor - valorPago) * 100) / 100),
      status: p.status,
      baixas,
    }
  })
  const saldoDevedor = Math.max(
    0,
    Math.round(parcelas.reduce((acc, p) => acc + p.saldoDevedor, 0) * 100) / 100
  )
  const valorPagoPrincipal = Math.round(
    parcelas.reduce((acc, p) => acc + p.valorPago, 0) * 100
  ) / 100
  const todasBaixas = parcelas.flatMap((p) =>
    p.baixas.map((b) => ({ ...b, numeroParcela: p.numeroParcela, parcelaId: p.id }))
  )
  const totalJurosBaixas =
    Math.round(todasBaixas.reduce((acc, b) => acc + b.valorJuros, 0) * 100) / 100
  const totalMultaBaixas =
    Math.round(todasBaixas.reduce((acc, b) => acc + b.valorMulta, 0) * 100) / 100

  return {
    id: row.id,
    codigo: row.codigo,
    codigoExibicao: formatarCodigoContaReceber(row.codigo),
    tipo: row.tipo,
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
    valorComissao: decimalParaNumero(row.valorComissao),
    valorLiquido:
      decimalParaNumero(row.valorTotal) - decimalParaNumero(row.valorDesconto),
    saldoDevedor,
    valorPagoPrincipal,
    totalJurosBaixas,
    totalMultaBaixas,
    parcelaId: parcela?.id ?? null,
    observacao: row.observacao,
    parcelas,
    baixas: todasBaixas.sort(
      (a, b) => new Date(b.pagoEm).getTime() - new Date(a.pagoEm).getTime()
    ),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Reserva o próximo código fora da transação de create (evita lock longo no
 * ContaReceberCodigoSeq + timeout interativo padrão de 5s).
 */
async function alocarProximoCodigo(companyId: string): Promise<string> {
  const row = await clientePrisma.contaReceberCodigoSeq.upsert({
    where: { companyId },
    create: { companyId, proximo: 2 },
    update: { proximo: { increment: 1 } },
  })
  return formatarCodigoArmazenado(row.proximo - 1)
}

const OPCOES_TX_CONTA_RECEBER = { maxWait: 15_000, timeout: 20_000 } as const

function montarWhere(
  companyId: string,
  filtro: FiltroListagemContasReceber
): Prisma.ContaReceberWhereInput {
  const where: Prisma.ContaReceberWhereInput = { companyId }

  if (filtro.pessoaId) where.pessoaId = filtro.pessoaId
  if (filtro.planoFinanceiroId) where.planoFinanceiroId = filtro.planoFinanceiroId
  if (filtro.tipo) where.tipo = filtro.tipo
  if (filtro.origem) where.origem = filtro.origem
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

export const repositorioDeContasAReceber = {
  async listar(companyId: string, filtro: FiltroListagemContasReceber) {
    const rows = await clientePrisma.contaReceber.findMany({
      where: montarWhere(companyId, filtro),
      include: includeDetalhe,
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
    })
    return rows.map(mapearContaReceber)
  },

  async buscarPorId(companyId: string, id: string) {
    const row = await clientePrisma.contaReceber.findFirst({
      where: { id, companyId },
      include: {
        ...includeDetalhe,
        anexos: {
          orderBy: { createdAt: 'desc' },
          include: { usuario: { select: { id: true, name: true } } },
        },
      },
    })
    if (!row) return null
    const mapped = mapearContaReceber(row)
    return {
      ...mapped,
      anexos: (row.anexos ?? []).map((a) => ({
        id: a.id,
        nomeArquivo: a.nomeArquivo,
        mimeType: a.mimeType,
        tamanhoBytes: a.tamanhoBytes,
        createdAt: a.createdAt.toISOString(),
        usuario: a.usuario ? { id: a.usuario.id, name: a.usuario.name } : null,
      })),
    }
  },

  async listarAnexos(companyId: string, contaReceberId: string) {
    const conta = await clientePrisma.contaReceber.findFirst({
      where: { id: contaReceberId, companyId },
      select: { id: true },
    })
    if (!conta) return null
    const rows = await clientePrisma.contaReceberAnexo.findMany({
      where: { contaReceberId, companyId },
      orderBy: { createdAt: 'desc' },
      include: { usuario: { select: { id: true, name: true } } },
    })
    return rows.map((a) => ({
      id: a.id,
      nomeArquivo: a.nomeArquivo,
      mimeType: a.mimeType,
      tamanhoBytes: a.tamanhoBytes,
      createdAt: a.createdAt.toISOString(),
      usuario: a.usuario ? { id: a.usuario.id, name: a.usuario.name } : null,
    }))
  },

  async criarAnexo(
    companyId: string,
    contaReceberId: string,
    dados: {
      nomeArquivo: string
      mimeType: string
      caminhoArquivo: string
      tamanhoBytes: number
      usuarioId: string | null
    }
  ) {
    const row = await clientePrisma.contaReceberAnexo.create({
      data: {
        companyId,
        contaReceberId,
        nomeArquivo: dados.nomeArquivo,
        mimeType: dados.mimeType,
        caminhoArquivo: dados.caminhoArquivo,
        tamanhoBytes: dados.tamanhoBytes,
        usuarioId: dados.usuarioId,
      },
      include: { usuario: { select: { id: true, name: true } } },
    })
    return {
      id: row.id,
      nomeArquivo: row.nomeArquivo,
      mimeType: row.mimeType,
      tamanhoBytes: row.tamanhoBytes,
      createdAt: row.createdAt.toISOString(),
      usuario: row.usuario ? { id: row.usuario.id, name: row.usuario.name } : null,
    }
  },

  async buscarAnexo(companyId: string, contaReceberId: string, anexoId: string) {
    return clientePrisma.contaReceberAnexo.findFirst({
      where: { id: anexoId, contaReceberId, companyId },
    })
  },

  async deletarAnexo(anexoId: string) {
    await clientePrisma.contaReceberAnexo.delete({ where: { id: anexoId } })
  },

  async criar(
    companyId: string,
    dados: {
      tipo: string
      pessoaId: string | null
      planoFinanceiroId: string | null
      numeroDocumento: string | null
      dataEmissao: Date | null
      valorTotal: number
      valorDesconto: number
      valorJuros: number
      valorMulta: number
      valorComissao: number
      observacao: string | null
      vencimento: Date
    }
  ) {
    const codigo = await alocarProximoCodigo(companyId)
    const row = await clientePrisma.$transaction(async (tx) => {
      return tx.contaReceber.create({
        data: {
          companyId,
          codigo,
          tipo: dados.tipo,
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
          valorComissao: dados.valorComissao,
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
    }, OPCOES_TX_CONTA_RECEBER)
    return mapearContaReceber(row)
  },

  async atualizar(
    companyId: string,
    id: string,
    dados: {
      tipo: string
      pessoaId: string | null
      planoFinanceiroId: string | null
      numeroDocumento: string | null
      dataEmissao: Date | null
      valorTotal: number
      valorDesconto: number
      valorJuros: number
      valorMulta: number
      valorComissao: number
      observacao: string | null
      vencimento: Date
    }
  ) {
    const row = await clientePrisma.$transaction(async (tx) => {
      const existente = await tx.contaReceber.findFirst({
        where: { id, companyId },
        include: { parcelas: true },
      })
      if (!existente) return null

      await tx.contaReceber.update({
        where: { id },
        data: {
          tipo: dados.tipo,
          pessoaId: dados.pessoaId,
          planoFinanceiroId: dados.planoFinanceiroId,
          numeroDocumento: dados.numeroDocumento,
          dataEmissao: dados.dataEmissao,
          valorTotal: dados.valorTotal,
          valorDesconto: dados.valorDesconto,
          valorJuros: dados.valorJuros,
          valorMulta: dados.valorMulta,
          valorComissao: dados.valorComissao,
          observacao: dados.observacao,
        },
      })

      const parcela = existente.parcelas.find((p) => p.numeroParcela === 1) ?? existente.parcelas[0]
      if (parcela) {
        await tx.contaReceberParcela.update({
          where: { id: parcela.id },
          data: {
            numeroDocumento: dados.numeroDocumento,
            vencimento: dados.vencimento,
            valor: dados.valorTotal,
          },
        })
      } else {
        await tx.contaReceberParcela.create({
          data: {
            contaReceberId: id,
            numeroParcela: 1,
            numeroDocumento: dados.numeroDocumento,
            vencimento: dados.vencimento,
            valor: dados.valorTotal,
            status: 'aberta',
          },
        })
      }

      return tx.contaReceber.findFirst({
        where: { id, companyId },
        include: includeDetalhe,
      })
    })
    return row ? mapearContaReceber(row) : null
  },

  async buscarParaExcluir(companyId: string, id: string) {
    return clientePrisma.contaReceber.findFirst({
      where: { id, companyId },
      include: {
        parcelas: { include: { baixas: { take: 1, select: { id: true } } } },
      },
    })
  },

  async deletar(id: string) {
    await clientePrisma.contaReceber.delete({ where: { id } })
  },

  async listarParaBaixar(companyId: string, filtro: FiltroListagemContasReceber) {
    const where = montarWhere(companyId, {
      ...filtro,
      status: undefined,
    })
    where.status = { in: ['aberto', 'parcial'] }
    const rows = await clientePrisma.contaReceber.findMany({
      where,
      include: includeDetalhe,
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
    })
    const saida: ReturnType<typeof mapearContaReceber>[] = []
    for (const row of rows) {
      const mapped = mapearContaReceber(row)
      for (const p of mapped.parcelas) {
        if (p.status === 'paga' || p.status === 'cancelada') continue
        if (p.saldoDevedor <= 0) continue
        saida.push({
          ...mapped,
          parcelaId: p.id,
          vencimento: p.vencimento,
          saldoDevedor: p.saldoDevedor,
          numeroDocumento: p.numeroDocumento ?? mapped.numeroDocumento,
        })
      }
    }
    return saida
  },

  async listarHistoricoBaixas(
    companyId: string,
    filtro: {
      pessoaId?: string
      contaReceberId?: string
      pagoEmDe?: string
      pagoEmAte?: string
      q?: string
    }
  ) {
    const where: Prisma.ContaReceberBaixaWhereInput = { companyId }
    const pagoEm: Prisma.DateTimeFilter = {}
    if (filtro.pagoEmDe) {
      const d = new Date(filtro.pagoEmDe)
      if (!Number.isNaN(d.getTime())) pagoEm.gte = d
    }
    if (filtro.pagoEmAte) {
      const d = new Date(filtro.pagoEmAte)
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999)
        pagoEm.lte = d
      }
    }
    if (Object.keys(pagoEm).length > 0) where.pagoEm = pagoEm

    const parcelaWhere: Prisma.ContaReceberParcelaWhereInput = {}
    const contaWhere: Prisma.ContaReceberWhereInput = { companyId }
    if (filtro.contaReceberId) contaWhere.id = filtro.contaReceberId
    if (filtro.pessoaId) contaWhere.pessoaId = filtro.pessoaId
    if (filtro.q?.trim()) {
      const q = filtro.q.trim()
      contaWhere.OR = [
        { codigo: { contains: q, mode: 'insensitive' } },
        { numeroDocumento: { contains: q, mode: 'insensitive' } },
        { pessoa: { nome: { contains: q, mode: 'insensitive' } } },
      ]
    }
    parcelaWhere.contaReceber = contaWhere
    where.parcela = parcelaWhere

    const rows = await clientePrisma.contaReceberBaixa.findMany({
      where,
      include: {
        usuario: { select: { id: true, name: true } },
        parcela: {
          include: {
            contaReceber: {
              include: includeDetalhe,
            },
          },
        },
      },
      orderBy: [{ pagoEm: 'desc' }, { createdAt: 'desc' }],
      take: 300,
    })

    return rows.map((b) => {
      const conta = mapearContaReceber(b.parcela.contaReceber)
      const baixa = mapearBaixa(b)
      return {
        ...baixa,
        parcelaId: b.parcela.id,
        numeroParcela: b.parcela.numeroParcela,
        contaReceberId: conta.id,
        codigo: conta.codigo,
        codigoExibicao: conta.codigoExibicao,
        numeroDocumento: conta.numeroDocumento,
        pessoa: conta.pessoa,
        origem: conta.origem,
        statusConta: conta.status,
        valorTotalTitulo: conta.valorTotal,
        valorPagoPrincipalTitulo: conta.valorPagoPrincipal,
        saldoDevedorTitulo: conta.saldoDevedor,
        totalJurosBaixas: conta.totalJurosBaixas,
        totalMultaBaixas: conta.totalMultaBaixas,
      }
    })
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
        contaReceberId: string
        codigo: string
        baixaId: string
        saldoDevedor: number
        statusParcela: string
        statusConta: string
      }> = []

      for (const item of itens) {
        const parcela = await tx.contaReceberParcela.findFirst({
          where: {
            id: item.parcelaId,
            contaReceber: { companyId },
          },
          include: {
            contaReceber: { select: { id: true, codigo: true, status: true } },
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
            `Principal (${item.valorPrincipal}) maior que o saldo (${saldo}) do título ${parcela.contaReceber.codigo}`
          )
        }

        const baixa = await tx.contaReceberBaixa.create({
          data: {
            contaReceberParcelaId: parcela.id,
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

        await tx.contaReceberParcela.update({
          where: { id: parcela.id },
          data: {
            valorPago: novoPago,
            status: statusParcela,
            pagoEm: statusParcela === 'paga' ? pagoEm : parcela.pagoEm,
          },
        })

        const todas = await tx.contaReceberParcela.findMany({
          where: { contaReceberId: parcela.contaReceberId },
          select: { status: true },
        })
        const todasPagas = todas.every((p) => p.status === 'paga')
        const algumaMovida = todas.some((p) => p.status === 'parcial' || p.status === 'paga')
        const statusConta = todasPagas ? 'pago' : algumaMovida ? 'parcial' : 'aberto'

        await tx.contaReceber.update({
          where: { id: parcela.contaReceberId },
          data: { status: statusConta },
        })

        resultados.push({
          parcelaId: parcela.id,
          contaReceberId: parcela.contaReceberId,
          codigo: parcela.contaReceber.codigo,
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
