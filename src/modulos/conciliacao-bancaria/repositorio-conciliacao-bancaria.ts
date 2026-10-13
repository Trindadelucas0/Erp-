import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

export function intervaloDatas(dataDe: string, dataAte: string) {
  const inicio = new Date(dataDe)
  const fim = new Date(dataAte)
  fim.setUTCHours(23, 59, 59, 999)
  return { gte: inicio, lte: fim }
}

async function listarBaixas(
  companyId: string,
  filtro: { contaEmpresaId?: string; dataDe: string; dataAte: string }
) {
  const data = intervaloDatas(filtro.dataDe, filtro.dataAte)
  const conta = filtro.contaEmpresaId ? { contaEmpresaId: filtro.contaEmpresaId } : {}
  const [pagar, receber] = await Promise.all([
    clientePrisma.contaPagarBaixa.findMany({
      where: { companyId, ...conta, pagoEm: data },
      include: {
        parcela: { include: { contaPagar: { include: { pessoa: true } } } },
        contaEmpresa: { select: { id: true, nome: true } },
        conciliacoes: {
          where: { ativo: true },
          select: { conciliacaoId: true },
        },
      },
      orderBy: [{ pagoEm: 'desc' }, { createdAt: 'desc' }],
      take: 1000,
    }),
    clientePrisma.contaReceberBaixa.findMany({
      where: { companyId, ...conta, pagoEm: data },
      include: {
        parcela: { include: { contaReceber: { include: { pessoa: true } } } },
        contaEmpresa: { select: { id: true, nome: true } },
        conciliacoes: {
          where: { ativo: true },
          select: { conciliacaoId: true },
        },
      },
      orderBy: [{ pagoEm: 'desc' }, { createdAt: 'desc' }],
      take: 1000,
    }),
  ])

  return [
    ...pagar.map((item) => ({
      id: item.id,
      origem: 'pagar' as const,
      data: item.pagoEm,
      contaEmpresaId: item.contaEmpresaId,
      contaNome: item.contaEmpresa?.nome ?? 'Sem conta',
      documento: item.parcela.numeroDocumento ?? item.parcela.contaPagar.numeroDocumento,
      descricao:
        item.parcela.contaPagar.pessoa?.nomeFantasia ??
        item.parcela.contaPagar.pessoa?.nome ??
        item.observacao ??
        'Pagamento',
      pessoa: item.parcela.contaPagar.pessoa?.nome ?? null,
      valor: -(
        Number(item.valorPrincipal) +
        Number(item.valorJuros) +
        Number(item.valorMulta) -
        Number(item.valorDesconto)
      ),
      conciliacaoId: item.conciliacoes[0]?.conciliacaoId ?? null,
    })),
    ...receber.map((item) => ({
      id: item.id,
      origem: 'receber' as const,
      data: item.pagoEm,
      contaEmpresaId: item.contaEmpresaId,
      contaNome: item.contaEmpresa?.nome ?? 'Sem conta',
      documento: item.parcela.numeroDocumento ?? item.parcela.contaReceber.numeroDocumento,
      descricao:
        item.parcela.contaReceber.pessoa?.nomeFantasia ??
        item.parcela.contaReceber.pessoa?.nome ??
        item.observacao ??
        'Recebimento',
      pessoa: item.parcela.contaReceber.pessoa?.nome ?? null,
      valor:
        Number(item.valorPrincipal) +
        Number(item.valorJuros) +
        Number(item.valorMulta) -
        Number(item.valorDesconto),
      conciliacaoId: item.conciliacoes[0]?.conciliacaoId ?? null,
    })),
  ].sort((a, b) => b.data.getTime() - a.data.getTime())
}

export const repositorioConciliacaoBancaria = {
  listarBaixas,
}
