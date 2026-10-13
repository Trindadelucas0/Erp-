import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeContasAPagar } from '../contas-a-pagar/servico-contas-a-pagar.js'
import { servicoDeContasAReceber } from '../contas-a-receber/servico-contas-a-receber.js'
import type {
  ConcluirConciliacao,
  ConsultaConciliacao,
  ConsultaMovimentos,
  CriarLancamentoConciliacao,
  UploadExtrato,
} from './esquema-conciliacao-bancaria.js'
import { MODELO_CSV_EXTRATO, parsearPlanilhaExtrato } from './parser-planilha-extrato.js'
import { parsearOfx, type LinhaExtratoImportada } from './parser-ofx.js'
import {
  intervaloDatas,
  repositorioConciliacaoBancaria,
} from './repositorio-conciliacao-bancaria.js'

type BaixaConsulta = Awaited<
  ReturnType<typeof repositorioConciliacaoBancaria.listarBaixas>
>[number]

function centavos(valor: number): number {
  return Math.round(valor * 100)
}

function mesmoDia(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10)
}

export function sugerirCorrespondencias<
  L extends { id: string; data: Date; valor: number; documento: string | null; historico: string },
  B extends { id: string; data: Date; valor: number; documento: string | null; conciliacaoId: string | null },
>(linhas: L[], baixas: B[]) {
  const sugestoes: Array<{ linhaId: string; baixaId: string }> = []
  for (const linha of linhas) {
    let candidatas = baixas.filter(
      (baixa) =>
        !baixa.conciliacaoId &&
        centavos(baixa.valor) === centavos(linha.valor) &&
        mesmoDia(baixa.data, linha.data)
    )
    if (candidatas.length > 1 && linha.documento) {
      const documento = linha.documento.toLowerCase()
      candidatas = candidatas.filter(
        (baixa) =>
          baixa.documento?.toLowerCase() === documento ||
          linha.historico.toLowerCase().includes(baixa.documento?.toLowerCase() ?? '\u0000')
      )
    }
    if (candidatas.length === 1) {
      sugestoes.push({ linhaId: linha.id, baixaId: candidatas[0].id })
    }
  }
  return sugestoes
}

async function exigirContaBancaria(companyId: string, contaEmpresaId: string) {
  const conta = await clientePrisma.contaEmpresa.findFirst({
    where: { id: contaEmpresaId, companyId, ativo: true, tipo: 'bancaria' },
    select: { id: true, nome: true },
  })
  if (!conta) throw new ErroDaAplicacao('Conta bancária ativa não encontrada', 404)
  return conta
}

function chaveLinha(contaEmpresaId: string, linha: LinhaExtratoImportada) {
  if (linha.identificador) return `fitid:${linha.identificador}`
  return createHash('sha256')
    .update(
      [
        contaEmpresaId,
        linha.data.toISOString().slice(0, 10),
        centavos(linha.valor),
        linha.documento ?? '',
        linha.historico.trim().toLowerCase(),
      ].join('|')
    )
    .digest('hex')
}

