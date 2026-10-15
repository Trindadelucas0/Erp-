/**
 * Grade de precificação pós-consolidação (NFe 55).
 * Fonte: DOCUMENTACAO-SISTEMA.md §6.17k / §7.26.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { createHash } from 'node:crypto'
import { formarCustosNota } from './formacao-custo-aquisicao.js'
import { ajustesCustoVazios, esquemaAjustesCusto, type AjustesCusto } from './esquema-custo-aquisicao.js'
import {
  mapaValorIpiPorNItemDoXml,
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

async function obterFormacao(companyId: string, notaId: string, db: Prisma.TransactionClient = clientePrisma) {
  const nota = await exigirNotaPrecificavel(companyId, notaId, db)
  const { regras, fretePorItem, vinculos } = await obterCreditosFiscais(companyId, nota, db)
  const ajuste = await db.custoEntradaAjuste.findFirst({ where: { companyId, nfeRecebidaId: notaId } })
  const ajustes = ajuste ? esquemaAjustesCusto.parse(ajuste.dados) : ajustesCustoVazios()
  const totalCte = vinculos.reduce((s, v) => s.add(decimalNum(v.valorFrete) ?? 0), new Decimal(0))
  const totalRateado = nota.itens.reduce((s, i) => s.add(decimalNum(i.custoFreteRateado) ?? 0), new Decimal(0))
  const fontesFrete = vinculos.map(v => ({ valorFrete: decimalNum(v.valorFrete) ?? 0, chaveNfe: v.cteRecebida.chaveNfe ?? null,
    ...(v.cteRecebida.xmlConteudo ? extrairIcmsDoXmlCte(v.cteRecebida.xmlConteudo) : null) ?? { valorIcms: null, baseCalculoIcms: null, aliquotaIcms: null } }))
  const entradas = nota.itens.map(i => ({ itemId: i.id, nItem: i.nItem, cfopEntradaId: i.cfopEntradaId,
    multiplicador: resolverItensPorEmbalagem(i.produto?.fornecedores, nota.fornecedorPessoaId),
    freteCte: nota.modFrete === '1' ? decimalNum(i.custoFreteRateado) ?? 0 : 0, creditoFrete: fretePorItem.get(i.id) ?? 0,
    peso: decimalNum(i.pesoKg) ?? (decimalNum(i.produto?.pesoKg) != null && decimalNum(i.quantidade) != null ? Number(i.produto!.pesoKg) * Number(i.quantidade) : null), produtoId: i.produtoId,
    baseCreditoFrete: totalRateado.gt(0) ? totalCte.mul(decimalNum(i.custoFreteRateado) ?? 0).div(totalRateado).toDecimalPlaces(6).toNumber() : null, fontesFrete }))
  const formacao = formarCustosNota(nota.xmlConteudo, entradas, regras, ajustes)
  const xmlHash = hash(nota.xmlConteudo ?? '')
  const revisao = hash({ versao: 1, companyId, notaId, xmlHash, entradas, regras, ajustes, ajusteRevisao: ajuste?.revisao ?? 0, vinculos })
  const memorias = await db.custoEntradaMemoria.findMany({ where: { companyId, nfeRecebidaId: notaId }, orderBy: { createdAt: 'desc' }, select: { id: true, nItem: true, revisao: true, usuarioId: true, createdAt: true } })
  const autores = memorias.length ? await db.user.findMany({ where: { id: { in: [...new Set(memorias.map(m => m.usuarioId))] } }, select: { id: true, name: true } }) : []
  return { nota, regras, ajustes, entradas, formacao, revisao, xmlHash, memorias: memorias.map(m => ({ ...m, usuarioNome: autores.find(u => u.id === m.usuarioId)?.name ?? 'Usuário indisponível' })) }
}

async function obterGrade(companyId: string, notaId: string) {
  const { nota, regras, ajustes, entradas, formacao: aquisicao, revisao, memorias } = await obterFormacao(companyId, notaId)
  const parametrizacao = await servicoParametrizacaoCustos.obter(companyId)
  const encargosPercentual = parametrizacao.totalVenda ?? 0
  const parametrizacaoCadastrada = Boolean(parametrizacao.id)

  const produtoIds = nota.itens.map((i) => i.produtoId).filter((id): id is string => Boolean(id))
  const [ultimaCustoPorProduto, estoquePorProduto] = await Promise.all([
    repositorioEntradaNotas.buscarUltimoPrecoConsolidadoPorProduto(companyId, produtoIds, nota.id),
    mapaEstoqueDisponivel(companyId, produtoIds),
  ])
  const ipiXmlPorItem = mapaValorIpiPorNItemDoXml(nota.xmlConteudo)
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
      ipiXmlPorItem.get(i.nItem) ?? null
    )
    const custoFreteRateado = decimalNum(i.custoFreteRateado) ?? 0
    const memoria = aquisicao.itens.find(l => l.itemId === i.id)!.memoria
    const despesasSeguro = memoria.seguro
    const outrasDespesas = memoria.outras
    const creditoIcms = memoria.creditos.icms ?? 0
    const creditoIcmsFrete = memoria.creditos.icms_frete ?? 0
    const creditoPis = memoria.creditos.pis ?? 0
    const creditoCofins = memoria.creditos.cofins ?? 0
    const custos = montarCustoComparativo({
      quantidadeNf: quantidade,
      valorUnitario,
      custoFreteRateado,
      valorIpi,
      itensPorEmbalagem,
      produtoId: i.produtoId,
      ultimaPorProduto: ultimaCustoPorProduto,
    })
    const custoContabil = memoria.unitarioVenda
    const confirmacao = memorias.find(m => m.nItem === i.nItem && m.revisao === revisao)
    const estadoCusto = memoria.pendencias.length ? 'pendente' : confirmacao ? 'confirmado' : memorias.some(m => m.nItem === i.nItem) ? 'desatualizado' : 'previa'
    const vinculado = Boolean(i.produtoId && i.produto)
    const formacao = calcularPrecoSugerido(custoContabil, encargosPercentual, 0, 0)
    const formacaoLinha = memoria.pendencias.length
      ? { ok: false as const, motivo: memoria.pendencias.join(' ') }
      : vinculado
      ? formacao
      : { ok: false as const, motivo: 'Item sem produto vinculado.' }
    const precoAtual = i.produto?.precoVenda != null ? decimalNum(i.produto.precoVenda) : null
    const precoSugerido = formacaoLinha.ok ? formacaoLinha.precoSugerido : null
    const ultima = i.produtoId ? ultimaCustoPorProduto.get(i.produtoId) : undefined
    return {
      itemId: i.id,
      memoria,
      estadoCusto,
      confirmacao: confirmacao ?? null,
      quantidadeVenda: memoria.quantidadeVenda,
      valorBruto: memoria.bruto,
      valorDesconto: memoria.desconto,
      freteAquisicao: memoria.frete,
      custoTotal: memoria.total,
      tributosNaoRecuperaveis: memoria.tributosNaoRecuperaveis,
      nItem: i.nItem,
      descricao: i.descricao,
      quantidade: memoria.quantidadeNf,
      produtoId: i.produtoId,
      produtoNome: i.produto?.nomeVenda ?? null,
      sku: i.produto?.sku ?? null,
      vinculado,
      tipoFrete,
      tipoFreteRotulo,
      custoFreteRateado,
      despesasSeguro,
      outrasDespesas,
      creditoIcms,
      creditoIcmsFrete,
      creditoPis,
      creditoCofins,
      aliquotaIcms: memoria.original?.tributos.icms?.aliquota ?? null,
      aliquotaPis: memoria.original?.tributos.pis?.aliquota ?? null,
      aliquotaCofins: memoria.original?.tributos.cofins?.aliquota ?? null,
      custoContabil,
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
    revisaoCusto: revisao,
    ajustesCusto: ajustes,
    basesCusto: entradas.map(i => ({ nItem: i.nItem, peso: i.peso })),
    pendenciasCusto: aquisicao.pendenciasGerais,
    residuaisCusto: aquisicao.residuais,
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
    if (erro && typeof erro === 'object' && 'code' in erro && erro.code === 'P2034') throw new ErroDaAplicacao('Os dados mudaram durante a gravação. Recarregue e confirme novamente.', 409)
    throw erro
  }
}

function exigirRevisao(atual: string, esperada?: string) {
  if (esperada && esperada !== atual) throw new ErroDaAplicacao('O custo mudou. Recarregue a grade e confirme novamente.', 409)
}

async function salvarAjustes(companyId: string, notaId: string, usuarioId: string, revisao: string, dados: AjustesCusto) {
  const ajustes = esquemaAjustesCusto.parse(dados)
  await transacaoCusto(companyId, notaId, async db => {
    const atual = await obterFormacao(companyId, notaId, db)
    exigirRevisao(atual.revisao, revisao)
    const numeros = new Set(atual.nota.itens.map(i => i.nItem))
    if (ajustes.bases.some(b => !numeros.has(b.nItem)) || ajustes.exclusoesXml?.some(e => !numeros.has(e.nItem)) || ajustes.despesas.some(d => d.nItem != null && !numeros.has(d.nItem))) throw new ErroDaAplicacao('Item não pertence à nota', 400)
    const antes = await db.custoEntradaAjuste.findFirst({ where: { companyId, nfeRecebidaId: notaId } })
    await db.custoEntradaAjuste.upsert({ where: { nfeRecebidaId: notaId }, create: { companyId, nfeRecebidaId: notaId, usuarioId, dados: ajustes }, update: { dados: ajustes, usuarioId, revisao: { increment: 1 } } })
    await db.logDeAuditoria.create({ data: { usuarioId, acao: 'editar', entidade: 'custo_entrada_ajustes', entidadeId: notaId, valoresAntes: antes?.dados ?? undefined, valoresDepois: ajustes } })
  })
  return obterGrade(companyId, notaId)
}

async function confirmarCusto(companyId: string, notaId: string, usuarioId: string, revisao: string, itemIds: string[]) {
  await transacaoCusto(companyId, notaId, async db => {
    const atual = await obterFormacao(companyId, notaId, db)
    exigirRevisao(atual.revisao, revisao)
    if (new Set(itemIds).size !== itemIds.length) throw new ErroDaAplicacao('Item duplicado', 400)
    for (const itemId of itemIds) {
      const item = atual.formacao.itens.find(i => i.itemId === itemId)
      if (!item) throw new ErroDaAplicacao('Item não pertence à nota', 400)
      if (item.memoria.pendencias.length) throw new ErroDaAplicacao(item.memoria.pendencias.join(' '), 400)
      await db.custoEntradaMemoria.createMany({ data: [{ companyId, nfeRecebidaId: notaId, itemId, nItem: item.nItem, revisao: atual.revisao, xmlHash: atual.xmlHash, usuarioId, dados: { ...item.memoria, ajustes: atual.ajustes, versaoCalculo: 1 } as unknown as Prisma.InputJsonValue }], skipDuplicates: true })
    }
    await db.logDeAuditoria.create({ data: { usuarioId, acao: 'confirmar', entidade: 'custo_entrada', entidadeId: notaId, valoresDepois: { itemIds, revisao } } })
  })
  return obterGrade(companyId, notaId)
}

async function listarMemorias(companyId: string, notaId: string) {
  await exigirNotaPrecificavel(companyId, notaId)
  const memorias = await clientePrisma.custoEntradaMemoria.findMany({ where: { companyId, nfeRecebidaId: notaId }, orderBy: { createdAt: 'desc' } })
  const autores = memorias.length ? await clientePrisma.user.findMany({ where: { id: { in: [...new Set(memorias.map(m => m.usuarioId))] } }, select: { id: true, name: true } }) : []
  return { memorias: memorias.map(m => ({ ...m, usuarioNome: autores.find(u => u.id === m.usuarioId)?.name ?? 'Usuário indisponível' })) }
}

async function simularAjustes(companyId: string, notaId: string, revisao: string, dados: AjustesCusto) {
  const atual = await obterFormacao(companyId, notaId)
  exigirRevisao(atual.revisao, revisao)
  const ajustes = esquemaAjustesCusto.parse(dados)
  return formarCustosNota(atual.nota.xmlConteudo, atual.entradas, atual.regras, ajustes)
}

async function gravarPrecos(
  companyId: string, notaId: string, usuarioId: string,
  linhas: Array<{ produtoId: string; itemId?: string; precoVenda: number; margemPercentual?: number; vrAdicPercentual?: number }>,
  regrasEsperadas?: RegrasFiscais, revisaoEsperada?: string
) {
  await exigirNotaPrecificavel(companyId, notaId)
  await transacaoCusto(companyId, notaId, async db => {
    const atual = await obterFormacao(companyId, notaId, db)
    exigirRevisao(atual.revisao, revisaoEsperada)
    if (regrasEsperadas && hash(regrasEsperadas) !== hash(atual.regras)) throw new ErroDaAplicacao('As regras fiscais mudaram. Recarregue a grade antes de gravar os preços.', 409)
    const parametrizacao = await servicoParametrizacaoCustos.obter(companyId, db)
    const vistos = new Set<string>()
    const atualizacoes: { produtoId: string; precoVenda: number; antes: number | null; itemId: string }[] = []
    for (const linha of linhas) {
      if (vistos.has(linha.produtoId)) throw new ErroDaAplicacao('Produto duplicado na grade de precificação; selecione uma linha por produto.', 400)
      vistos.add(linha.produtoId)
      const candidatos = atual.nota.itens.filter(i => i.produtoId === linha.produtoId)
      if (!linha.itemId && candidatos.length > 1) throw new ErroDaAplicacao('Selecione a linha que forma o preço deste produto.', 400)
      const item = linha.itemId ? candidatos.find(i => i.id === linha.itemId) : candidatos[0]
      if (!item?.produto || item.produto.companyId !== companyId) throw new ErroDaAplicacao('Produto não pertence a esta nota', 400)
      const memoria = atual.formacao.itens.find(i => i.itemId === item.id)!.memoria
      if (memoria.pendencias.length) throw new ErroDaAplicacao(memoria.pendencias.join(' '), 400)
      if (!atual.memorias.some(m => m.nItem === item.nItem && m.revisao === atual.revisao)) throw new ErroDaAplicacao('Confirme o custo atual antes de gravar o preço.', 409)
      if (!Number.isFinite(linha.precoVenda) || linha.precoVenda <= 0) throw new ErroDaAplicacao('Preço de venda inválido.', 400)
      const formacao = calcularPrecoSugerido(memoria.unitarioVenda, parametrizacao.totalVenda ?? 0, linha.margemPercentual ?? 0, linha.vrAdicPercentual ?? 0)
      if (!formacao.ok) throw new ErroDaAplicacao(formacao.motivo, 400)
      atualizacoes.push({ produtoId: linha.produtoId, precoVenda: linha.precoVenda, antes: decimalNum(item.produto.precoVenda), itemId: item.id })
    }
    for (const linha of atualizacoes) {
      const mudou = await db.produto.updateMany({ where: { id: linha.produtoId, companyId }, data: { precoVenda: linha.precoVenda } })
      if (mudou.count !== 1) throw new ErroDaAplicacao('Produto não encontrado', 404)
      await db.logDeAuditoria.create({ data: { usuarioId, acao: 'editar', entidade: 'produto', entidadeId: linha.produtoId, valoresAntes: { precoVenda: linha.antes }, valoresDepois: { precoVenda: linha.precoVenda, memoriaRevisao: atual.revisao, itemId: linha.itemId } } })
    }
  })
  return obterGrade(companyId, notaId)
}

export const servicoPrecificacaoEntrada = { obterGrade, gravarPrecos, salvarAjustes, confirmarCusto, listarMemorias, simularAjustes }
