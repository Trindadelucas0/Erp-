/**
 * Orquestra o pipeline cadastro → fiscal → negociação → lançamento automático.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { servicoDeAutenticacao } from '../autenticacao/servico-autenticacao.js'
import { repositorioFocusNfe } from '../focus-nfe/repositorio-focus-nfe.js'
import { clienteFocusNfe } from '../focus-nfe/cliente-focus-nfe.js'
import {
  extrairCamposResumoDoXml,
  extrairItensDoXml,
  normalizarXmlNfe,
} from '../focus-nfe/parser-xml-nfe.js'
import { logFocus } from '../focus-nfe/logs-focus-nfe.js'
import { analisarCadastro } from './analise-cadastro/analisar-cadastro.js'
import { analisarFiscalItens } from './analise-fiscal/analisar-fiscal-itens.js'
import { analisarNegociacao } from './analise-negociacao/analisar-negociacao.js'
import { repositorioEntradaNotas } from './repositorio-entrada-notas.js'
import type { AnaliseJson, ResultadoEtapa } from './tipos-analise.js'
import { etapaVazia } from './tipos-analise.js'
import type { RegrasFiscaisJson } from './analise-fiscal/analisar-fiscal-basico.js'
import { sanitizarRegrasFiscais } from '../focus-nfe/esquema-focus-nfe.js'
import type { Prisma } from '@prisma/client'

function asJson(valor: AnaliseJson): Prisma.InputJsonValue {
  return valor as unknown as Prisma.InputJsonValue
}

function decimalNum(v: { toNumber?: () => number } | number | null | undefined): number | null {
  if (v == null) return null
  if (typeof v === 'number') return v
  if (typeof v.toNumber === 'function') return v.toNumber()
  return Number(v)
}

async function garantirItensDoXml(companyId: string, notaId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.tipoDocumento === 'nfse') {
    return nota
  }
  if (!nota.xmlConteudo) {
    throw new ErroDaAplicacao('Nota sem XML. Importe o XML ou baixe pela Focus antes de analisar.', 400)
  }

  const qtd = await repositorioEntradaNotas.contarItens(notaId)
  const campos = extrairCamposResumoDoXml(nota.xmlConteudo)
  if (qtd === 0) {
    const itens = extrairItensDoXml(nota.xmlConteudo)
    await repositorioEntradaNotas.substituirItensDoXml(notaId, itens)
  }

  if (campos.prazoPagamentoXml && !nota.prazoPagamentoXml) {
    await repositorioEntradaNotas.atualizarNota(notaId, {
      prazoPagamentoXml: campos.prazoPagamentoXml,
    })
  }

  return nota
}

async function carregarRegras(companyId: string): Promise<RegrasFiscaisJson | null> {
  const cfg = await repositorioFocusNfe.buscarConfigPorEmpresa(companyId)
  if (!cfg?.regrasFiscaisJson) return null
  return sanitizarRegrasFiscais(cfg.regrasFiscaisJson as Partial<RegrasFiscaisJson>)
}

/** Cadastro nunca é liberável por senha — só vínculo/cadastro. */
function podeAvancarCadastro(etapa: ResultadoEtapa): boolean {
  return etapa.status !== 'bloqueante'
}

/**
 * Fiscal: CST/CFOP (exigeManifesto) nunca libera; NCM/origem libera com senha.
 */
function podeAvancarFiscal(etapa: ResultadoEtapa, criticasLiberadas: boolean): boolean {
  if (etapa.status !== 'bloqueante') return true
  if (etapa.exigeManifesto || (etapa.bloqueiosNaoLiberaveis?.length ?? 0) > 0) {
    return false
  }
  return criticasLiberadas
}

/** Negociação: senha de gerente libera críticas negativas. */
function podeAvancarNegociacao(etapa: ResultadoEtapa, criticasLiberadas: boolean): boolean {
  if (etapa.status !== 'bloqueante') return true
  return criticasLiberadas
}

function fiscalExigeManifesto(etapa: ResultadoEtapa | null | undefined): boolean {
  if (!etapa) return false
  if (etapa.exigeManifesto === true || (etapa.bloqueiosNaoLiberaveis?.length ?? 0) > 0) {
    return true
  }
  // Análises gravadas antes de exigeManifesto: detectar pelo texto do bloqueio
  return (etapa.bloqueios ?? []).some(
    (m) => /sem CFOP|sem CST|desconhecimento da opera/i.test(m)
  )
}