async function importarExtrato(
  companyId: string,
  usuarioId: string,
  dados: UploadExtrato
) {
  await exigirContaBancaria(companyId, dados.contaEmpresaId)
  const buffer = Buffer.from(dados.base64Arquivo, 'base64')
  if (buffer.length > 5 * 1024 * 1024) {
    throw new ErroDaAplicacao('Arquivo não pode ser superior a 5 MB', 400)
  }

  let origem: 'ofx' | 'csv' | 'excel'
  let resultado: { linhas: LinhaExtratoImportada[]; invalidas: number }
  try {
    if (dados.mimeType.includes('ofx')) {
      origem = 'ofx'
      resultado = parsearOfx(buffer)
    } else if (dados.mimeType === 'text/csv') {
      origem = 'csv'
      resultado = await parsearPlanilhaExtrato(buffer, 'csv')
    } else {
      origem = 'excel'
      resultado = await parsearPlanilhaExtrato(buffer, 'excel')
    }
  } catch (erro) {
    throw new ErroDaAplicacao(
      erro instanceof Error ? erro.message : 'Não foi possível ler o extrato',
      400
    )
  }
  if (!resultado.linhas.length) {
    throw new ErroDaAplicacao('O arquivo não contém movimentações válidas', 400)
  }

  const candidatas = resultado.linhas.map((linha) => ({
    ...linha,
    chaveUnica: chaveLinha(dados.contaEmpresaId, linha),
  }))
  const chavesExistentes = await clientePrisma.extratoBancarioLinha.findMany({
    where: {
      chaveUnica: { in: candidatas.map((linha) => linha.chaveUnica) },
      extrato: { companyId, contaEmpresaId: dados.contaEmpresaId },
    },
    select: { chaveUnica: true },
  })
  const existentes = new Set(chavesExistentes.map((linha) => linha.chaveUnica))
  const novas = candidatas.filter((linha) => !existentes.has(linha.chaveUnica))

  const extrato = await clientePrisma.extratoBancario.create({
    data: {
      companyId,
      contaEmpresaId: dados.contaEmpresaId,
      nomeArquivo: dados.nomeArquivo,
      origem,
      usuarioId,
      linhas: {
        create: novas.map((linha) => ({
          contaEmpresaId: dados.contaEmpresaId,
          data: linha.data,
          valor: linha.valor,
          historico: linha.historico,
          documento: linha.documento,
          chaveUnica: linha.chaveUnica,
        })),
      },
    },
  })
  await registrarAuditoria({
    usuarioId,
    acao: 'importar',
    entidade: 'ExtratoBancario',
    entidadeId: extrato.id,
    valoresDepois: { importadas: novas.length, duplicadas: candidatas.length - novas.length },
  })
  return {
    extratoId: extrato.id,
    importadas: novas.length,
    duplicadas: candidatas.length - novas.length,
    invalidas: resultado.invalidas,
  }
}

async function consultar(companyId: string, filtro: ConsultaConciliacao) {
  await exigirContaBancaria(companyId, filtro.contaEmpresaId)
  const data = intervaloDatas(filtro.dataDe, filtro.dataAte)
  const registros = await clientePrisma.extratoBancarioLinha.findMany({
    where: {
      data,
      ...(filtro.extratoId ? { extratoId: filtro.extratoId } : {}),
      extrato: { companyId, contaEmpresaId: filtro.contaEmpresaId },
    },
    include: {
      conciliacoes: {
        where: { ativo: true },
        select: { conciliacaoId: true },
      },
    },
    orderBy: [{ data: 'desc' }, { createdAt: 'desc' }],
    take: 1000,
  })
  const baixas = await repositorioConciliacaoBancaria.listarBaixas(companyId, filtro)
  const linhasBase = registros.map((linha) => ({
    id: linha.id,
    data: linha.data,
    valor: Number(linha.valor),
    historico: linha.historico,
    documento: linha.documento,
    conciliacaoId: linha.conciliacoes[0]?.conciliacaoId ?? null,
  }))
  const sugestoes = sugerirCorrespondencias(
    linhasBase.filter((linha) => !linha.conciliacaoId),
    baixas
  )
  const linhasSugeridas = new Set(sugestoes.map((item) => item.linhaId))
  const baixasSugeridas = new Set(sugestoes.map((item) => item.baixaId))

  let linhas = linhasBase.map((linha) => ({
    ...linha,
    data: linha.data.toISOString(),
    status: linha.conciliacaoId
      ? 'conciliado'
      : linhasSugeridas.has(linha.id)
        ? 'pendente'
        : 'nao_identificado',
  }))
  let movimentos = baixas.map((baixa) => ({
    ...baixa,
    data: baixa.data.toISOString(),
    status: baixa.conciliacaoId
      ? 'conciliado'
      : baixasSugeridas.has(baixa.id)
        ? 'pendente'
        : 'nao_encontrado',
  }))
  if (filtro.tipo) {
    const credito = filtro.tipo === 'credito'
    linhas = linhas.filter((linha) => (credito ? linha.valor > 0 : linha.valor < 0))
    movimentos = movimentos.filter((linha) => (credito ? linha.valor > 0 : linha.valor < 0))
  }
  if (filtro.status) {
    linhas = linhas.filter((linha) => linha.status === filtro.status)
    movimentos = movimentos.filter((linha) => linha.status === filtro.status)
  }

  const totalExtrato = linhasBase.reduce((total, linha) => total + Math.abs(linha.valor), 0)
  const conciliadas = linhasBase.filter((linha) => linha.conciliacaoId)
  const pendentes = linhasBase.filter((linha) => linhasSugeridas.has(linha.id))
  const naoIdentificadas = linhasBase.filter(
    (linha) => !linha.conciliacaoId && !linhasSugeridas.has(linha.id)
  )
  return {
    totais: {
      totalExtrato,
      conciliado: conciliadas.reduce((total, linha) => total + Math.abs(linha.valor), 0),
      pendente: pendentes.reduce((total, linha) => total + Math.abs(linha.valor), 0),
      naoIdentificado: naoIdentificadas.reduce((total, linha) => total + Math.abs(linha.valor), 0),
      quantidadeExtrato: linhasBase.length,
      quantidadeConciliada: conciliadas.length,
      quantidadePendente: pendentes.length,
      quantidadeNaoIdentificada: naoIdentificadas.length,
    },
    extrato: { linhas, pagina: 1, total: linhas.length },
    sistema: { linhas: movimentos, pagina: 1, total: movimentos.length },
    sugestoes: sugestoes.map((item) => ({
      linhaId: item.linhaId,
      baixaId: item.baixaId,
      origem: baixas.find((baixa) => baixa.id === item.baixaId)?.origem,
    })),
  }
}

