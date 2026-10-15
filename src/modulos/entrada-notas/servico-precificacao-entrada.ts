/**
 * Grade de precificação pós-consolidação (NFe 55).
 * Fonte: DOCUMENTACAO-SISTEMA.md §6.17k / §7.26.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import {
  mapaValorIpiPorNItemDoXml,
  mapaDespesasPorNItemDoXml,
  mapaImpostosPorNItemDoXml,
} from '../focus-nfe/parser-xml-nfe.js'
import { servicoParametrizacaoCustos } from '../configuracoes/servico-parametrizacao-custos.js'
import { servicoRegrasFiscais } from '../configuracoes/servico-regras-fiscais.js'
import type { RegrasFiscais } from '../configuracoes/esquema-regras-fiscais.js'
import { extrairIcmsDoXmlCte } from '../focus-nfe/parser-xml-nfe.js'
import { ratearCreditoIcmsFrete } from './credito-icms-frete.js'
import { calcularQtdDisponivel } from '../estoque/tipos-estoque.js'
import { repositorioDeEstoque } from '../estoque/repositorio-estoque.js'
import { repositorioEntradaNotas } from './repositorio-entrada-notas.js'
import { montarCustoComparativo, resolverValorIpi } from './custo-unitario-entrada.js'
import {
  calcularDiferencaPercentualPreco,
  calcularPrecoSugerido,
} from './formacao-preco-venda.js'

import { calcularCustoContabilEntrada, creditoIcmsContabil } from './custo-comercial-entrada.js'

const ROTULO_MOD_FRETE: Record<string, string> = {
  '0': 'Remetente',
  '1': 'Destinatário',
  '2': 'Terceiros',
  '3': 'Próprio remetente',
  '4': 'Próprio destinatário',
  '9': 'Sem frete',
}

function decimalNum(valor: unknown): number | null {
  if (valor == null) return null
  const n = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(n) ? n : null
}

function rotuloModFrete(modFrete: string | null | undefined): string | null {
  if (!modFrete) return null
  return ROTULO_MOD_FRETE[modFrete] ?? modFrete
}

function resolverItensPorEmbalagem(
  fornecedores: Array<{ fornecedorPessoaId: string; multiplicadorEntrada: unknown }> | undefined,
  fornecedorPessoaId: string | null | undefined
): number {
  if (!fornecedorPessoaId || !fornecedores?.length) return 1
  const vinculo = fornecedores.find((f) => f.fornecedorPessoaId === fornecedorPessoaId)
  const valor = decimalNum(vinculo?.multiplicadorEntrada)
  return valor != null && Number.isFinite(valor) && valor > 0 ? valor : 1
}

async function exigirNotaPrecificavel(companyId: string, notaId: string, db: Prisma.TransactionClient = clientePrisma) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId, db)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.tipoDocumento !== 'nfe55' || nota.finalidadeEntrada !== 'revenda') {
    throw new ErroDaAplicacao('Nota não encontrada', 404)
  }
  if (nota.statusEntrada !== 'entrada_consolidada') {
    throw new ErroDaAplicacao('Nota não encontrada', 404)
  }
  if (nota.itens.some(i => i.produto && i.produto.companyId !== companyId)) throw new ErroDaAplicacao('Nota não encontrada', 404)
  return nota
}

async function mapaEstoqueDisponivel(companyId: string, produtoIds: string[]) {
  const ids = [...new Set(produtoIds.filter(Boolean))]
  const mapa = new Map<string, number>()
  if (ids.length === 0) return mapa
  const saldos = await clientePrisma.estoqueSaldo.findMany({
    where: { companyId, produtoId: { in: ids } },
  })
  for (const saldo of saldos) {
    const s = repositorioDeEstoque.mapearSaldos(saldo)
    mapa.set(saldo.produtoId, calcularQtdDisponivel(s))
  }
  return mapa
}

async function obterCreditosFiscais(companyId: string, nota: Awaited<ReturnType<typeof exigirNotaPrecificavel>>, db: Prisma.TransactionClient = clientePrisma) {
  const regras = await servicoRegrasFiscais.obter(companyId, db)
  const vinculos = nota.modFrete === '1'
    ? await db.nfeCteVinculo.findMany({
        where: { companyId, nfeRecebidaId: nota.id, cteRecebida: { companyId } },
        orderBy: { id: 'asc' },
        select: { valorFrete: true, cteRecebida: { select: { xmlConteudo: true, chaveNfe: true } } },
      })
    : []
  const fretePorItem = ratearCreditoIcmsFrete(nota.modFrete, nota.itens.map((item) => ({
    id: item.id, custoFreteRateado: decimalNum(item.custoFreteRateado) ?? 0,
  })), vinculos.map((vinculo) => ({
    valorFrete: decimalNum(vinculo.valorFrete) ?? 0,
    valorIcms: vinculo.cteRecebida.xmlConteudo ? extrairIcmsDoXmlCte(vinculo.cteRecebida.xmlConteudo)?.valorIcms ?? null : null,
  })), regras.transporte)
  return { regras, fretePorItem, vinculos }
}

function hash(valor: unknown) { return createHash('sha256').update(typeof valor === 'string' ? valor : JSON.stringify(valor)).digest('hex') }

function lerValoresXml(xml: string | null) {
  return { impostos: mapaImpostosPorNItemDoXml(xml), despesas: mapaDespesasPorNItemDoXml(xml), ipi: mapaValorIpiPorNItemDoXml(xml) }
}

function calcularLinha(nota: Awaited<ReturnType<typeof exigirNotaPrecificavel>>, item: Awaited<ReturnType<typeof exigirNotaPrecificavel>>['itens'][number], regras: RegrasFiscais, fretePorItem: Map<string, number>, xml: ReturnType<typeof lerValoresXml>) {
  const impostos = xml.impostos.get(item.nItem)
  const despesas = xml.despesas.get(item.nItem)
  const quantidade = decimalNum(item.quantidade)
  const valorUnitario = decimalNum(item.valorUnitario)
  const despesasSeguro = despesas?.valorSeguro ?? 0
  const outrasDespesas = despesas?.valorOutrasDespesas ?? 0
  const creditoIcms = creditoIcmsContabil(impostos?.valorIcms, quantidade, valorUnitario, regras.mercadoria)
  const creditoIcmsFrete = fretePorItem.get(item.id) ?? 0
  const creditoPis = impostos?.valorPis ?? 0
  const creditoCofins = impostos?.valorCofins ?? 0
  const custoContabil = calcularCustoContabilEntrada({ quantidadeNf: quantidade, valorUnitario,
    custoFreteRateado: decimalNum(item.custoFreteRateado),
    valorIpi: resolverValorIpi(decimalNum(item.valorIpi), xml.ipi.get(item.nItem)),
    valorSeguro: despesasSeguro, valorOutrasDespesas: outrasDespesas,
    itensPorEmbalagem: resolverItensPorEmbalagem(item.produto?.fornecedores, nota.fornecedorPessoaId),
    creditoIcms, creditoIcmsFrete, creditoPis, creditoCofins })
  return { despesasSeguro, outrasDespesas, creditoIcms, creditoIcmsFrete, creditoPis, creditoCofins, custoContabil,
    aliquotaIcms: impostos?.aliquotaIcms ?? null, aliquotaPis: impostos?.aliquotaPis ?? null, aliquotaCofins: impostos?.aliquotaCofins ?? null }
}

async function obterGrade(companyId: string, notaId: string) {
  const nota = await exigirNotaPrecificavel(companyId, notaId)
  const { regras, fretePorItem } = await obterCreditosFiscais(companyId, nota)
  const parametrizacao = await servicoParametrizacaoCustos.obter(companyId)
  const encargosPercentual = parametrizacao.totalVenda ?? 0
  const parametrizacaoCadastrada = Boolean(parametrizacao.id)

  const produtoIds = nota.itens.map((i) => i.produtoId).filter((id): id is string => Boolean(id))
  const [ultimaCustoPorProduto, estoquePorProduto] = await Promise.all([
    repositorioEntradaNotas.buscarUltimoPrecoConsolidadoPorProduto(companyId, produtoIds, nota.id),
    mapaEstoqueDisponivel(companyId, produtoIds),
  ])
  const xml = lerValoresXml(nota.xmlConteudo)
  const tipoFrete = nota.modFrete ?? null
  const tipoFreteRotulo = rotuloModFrete(nota.modFrete)

  const itens = nota.itens.map((i) => {
    const quantidade = decimalNum(i.quantidade)
    const valorUnitario = decimalNum(i.valorUnitario)
    const itensPorEmbalagem = resolverItensPorEmbalagem(
      i.produto?.fornecedores,
      nota.fornecedorPessoaId
    )
    const valorIpi = resolverValorIpi(
      decimalNum((i as { valorIpi?: unknown }).valorIpi),
      xml.ipi.get(i.nItem) ?? null
    )
    const custoFreteRateado = decimalNum(i.custoFreteRateado) ?? 0
    const calculo = calcularLinha(nota, i, regras, fretePorItem, xml)
    const custos = montarCustoComparativo({
      quantidadeNf: quantidade,
      valorUnitario,
      custoFreteRateado,
      valorIpi,
      itensPorEmbalagem,
      produtoId: i.produtoId,
      ultimaPorProduto: ultimaCustoPorProduto,
    })
    const { custoContabil } = calculo
    const vinculado = Boolean(i.produtoId && i.produto)
    const formacao = calcularPrecoSugerido(custoContabil, encargosPercentual, 0, 0)
    const formacaoLinha = vinculado
      ? formacao
      : { ok: false as const, motivo: 'Item sem produto vinculado.' }
    const precoAtual = i.produto?.precoVenda != null ? decimalNum(i.produto.precoVenda) : null
    const precoSugerido = formacaoLinha.ok ? formacaoLinha.precoSugerido : null
    const ultima = i.produtoId ? ultimaCustoPorProduto.get(i.produtoId) : undefined
    return {
      itemId: i.id,
      nItem: i.nItem,
      descricao: i.descricao,
      quantidade,
      produtoId: i.produtoId,
      produtoNome: i.produto?.nomeVenda ?? null,
      sku: i.produto?.sku ?? null,
      vinculado,
      tipoFrete,
      tipoFreteRotulo,
      custoFreteRateado,
      ...calculo,
      custoEntrada: custos.custoEntrada,
      custoAnterior: custos.custoAnterior,
      custoAnteriorData: ultima?.dataEmissao ?? null,
      variacaoPercentual: custos.variacaoPercentual,
      encargosPercentual,
      vrAdicPercentual: 0,
      margemPercentual: formacaoLinha.ok ? formacaoLinha.margemPercentual : 0,
      precoSugerido,
      precoAtual,
      diferencaPercentual: calcularDiferencaPercentualPreco(precoSugerido, precoAtual),
      estoqueDisponivel: i.produtoId ? (estoquePorProduto.get(i.produtoId) ?? 0) : null,
      recusa: formacaoLinha.ok ? null : formacaoLinha.motivo,
    }
  })

  return {
    nota: {
      id: nota.id,
      chaveNfe: nota.chaveNfe,
      nomeEmitente: nota.nomeEmitente,
      documentoEmitente: nota.documentoEmitente,
      dataEmissao: nota.dataEmissao,
      valorTotal: decimalNum(nota.valorTotal),
    },
    parametrizacaoCadastrada,
    regrasFiscais: regras,
    encargosPercentual,
    parametrizacao: {
      pis: parametrizacao.pis,
      cofins: parametrizacao.cofins,
      impRendaSupSimples: parametrizacao.impRendaSupSimples,
      contribuicaoSocial: parametrizacao.contribuicaoSocial,
      custoFixo: parametrizacao.custoFixo,
      comissao: parametrizacao.comissao,
      jurosMensaisCustoFinanOperac: parametrizacao.jurosMensaisCustoFinanOperac,
      aliquotaCbs: parametrizacao.aliquotaCbs,
      aliquotaIbs: parametrizacao.aliquotaIbs,
      totalVenda: parametrizacao.totalVenda,
    },
    itens,
  }
}


async function transacaoCusto<T>(companyId: string, notaId: string, executar: (db: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await clientePrisma.$transaction(async db => {
      // Locks match the rows read by the calculation; config and source edits must wait.
      await db.$queryRaw`SELECT id FROM "NfeRecebida" WHERE id = ${notaId} AND "companyId" = ${companyId} FOR UPDATE`
      await db.$queryRaw`SELECT id FROM "RegraFiscal" WHERE "companyId" = ${companyId} FOR SHARE`
      return executar(db)
    }, { isolationLevel: 'Serializable', timeout: 20000 })
  } catch (erro) {
    if (erro && typeof erro === 'object' && 'code' in erro && erro.code === 'P2034') throw new ErroDaAplicacao('Os dados mudaram durante a gravação. Recarregue e tente novamente.', 409)
    throw erro
  }
}

async function gravarPrecos(
  companyId: string, notaId: string, usuarioId: string,
  linhas: Array<{ produtoId: string; itemId?: string; precoVenda: number; margemPercentual?: number; vrAdicPercentual?: number }>,
  regrasEsperadas?: RegrasFiscais
) {
  await exigirNotaPrecificavel(companyId, notaId)
  await transacaoCusto(companyId, notaId, async db => {
    const nota = await exigirNotaPrecificavel(companyId, notaId, db)
    const { regras, fretePorItem } = await obterCreditosFiscais(companyId, nota, db)
    if (regrasEsperadas && hash(regrasEsperadas) !== hash(regras)) throw new ErroDaAplicacao('As regras fiscais mudaram. Recarregue a grade antes de gravar os preços.', 409)
    const parametrizacao = await servicoParametrizacaoCustos.obter(companyId, db)
    const xml = lerValoresXml(nota.xmlConteudo)
    const vistos = new Set<string>()
    const atualizacoes: { produtoId: string; precoVenda: number; antes: number | null; itemId: string }[] = []
    for (const linha of linhas) {
      if (vistos.has(linha.produtoId)) throw new ErroDaAplicacao('Produto duplicado na grade de precificação; selecione uma linha por produto.', 400)
      vistos.add(linha.produtoId)
      const candidatos = nota.itens.filter(i => i.produtoId === linha.produtoId)
      if (!linha.itemId && candidatos.length > 1) throw new ErroDaAplicacao('Selecione a linha que forma o preço deste produto.', 400)
      const item = linha.itemId ? candidatos.find(i => i.id === linha.itemId) : candidatos[0]
      if (!item?.produto || item.produto.companyId !== companyId) throw new ErroDaAplicacao('Produto não pertence a esta nota', 400)
      const { custoContabil } = calcularLinha(nota, item, regras, fretePorItem, xml)
      if (!Number.isFinite(linha.precoVenda) || linha.precoVenda <= 0) throw new ErroDaAplicacao('Preço de venda inválido.', 400)
      const formacao = calcularPrecoSugerido(custoContabil, parametrizacao.totalVenda ?? 0, linha.margemPercentual ?? 0, linha.vrAdicPercentual ?? 0)
      if (!formacao.ok) throw new ErroDaAplicacao(formacao.motivo, 400)
      atualizacoes.push({ produtoId: linha.produtoId, precoVenda: linha.precoVenda, antes: decimalNum(item.produto.precoVenda), itemId: item.id })
    }
    for (const linha of atualizacoes) {
      const mudou = await db.produto.updateMany({ where: { id: linha.produtoId, companyId }, data: { precoVenda: linha.precoVenda } })
      if (mudou.count !== 1) throw new ErroDaAplicacao('Produto não encontrado', 404)
      await db.logDeAuditoria.create({ data: { usuarioId, acao: 'editar', entidade: 'produto', entidadeId: linha.produtoId, valoresAntes: { precoVenda: linha.antes }, valoresDepois: { precoVenda: linha.precoVenda, itemId: linha.itemId } } })
    }
  })
  return obterGrade(companyId, notaId)
}

export const servicoPrecificacaoEntrada = { obterGrade, gravarPrecos }