function pipelineProntoParaLancar(
  analise: AnaliseJson | null,
  criticasLiberadas: boolean
): { ok: true } | { ok: false; mensagem: string } {
  if (!analise) {
    return { ok: false, mensagem: 'Nota sem análise. Clique em Reanalisar antes de lançar.' }
  }
  if (!podeAvancarCadastro(analise.cadastro)) {
    return {
      ok: false,
      mensagem:
        'Cadastro bloqueante: cadastre o fornecedor e vincule os produtos antes de lançar.',
    }
  }
  if (fiscalExigeManifesto(analise.fiscal)) {
    return {
      ok: false,
      mensagem:
        'Fiscal com CST/CFOP impeditivo: use desconhecimento da operação ou devolução — não é possível lançar.',
    }
  }
  if (!podeAvancarFiscal(analise.fiscal, criticasLiberadas)) {
    return {
      ok: false,
      mensagem:
        'Fiscal bloqueante (NCM/origem): importe da NF para o produto ou liberar críticas com senha de gerente.',
    }
  }
  if (!podeAvancarNegociacao(analise.negociacao, criticasLiberadas)) {
    return {
      ok: false,
      mensagem:
        'Negociação bloqueante: resolva o pedido/prazo ou liberar críticas com senha de gerente.',
    }
  }
  return { ok: true }
}

async function lancarContagem(notaId: string, origem: 'automatica' | 'humana') {
  await repositorioEntradaNotas.atualizarNota(notaId, {
    statusEntrada: 'entrada_contagem',
    etapaAtual: 'lancamento',
    origemLancamento: origem,
  })
}

/**
 * Roda o pipeline. Se tudo ok (ou críticas liberadas), lança automaticamente para contagem.
 */
/**
 * NFS-e: só cadastro do prestador; sem fiscal de itens / PO / estoque.
 * Libera para contagem documental se cadastro ok.
 */
async function analisarNotaNfse(companyId: string, notaId: string) {
  let nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  await repositorioEntradaNotas.atualizarNota(notaId, { statusEntrada: 'em_analise' })

  const cadastro = await analisarCadastro({
    companyId,
    documentoEmitente: nota.documentoEmitente,
    fornecedorPessoaId: nota.fornecedorPessoaId,
    itens: [],
    exigirItens: false,
  })

  await repositorioEntradaNotas.atualizarNota(notaId, {
    fornecedorPessoaId: cadastro.fornecedorPessoaId,
    etapaAtual: 'servico',
  })

  const analise: AnaliseJson = {
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    cadastro: cadastro.resultado,
    fiscal: {
      status: 'ok',
      avisos: ['NFS-e: análise fiscal de itens de produto não se aplica.'],
      bloqueios: [],
    },
    negociacao: {
      status: 'ok',
      avisos: ['NFS-e: sem vínculo de estoque/PO — liberação documental.'],
      bloqueios: [],
    },
    autoLancado: false,
    motivoParada: null,
  }

  if (!podeAvancarCadastro(cadastro.resultado)) {
    analise.motivoParada = 'cadastro'
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'servico',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId)
  }

  analise.autoLancado = true
  await repositorioEntradaNotas.atualizarNota(notaId, {
    analiseJson: asJson(analise),
    etapaAtual: 'servico',
  })
  await lancarContagem(notaId, 'automatica')
  return await obterDetalhe(companyId, notaId)
}