async function concluir(
  companyId: string,
  usuarioId: string,
  dados: ConcluirConciliacao
) {
  await exigirContaBancaria(companyId, dados.contaEmpresaId)
  try {
    const conciliacao = await clientePrisma.$transaction(async (tx) => {
      const [linhas, pagar, receber] = await Promise.all([
        tx.extratoBancarioLinha.findMany({
          where: {
            id: { in: dados.linhaIds },
            extrato: { companyId, contaEmpresaId: dados.contaEmpresaId },
            conciliacoes: { none: { ativo: true } },
          },
        }),
        tx.contaPagarBaixa.findMany({
          where: {
            id: {
              in: dados.baixas.filter((b) => b.origem === 'pagar').map((b) => b.baixaId),
            },
            companyId,
            contaEmpresaId: dados.contaEmpresaId,
            conciliacoes: { none: { ativo: true } },
          },
        }),
        tx.contaReceberBaixa.findMany({
          where: {
            id: {
              in: dados.baixas.filter((b) => b.origem === 'receber').map((b) => b.baixaId),
            },
            companyId,
            contaEmpresaId: dados.contaEmpresaId,
            conciliacoes: { none: { ativo: true } },
          },
        }),
      ])
      if (
        linhas.length !== new Set(dados.linhaIds).size ||
        pagar.length + receber.length !==
          new Set(dados.baixas.map((b) => `${b.origem}:${b.baixaId}`)).size
      ) {
        throw new ErroDaAplicacao('Item não encontrado ou já conciliado', 409)
      }
      const somaExtrato = linhas.reduce((total, linha) => total + centavos(Number(linha.valor)), 0)
      const liquido = (baixa: {
        valorPrincipal: Prisma.Decimal
        valorJuros: Prisma.Decimal
        valorMulta: Prisma.Decimal
        valorDesconto: Prisma.Decimal
      }) =>
        centavos(
          Number(baixa.valorPrincipal) +
            Number(baixa.valorJuros) +
            Number(baixa.valorMulta) -
            Number(baixa.valorDesconto)
        )
      const somaSistema =
        receber.reduce((total, baixa) => total + liquido(baixa), 0) -
        pagar.reduce((total, baixa) => total + liquido(baixa), 0)
      if (somaExtrato !== somaSistema) {
        throw new ErroDaAplicacao('Valor divergente entre extrato e sistema', 400)
      }
      return tx.conciliacaoBancaria.create({
        data: {
          companyId,
          contaEmpresaId: dados.contaEmpresaId,
          usuarioId,
          linhas: {
            create: linhas.map((linha) => ({ linhaId: linha.id })),
          },
          baixas: {
            create: [
              ...pagar.map((baixa) => ({ contaPagarBaixaId: baixa.id })),
              ...receber.map((baixa) => ({ contaReceberBaixaId: baixa.id })),
            ],
          },
          eventos: {
            create: { acao: 'concluir', usuarioId, detalhe: { somaCentavos: somaExtrato } },
          },
        },
      })
    })
    await registrarAuditoria({
      usuarioId,
      acao: 'concluir',
      entidade: 'ConciliacaoBancaria',
      entidadeId: conciliacao.id,
    })
    return { id: conciliacao.id }
  } catch (erro) {
    if (erro instanceof ErroDaAplicacao) throw erro
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
      throw new ErroDaAplicacao('Um item selecionado já foi conciliado', 409)
    }
    throw erro
  }
}

