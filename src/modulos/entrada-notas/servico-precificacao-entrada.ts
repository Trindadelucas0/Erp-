/**
 * Grade de precificação pós-consolidação (NFe 55).
 * Fonte: DOCUMENTACAO-SISTEMA.md §6.17k / §7.26.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { mapaValorIpiPorNItemDoXml } from '../focus-nfe/parser-xml-nfe.js'
import { servicoParametrizacaoCustos } from '../configuracoes/servico-parametrizacao-custos.js'
import { calcularQtdDisponivel } from '../estoque/tipos-estoque.js'
import { repositorioDeEstoque } from '../estoque/repositorio-estoque.js'
import { repositorioEntradaNotas } from './repositorio-entrada-notas.js'
import { montarCustoComparativo, resolverValorIpi } from './custo-unitario-entrada.js'
import {
  calcularDiferencaPercentualPreco,
  calcularPrecoSugerido,
} from './formacao-preco-venda.js'

function decimalNum(valor: unknown): number | null {
  if (valor == null) return null
  const n = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(n) ? n : null
}

function competenciaDeEmissao(data: Date | null | undefined): string {
  const d = data ?? new Date()
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d)
  const ano = partes.find((p) => p.type === 'year')?.value
  const mes = partes.find((p) => p.type === 'month')?.value
  if (!ano || !mes) throw new ErroDaAplicacao('Competência da emissão inválida', 400)
  return `${ano}-${mes}`
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

async function exigirNotaPrecificavel(companyId: string, notaId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.tipoDocumento === 'nfse' || nota.tipoDocumento === 'cte') {
    throw new ErroDaAplicacao('Nota não encontrada', 404)
  }
  if (nota.statusEntrada !== 'entrada_consolidada') {
    throw new ErroDaAplicacao('Nota não encontrada', 404)
  }
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

async function obterGrade(companyId: string, notaId: string) {
  const nota = await exigirNotaPrecificavel(companyId, notaId)
  const competencia = competenciaDeEmissao(nota.dataEmissao)
  const parametrizacao = await servicoParametrizacaoCustos.obter(companyId, competencia)
  const encargosPercentual = parametrizacao.totalVenda ?? 0
  const parametrizacaoCadastrada = Boolean(parametrizacao.id)

  const produtoIds = nota.itens.map((i) => i.produtoId).filter((id): id is string => Boolean(id))
  const [ultimaCustoPorProduto, estoquePorProduto] = await Promise.all([
    repositorioEntradaNotas.buscarUltimoPrecoConsolidadoPorProduto(companyId, produtoIds, nota.id),
    mapaEstoqueDisponivel(companyId, produtoIds),
  ])
  const ipiXmlPorItem = mapaValorIpiPorNItemDoXml(nota.xmlConteudo)

  const itens = nota.itens.map((i) => {
    const quantidade = decimalNum(i.quantidade)
    const itensPorEmbalagem = resolverItensPorEmbalagem(
      i.produto?.fornecedores,
      nota.fornecedorPessoaId
    )
    const valorIpi = resolverValorIpi(
      decimalNum((i as { valorIpi?: unknown }).valorIpi),
      ipiXmlPorItem.get(i.nItem) ?? null
    )
    const custos = montarCustoComparativo({
      quantidadeNf: quantidade,
      valorUnitario: decimalNum(i.valorUnitario),
      custoFreteRateado: decimalNum(i.custoFreteRateado),
      valorIpi,
      itensPorEmbalagem,
      produtoId: i.produtoId,
      ultimaPorProduto: ultimaCustoPorProduto,
    })
    const vinculado = Boolean(i.produtoId && i.produto)
    const formacao = vinculado
      ? calcularPrecoSugerido(custos.custoEntrada, encargosPercentual, 0)
      : { ok: false as const, motivo: 'Item sem produto vinculado.' }
    const precoAtual =
      i.produto?.precoVenda != null ? decimalNum(i.produto.precoVenda) : null
    const precoSugerido = formacao.ok ? formacao.precoSugerido : null
    return {
      itemId: i.id,
      nItem: i.nItem,
      descricao: i.descricao,
      quantidade,
      produtoId: i.produtoId,
      produtoNome: i.produto?.nomeVenda ?? null,
      sku: i.produto?.sku ?? null,
      vinculado,
      custoEntrada: custos.custoEntrada,
      custoAnterior: custos.custoAnterior,
      variacaoPercentual: custos.variacaoPercentual,
      encargosPercentual,
      margemPercentual: formacao.ok ? formacao.margemPercentual : 0,
      precoSugerido,
      precoAtual,
      diferencaPercentual: calcularDiferencaPercentualPreco(precoSugerido, precoAtual),
      estoqueDisponivel: i.produtoId ? (estoquePorProduto.get(i.produtoId) ?? 0) : null,
      recusa: formacao.ok ? null : formacao.motivo,
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
    competencia,
    parametrizacaoCadastrada,
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

async function gravarPrecos(
  companyId: string,
  notaId: string,
  usuarioId: string,
  linhas: Array<{ produtoId: string; precoVenda: number; margemPercentual?: number }>
) {
  const nota = await exigirNotaPrecificavel(companyId, notaId)
  const produtosDaNota = new Set(
    nota.itens.map((i) => i.produtoId).filter((id): id is string => Boolean(id))
  )
  const competencia = competenciaDeEmissao(nota.dataEmissao)
  const parametrizacao = await servicoParametrizacaoCustos.obter(companyId, competencia)
  const encargosPercentual = parametrizacao.totalVenda ?? 0
  const ipiXmlPorItem = mapaValorIpiPorNItemDoXml(nota.xmlConteudo)
  const vistos = new Set<string>()
  for (const linha of linhas) {
    if (vistos.has(linha.produtoId)) {
      throw new ErroDaAplicacao('Produto duplicado na grade de precificação', 400)
    }
    vistos.add(linha.produtoId)
    if (!produtosDaNota.has(linha.produtoId)) {
      throw new ErroDaAplicacao('Produto não pertence a esta nota', 400)
    }
    const item = nota.itens.find((i) => i.produtoId === linha.produtoId)
    if (!item?.produto || item.produto.id !== linha.produtoId) {
      throw new ErroDaAplicacao('Produto não pertence a esta nota', 400)
    }
    if (linha.margemPercentual == null) continue
    const quantidade = decimalNum(item.quantidade)
    const itensPorEmbalagem = resolverItensPorEmbalagem(
      item.produto.fornecedores,
      nota.fornecedorPessoaId
    )
    const custos = montarCustoComparativo({
      quantidadeNf: quantidade,
      valorUnitario: decimalNum(item.valorUnitario),
      custoFreteRateado: decimalNum(item.custoFreteRateado),
      valorIpi: resolverValorIpi(
        decimalNum((item as { valorIpi?: unknown }).valorIpi),
        ipiXmlPorItem.get(item.nItem) ?? null
      ),
      itensPorEmbalagem,
      produtoId: item.produtoId,
      ultimaPorProduto: new Map(),
    })
    const formacao = calcularPrecoSugerido(
      custos.custoEntrada,
      encargosPercentual,
      linha.margemPercentual
    )
    if (!formacao.ok) {
      throw new ErroDaAplicacao(formacao.motivo, 400)
    }
  }

  const ids = [...vistos]
  const existentes = await clientePrisma.produto.findMany({
    where: { id: { in: ids }, companyId },
    select: { id: true, precoVenda: true },
  })
  if (existentes.length !== ids.length) {
    throw new ErroDaAplicacao('Produto não encontrado', 404)
  }
  const antesPorId = new Map(
    existentes.map((p) => [p.id, p.precoVenda != null ? Number(p.precoVenda) : null])
  )

  await clientePrisma.$transaction(
    linhas.map((linha) =>
      clientePrisma.produto.update({
        where: { id: linha.produtoId },
        data: { precoVenda: linha.precoVenda },
      })
    )
  )

  for (const linha of linhas) {
    await registrarAuditoria({
      usuarioId,
      acao: 'editar',
      entidade: 'produto',
      entidadeId: linha.produtoId,
      valoresAntes: { precoVenda: antesPorId.get(linha.produtoId) ?? null },
      valoresDepois: { precoVenda: linha.precoVenda },
    })
  }

  return obterGrade(companyId, notaId)
}

export const servicoPrecificacaoEntrada = {
  obterGrade,
  gravarPrecos,
}