async function analisarNota(companyId: string, notaId: string, opcoes?: { forcarReparseItens?: boolean }) {
  const base = await garantirItensDoXml(companyId, notaId)
  if (
    base.statusEntrada === 'entrada_contagem' ||
    base.statusEntrada === 'entrada_consolidada' ||
    base.statusEntrada === 'cancelada'
  ) {
    throw new ErroDaAplicacao('Nota já finalizada ou cancelada.', 409)
  }

  if (base.tipoDocumento === 'nfse') {
    return analisarNotaNfse(companyId, notaId)
  }

  if (opcoes?.forcarReparseItens && base.xmlConteudo) {
    const itens = extrairItensDoXml(base.xmlConteudo)
    await repositorioEntradaNotas.substituirItensDoXml(notaId, itens)
  }

  let nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  await repositorioEntradaNotas.atualizarNota(notaId, { statusEntrada: 'em_analise' })

  const cadastro = await analisarCadastro({
    companyId,
    documentoEmitente: nota.documentoEmitente,
    fornecedorPessoaId: nota.fornecedorPessoaId,
    itens: nota.itens.map((i) => ({
      id: i.id,
      gtin: i.gtin,
      codigoProduto: i.codigoProduto,
      produtoId: i.produtoId,
      vinculoModo: i.vinculoModo,
    })),
  })

  for (const item of cadastro.itensAtualizados) {
    await repositorioEntradaNotas.atualizarItem(item.id, {
      produtoId: item.produtoId,
      vinculoModo: item.vinculoModo,
      criticaCadastro: item.criticaCadastro,
    })
  }

  await repositorioEntradaNotas.atualizarNota(notaId, {
    fornecedorPessoaId: cadastro.fornecedorPessoaId,
    etapaAtual: 'cadastro',
  })

  const analise: AnaliseJson = {
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    cadastro: cadastro.resultado,
    fiscal: etapaVazia(),
    negociacao: etapaVazia(),
    autoLancado: false,
    motivoParada: null,
  }

  if (!podeAvancarCadastro(cadastro.resultado)) {
    analise.motivoParada = 'cadastro'
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'cadastro',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId)
  }

  nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  const regras = await carregarRegras(companyId)
  const fiscal = analisarFiscalItens({
    regras,
    itens: nota.itens.map((i) => ({
      id: i.id,
      produtoId: i.produtoId,
      ncm: i.ncm,
      cfop: i.cfop,
      cst: i.cst,
      origem: i.origem,
      produtoNcm: i.produto?.ncm ?? null,
      produtoOrigem: i.produto?.codigoOrigem ?? null,
    })),
  })
  for (const item of fiscal.itensCritica) {
    await repositorioEntradaNotas.atualizarItem(item.id, { criticaFiscal: item.criticaFiscal })
  }
  analise.fiscal = fiscal.resultado
  await repositorioEntradaNotas.atualizarNota(notaId, { etapaAtual: 'fiscal' })

  if (!podeAvancarFiscal(fiscal.resultado, nota.criticasLiberadas)) {
    analise.motivoParada = 'fiscal'
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'fiscal',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId)
  }

  let pedido = null as Awaited<ReturnType<typeof repositorioEntradaNotas.buscarPedidoComItens>>
  if (nota.pedidoCompraId) {
    pedido = await repositorioEntradaNotas.buscarPedidoComItens(companyId, nota.pedidoCompraId)
  } else if (nota.fornecedorPessoaId) {
    const abertos = await repositorioEntradaNotas.listarPedidosAbertosFornecedor(
      companyId,
      nota.fornecedorPessoaId
    )
    if (abertos.length === 1) {
      pedido = abertos[0]
      await repositorioEntradaNotas.atualizarNota(notaId, { pedidoCompraId: pedido.id })
    } else if (abertos.length > 1) {
      // deixa sem pedido — humano escolhe
      pedido = null
    }
  }

  const negociacao = analisarNegociacao({
    itensNf: nota.itens.map((i) => ({
      id: i.id,
      produtoId: i.produtoId,
      quantidade: decimalNum(i.quantidade),
      valorUnitario: decimalNum(i.valorUnitario),
    })),
    pedido: pedido
      ? {
          id: pedido.id,
          numero: pedido.numero,
          condicaoPagamento: pedido.condicaoPagamento,
          prazosPagamento: pedido.prazosPagamento,
          itens: pedido.itens.map((i) => ({
            produtoId: i.produtoId,
            quantidade: decimalNum(i.quantidade) ?? 0,
            precoUnitario: decimalNum(i.precoUnitario) ?? 0,
            nome: i.produto?.nomeVenda,
          })),
        }
      : null,
    prazoNf: nota.prazoPagamentoXml,
    prazoInformadoUsuario: nota.prazoPagamentoTexto,
  })

  for (const item of negociacao.itensCritica) {
    await repositorioEntradaNotas.atualizarItem(item.id, {
      criticaNegociacao: item.criticaNegociacao,
    })
  }
  analise.negociacao = negociacao.resultado
  await repositorioEntradaNotas.atualizarNota(notaId, { etapaAtual: 'negociacao' })

  if (!podeAvancarNegociacao(negociacao.resultado, nota.criticasLiberadas)) {
    analise.motivoParada = 'negociacao'
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'negociacao',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId)
  }

  // Auto-lançamento
  analise.autoLancado = true
  analise.motivoParada = null
  await lancarContagem(notaId, 'automatica')
  await repositorioEntradaNotas.atualizarNota(notaId, {
    analiseJson: asJson(analise),
    etapaAtual: 'lancamento',
  })
  logFocus('info', 'entrada_auto_contagem', { companyId, notaId, chave: nota.chaveNfe })
  return await obterDetalhe(companyId, notaId)
}