async function desvincular(companyId: string, usuarioId: string, id: string) {
  const conciliacao = await clientePrisma.conciliacaoBancaria.findFirst({
    where: { id, companyId },
  })
  if (!conciliacao) throw new ErroDaAplicacao('Conciliação não encontrada', 404)
  if (conciliacao.status !== 'ativa') {
    throw new ErroDaAplicacao('Conciliação já foi desfeita', 409)
  }
  await clientePrisma.$transaction([
    clientePrisma.conciliacaoBancaria.update({
      where: { id },
      data: { status: 'desfeita', desfeitaEm: new Date() },
    }),
    clientePrisma.conciliacaoBancariaLinha.updateMany({
      where: { conciliacaoId: id },
      data: { ativo: false },
    }),
    clientePrisma.conciliacaoBancariaBaixa.updateMany({
      where: { conciliacaoId: id },
      data: { ativo: false },
    }),
    clientePrisma.conciliacaoBancariaEvento.create({
      data: { conciliacaoId: id, acao: 'desvincular', usuarioId },
    }),
  ])
  await registrarAuditoria({
    usuarioId,
    acao: 'desvincular',
    entidade: 'ConciliacaoBancaria',
    entidadeId: id,
  })
  return { ok: true }
}

async function criarLancamento(
  companyId: string,
  usuarioId: string,
  dados: CriarLancamentoConciliacao
) {
  await exigirContaBancaria(companyId, dados.contaEmpresaId)
  const payload = {
    tipo: 'duplicata' as const,
    pessoaId: null,
    planoFinanceiroId: dados.planoFinanceiroId,
    numeroDocumento: dados.documento ?? null,
    dataEmissao: dados.data,
    valorTotal: dados.valor,
    valorDesconto: 0,
    valorJuros: 0,
    valorMulta: 0,
    valorImpostoRetido: 0,
    observacao: dados.historico,
    vencimento: dados.data,
  }
  if (dados.direcao === 'saida') {
    const titulo = await servicoDeContasAPagar.criar(companyId, payload, usuarioId)
    try {
      const parcelaId = titulo.parcelaId ?? titulo.parcelas[0]?.id
      if (!parcelaId) throw new Error('Parcela não criada')
      const resultado = await servicoDeContasAPagar.baixar(companyId, usuarioId, {
        contaId: dados.contaEmpresaId,
        pagoEm: dados.data,
        itens: [{ parcelaId, valorPrincipal: dados.valor, observacao: dados.historico }],
      })
      return { tituloId: titulo.id, baixaId: resultado.baixas[0]?.baixaId }
    } catch (erro) {
      await servicoDeContasAPagar.excluir(companyId, titulo.id, usuarioId).catch(() => undefined)
      throw erro
    }
  }
  const titulo = await servicoDeContasAReceber.criar(companyId, {
    ...payload,
    valorComissao: 0,
  }, usuarioId)
  try {
    const parcelaId = titulo.parcelaId ?? titulo.parcelas[0]?.id
    if (!parcelaId) throw new Error('Parcela não criada')
    const resultado = await servicoDeContasAReceber.baixar(companyId, usuarioId, {
      contaId: dados.contaEmpresaId,
      pagoEm: dados.data,
      itens: [{ parcelaId, valorPrincipal: dados.valor, observacao: dados.historico }],
    })
    return { tituloId: titulo.id, baixaId: resultado.baixas[0]?.baixaId }
  } catch (erro) {
    await servicoDeContasAReceber.excluir(companyId, titulo.id, usuarioId).catch(() => undefined)
    throw erro
  }
}