async function obterDetalhe(companyId: string, notaId: string) {
  let nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  const statusesAbertos = ['pendente', 'em_analise', 'stand_by']
  if (
    statusesAbertos.includes(nota.statusEntrada) &&
    nota.xmlConteudo &&
    !nota.analiseJson
  ) {
    await processarAposXml(companyId, notaId)
    nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
    if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  }

  let pedidosDisponiveis: Array<{ id: string; numero: number; status: string }> = []
  if (nota.fornecedorPessoaId) {
    const abertos = await repositorioEntradaNotas.listarPedidosAbertosFornecedor(
      companyId,
      nota.fornecedorPessoaId
    )
    pedidosDisponiveis = abertos.map((p) => ({
      id: p.id,
      numero: p.numero,
      status: p.status,
    }))
  }

  return {
    nota: {
      id: nota.id,
      chaveNfe: nota.chaveNfe,
      tipoDocumento: nota.tipoDocumento ?? 'nfe55',
      nomeEmitente: nota.nomeEmitente,
      documentoEmitente: nota.documentoEmitente,
      valorTotal: decimalNum(nota.valorTotal),
      dataEmissao: nota.dataEmissao,
      statusEntrada: nota.statusEntrada,
      origem: nota.origem,
      etapaAtual: nota.etapaAtual,
      nfeCompleta: nota.nfeCompleta,
      criticasLiberadas: nota.criticasLiberadas,
      observacaoContato: nota.observacaoContato,
      pedidoCompraId: nota.pedidoCompraId,
      origemLancamento: nota.origemLancamento,
      prazoPagamentoXml: nota.prazoPagamentoXml,
      prazoPagamentoTexto: nota.prazoPagamentoTexto,
      fornecedor: nota.fornecedorPessoa,
      analise: sanitizarAnaliseExibicao(nota.tipoDocumento, nota.analiseJson as AnaliseJson | null),
      itens: nota.itens.map((i) => ({
        id: i.id,
        nItem: i.nItem,
        descricao: i.descricao,
        gtin: i.gtin,
        codigoProduto: i.codigoProduto,
        ncm: i.ncm,
        cfop: i.cfop,
        cst: i.cst,
        origem: i.origem,
        quantidade: decimalNum(i.quantidade),
        valorUnitario: decimalNum(i.valorUnitario),
        valorTotal: decimalNum(i.valorTotal),
        produtoId: i.produtoId,
        vinculoModo: i.vinculoModo,
        criticaCadastro: i.criticaCadastro,
        criticaFiscal: i.criticaFiscal,
        criticaNegociacao: i.criticaNegociacao,
        produto: i.produto,
      })),
    },
    pedidosDisponiveis,
  }
}

/** Remove aviso legado de "sem itens" em NFS-e (serviço não tem itens de produto). */
function sanitizarAnaliseExibicao(
  tipoDocumento: string | null | undefined,
  analise: AnaliseJson | null
): AnaliseJson | null {
  if (!analise || tipoDocumento !== 'nfse') return analise
  const avisoItens = 'Nota sem itens parseados do XML'
  const avisos = (analise.cadastro?.avisos ?? []).filter((a) => !a.includes(avisoItens))
  const bloqueios = analise.cadastro?.bloqueios ?? []
  const statusCadastro =
    bloqueios.length > 0 ? 'bloqueante' : avisos.length > 0 ? 'aviso' : 'ok'
  return {
    ...analise,
    cadastro: {
      ...analise.cadastro,
      status: statusCadastro,
      avisos,
      bloqueios,
    },
  }
}

async function vincularItem(
  companyId: string,
  notaId: string,
  itemId: string,
  produtoId: string
) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  const item = nota.itens.find((i) => i.id === itemId)
  if (!item) throw new ErroDaAplicacao('Item não encontrado', 404)

  const produto = await clientePrisma.produto.findFirst({
    where: { id: produtoId, companyId },
    select: { id: true },
  })
  if (!produto) throw new ErroDaAplicacao('Produto não encontrado', 404)

  await repositorioEntradaNotas.atualizarItem(itemId, {
    produtoId,
    vinculoModo: 'manual',
    criticaCadastro: false,
  })
  return analisarNota(companyId, notaId)
}

async function gravarCodigoOriginal(companyId: string, notaId: string, itemId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (!nota.fornecedorPessoaId) {
    throw new ErroDaAplicacao('Vincule o fornecedor antes de gravar o código original.', 400)
  }
  const item = nota.itens.find((i) => i.id === itemId)
  if (!item?.produtoId) throw new ErroDaAplicacao('Item sem produto vinculado', 400)
  if (!item.codigoProduto) throw new ErroDaAplicacao('Item sem cProd na NF', 400)

  await repositorioEntradaNotas.gravarCodigoOriginalVinculo(
    item.produtoId,
    nota.fornecedorPessoaId,
    item.codigoProduto
  )
  return { sucesso: true, mensagem: 'Código original gravado no vínculo produto × fornecedor.' }
}

async function importarFiscalProduto(
  companyId: string,
  notaId: string,
  itemId: string,
  campos: { ncm?: boolean; origem?: boolean }
) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  const item = nota.itens.find((i) => i.id === itemId)
  if (!item?.produtoId) throw new ErroDaAplicacao('Item sem produto vinculado', 400)

  await repositorioEntradaNotas.atualizarFiscalProduto(item.produtoId, companyId, {
    ncm: campos.ncm ? item.ncm : undefined,
    codigoOrigem: campos.origem ? item.origem : undefined,
  })
  return analisarNota(companyId, notaId)
}

async function liberarCriticas(companyId: string, notaId: string, usuarioId: string, senha: string) {
  if (!senha?.trim()) {
    throw new ErroDaAplicacao(
      'Senha de gerente obrigatória para liberar críticas (divergência NCM/origem ou negociação).',
      400
    )
  }
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  const analise = nota.analiseJson as AnaliseJson | null
  if (analise?.cadastro?.status === 'bloqueante') {
    throw new ErroDaAplicacao(
      'Cadastro bloqueante não pode ser liberado por senha. Cadastre o fornecedor e vincule os produtos, depois reanalise.',
      400
    )
  }
  if (fiscalExigeManifesto(analise?.fiscal)) {
    throw new ErroDaAplicacao(
      'CST/CFOP impeditivo não pode ser liberado por senha. Use desconhecimento da operação ou devolução.',
      400
    )
  }

  const ok = await servicoDeAutenticacao.verificarSenhaDoUsuario(usuarioId, senha)
  if (!ok) throw new ErroDaAplicacao('Senha inválida.', 403)
  await repositorioEntradaNotas.atualizarNota(notaId, { criticasLiberadas: true })
  return analisarNota(companyId, notaId)
}

async function cancelarLiberacaoCriticas(companyId: string, notaId: string) {
  await repositorioEntradaNotas.atualizarNota(notaId, { criticasLiberadas: false })
  return analisarNota(companyId, notaId)
}

async function contatoFornecedor(companyId: string, notaId: string, observacao: string) {
  await repositorioEntradaNotas.atualizarNota(notaId, {
    statusEntrada: 'stand_by',
    observacaoContato: observacao,
    etapaAtual: 'negociacao',
  })
  return obterDetalhe(companyId, notaId)
}

async function definirPedido(companyId: string, notaId: string, pedidoCompraId: string) {
  const pedido = await repositorioEntradaNotas.buscarPedidoComItens(companyId, pedidoCompraId)
  if (!pedido) throw new ErroDaAplicacao('Pedido não encontrado', 404)
  await repositorioEntradaNotas.atualizarNota(notaId, { pedidoCompraId })
  return analisarNota(companyId, notaId)
}