async function listarExtratos(companyId: string) {
  const extratos = await clientePrisma.extratoBancario.findMany({
    where: { companyId },
    include: {
      contaEmpresa: { select: { nome: true } },
      usuario: { select: { name: true } },
      linhas: { select: { data: true } },
      _count: { select: { linhas: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
  return extratos.map((item) => {
    const datas = item.linhas.map((linha) => linha.data.getTime())
    return {
      id: item.id,
      contaEmpresaId: item.contaEmpresaId,
      conta: item.contaEmpresa.nome,
      arquivo: item.nomeArquivo,
      origem: item.origem,
      periodoDe: datas.length ? new Date(Math.min(...datas)).toISOString() : null,
      periodoAte: datas.length ? new Date(Math.max(...datas)).toISOString() : null,
      linhas: item._count.linhas,
      usuario: item.usuario.name,
      importadoEm: item.createdAt.toISOString(),
    }
  })
}

async function listarMovimentacoes(companyId: string, filtro: ConsultaMovimentos) {
  let movimentos = await repositorioConciliacaoBancaria.listarBaixas(companyId, filtro)
  if (filtro.conciliada) {
    movimentos = movimentos.filter((item) =>
      filtro.conciliada === 'sim' ? Boolean(item.conciliacaoId) : !item.conciliacaoId
    )
  }
  if (filtro.q) {
    const termos = filtro.q.toLowerCase().split(/\s+/).filter(Boolean)
    movimentos = movimentos.filter((item) =>
      termos.every((termo) =>
        [item.documento, item.descricao, item.pessoa, item.contaNome]
          .filter(Boolean)
          .some((texto) => texto!.toLowerCase().includes(termo))
      )
    )
  }
  return movimentos.map((item) => ({
    ...item,
    data: item.data.toISOString(),
    conciliada: Boolean(item.conciliacaoId),
  }))
}

async function listarFluxo(companyId: string, filtro: ConsultaMovimentos) {
  const movimentos = await repositorioConciliacaoBancaria.listarBaixas(companyId, filtro)
  const porDia = new Map<string, { entradas: number; saidas: number }>()
  for (const item of movimentos) {
    const dia = item.data.toISOString().slice(0, 10)
    const atual = porDia.get(dia) ?? { entradas: 0, saidas: 0 }
    if (item.valor >= 0) atual.entradas += item.valor
    else atual.saidas += Math.abs(item.valor)
    porDia.set(dia, atual)
  }
  let acumulado = 0
  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, valores]) => {
      const saldo = valores.entradas - valores.saidas
      acumulado += saldo
      return { data, ...valores, saldo, saldoAcumulado: acumulado }
    })
}

async function relatorio(companyId: string, filtro: ConsultaConciliacao) {
  const consulta = await consultar(companyId, filtro)
  return consulta.totais
}

export const servicoConciliacaoBancaria = {
  importarExtrato,
  consultar,
  concluir,
  desvincular,
  criarLancamento,
  listarExtratos,
  listarMovimentacoes,
  listarFluxo,
  relatorio,
  modeloCsv: () => MODELO_CSV_EXTRATO,
}