async function definirPrazo(companyId: string, notaId: string, prazo: string) {
  await repositorioEntradaNotas.atualizarNota(notaId, { prazoPagamentoTexto: prazo })
  return analisarNota(companyId, notaId)
}

async function manifestar(
  companyId: string,
  notaId: string,
  tipo: 'desconhecimento' | 'nao_realizada',
  justificativa?: string
) {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  const cfg = await repositorioFocusNfe.buscarConfigPorEmpresa(companyId)
  if (!cfg?.apiToken) throw new ErroDaAplicacao('Configure o token Focus NFe', 400)

  const tipoApi =
    tipo === 'desconhecimento' ? 'desconhecimento_da_operacao' : 'operacao_nao_realizada'

  await clienteFocusNfe.manifestar(
    cfg.apiToken,
    cfg.homologacao,
    nota.chaveNfe,
    tipoApi,
    justificativa
  )

  await repositorioEntradaNotas.atualizarNota(notaId, {
    statusEntrada: 'cancelada',
    manifestacaoDestinatario: tipoApi,
    etapaAtual: 'lancamento',
  })
  return obterDetalhe(companyId, notaId)
}

async function lancar(
  companyId: string,
  notaId: string,
  usuarioId: string,
  modo: 'contagem' | 'consolidar',
  senha?: string
) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (
    nota.statusEntrada === 'entrada_contagem' ||
    nota.statusEntrada === 'entrada_consolidada'
  ) {
    throw new ErroDaAplicacao('Nota já lançada.', 409)
  }
  if (nota.statusEntrada === 'cancelada') {
    throw new ErroDaAplicacao('Nota cancelada — não é possível lançar.', 409)
  }

  const gate = pipelineProntoParaLancar(
    nota.analiseJson as AnaliseJson | null,
    nota.criticasLiberadas
  )
  if (!gate.ok) {
    throw new ErroDaAplicacao(gate.mensagem, 400)
  }

  if (modo === 'consolidar') {
    if (!senha) throw new ErroDaAplicacao('Senha de gerente obrigatória para consolidar estoque.', 400)
    const ok = await servicoDeAutenticacao.verificarSenhaDoUsuario(usuarioId, senha)
    if (!ok) throw new ErroDaAplicacao('Senha inválida.', 403)
    await repositorioEntradaNotas.atualizarNota(notaId, {
      statusEntrada: 'entrada_consolidada',
      etapaAtual: 'lancamento',
      origemLancamento: 'humana',
    })
  } else {
    await lancarContagem(notaId, 'humana')
  }

  return obterDetalhe(companyId, notaId)
}

/**
 * Após import/sync com XML: persiste itens e tenta pipeline automático.
 */
async function processarAposXml(companyId: string, notaId: string) {
  try {
    const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
    if (!nota?.xmlConteudo) return
    if (
      nota.statusEntrada === 'entrada_contagem' ||
      nota.statusEntrada === 'entrada_consolidada' ||
      nota.statusEntrada === 'cancelada'
    ) {
      return
    }

    if (nota.tipoDocumento === 'nfse') {
      await analisarNota(companyId, notaId)
      return
    }

    const xml = normalizarXmlNfe(nota.xmlConteudo)
    const campos = extrairCamposResumoDoXml(xml)
    const itens = extrairItensDoXml(xml)
    await repositorioEntradaNotas.substituirItensDoXml(notaId, itens)
    await repositorioEntradaNotas.atualizarNota(notaId, {
      prazoPagamentoXml: campos.prazoPagamentoXml,
    })
    await analisarNota(companyId, notaId)
  } catch (erro) {
    logFocus('warn', 'pipeline_apos_xml_falhou', {
      companyId,
      notaId,
      mensagem: erro instanceof Error ? erro.message : String(erro),
    })
  }
}

export const servicoEntradaNotas = {
  analisarNota,
  obterDetalhe,
  vincularItem,
  gravarCodigoOriginal,
  importarFiscalProduto,
  liberarCriticas,
  cancelarLiberacaoCriticas,
  contatoFornecedor,
  definirPedido,
  definirPrazo,
  manifestar,
  lancar,
  processarAposXml,
}
