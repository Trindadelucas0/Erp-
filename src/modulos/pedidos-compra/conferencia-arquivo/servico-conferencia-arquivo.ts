/**
 * Orquestra a conferência por IA: lê o anexo do fornecedor já salvo, extrai
 * (determinístico para Excel/CSV, IA para PDF), casa com os itens do pedido
 * e monta o relatório. Disparado só pelo botão "Conferir com IA" no painel
 * interno (compras:edit) — nunca automaticamente no upload do fornecedor.
 *
 * Executa dentro do job `ia_conferencia`; a trava de duplicidade por pedido é
 * o dedupe da fila (`chaveDedupe`), não mais um Set em memória.
 */
import { readFile } from 'node:fs/promises'
import { ErroDaAplicacao } from '../../../compartilhado/erros/ErroDaAplicacao.js'
import { obterConfigIa, iaConfigurada } from '../../../compartilhado/ia/config-ia.js'
import { extrairTextoDoPdf } from '../extrator-texto-pdf.js'
import { detectarTipoArquivo, extrairLinhasDeTabela, mapearLinhasParaItens } from './parser-arquivo.js'
import { extrairItensComIa } from './extrair-itens-com-ia.js'
import { compararItensPedidoComArquivo } from './matcher-itens.js'
import { compararCabecalho } from './comparar-cabecalho.js'
import { caminhoAbsolutoAnexo } from '../../portal-fornecedor/armazenamento-anexo-fornecedor.js'
import { repositorioDePedidosCompra } from '../repositorio-pedidos-compra.js'
import { urlPublicaFoto } from '../../produtos/armazenamento-foto-produto.js'
import type {
  CabecalhoExtraido,
  ItemExtraido,
  ItemPedidoParaMatch,
  RelatorioConferenciaArquivo,
} from './tipos-conferencia.js'
import type { PedidoCompraView } from '../repositorio-pedidos-compra.js'

function cabecalhoVazio(): CabecalhoExtraido {
  return {
    fornecedorNome: null,
    fornecedorCnpj: null,
    numeroDocumentoFornecedor: null,
    dataEmissao: null,
    condicaoPagamento: null,
    prazoEntregaDias: null,
    modalidadeTransporte: null,
    valorTotalGeral: null,
  }
}

function itensPedidoParaMatch(pedido: PedidoCompraView, companyId: string): ItemPedidoParaMatch[] {
  return pedido.itens.map((item) => ({
    produtoId: item.produtoId,
    sku: item.produtoSku,
    nome: item.produtoNome,
    codigoOriginal: item.codigoOriginal || item.produtoCodigoOrigem,
    codigoBarras: item.produtoCodigoBarras,
    quantidade: item.quantidade,
    precoUnitario: item.precoUnitario,
    unidade: item.unidade,
    fotoUrl: item.produtoFotoArquivo
      ? urlPublicaFoto(companyId, item.produtoId, item.produtoFotoArquivo)
      : null,
  }))
}

/**
 * Checagens baratas do anexo, usadas no enfileiramento (erro imediato na tela)
 * e de novo na execução do job.
 */
export function validarAnexoConferivel(mimeType: string): 'excel' | 'csv' | 'pdf' {
  const tipo = detectarTipoArquivo(mimeType)
  if (tipo === 'desconhecido') {
    throw new ErroDaAplicacao('Tipo de arquivo não suportado para conferência por IA.', 422)
  }

  if (tipo === 'pdf' && !iaConfigurada()) {
    throw new ErroDaAplicacao(
      'Conferência por IA não configurada. Defina IA_PROVIDER e IA_API_KEY no .env.',
      503
    )
  }

  return tipo
}

async function conferirAnexoComIa(
  pedidoCompraId: string,
  anexoId: string,
  companyId: string
): Promise<RelatorioConferenciaArquivo> {
  const pedidoDb = await repositorioDePedidosCompra.buscarPorId(pedidoCompraId)
  if (!pedidoDb || pedidoDb.companyId !== companyId) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado.', 404)
  }
  const pedido = repositorioDePedidosCompra.mapearPedido(pedidoDb)

  const anexo = pedidoDb.anexosFornecedor.find((a) => a.id === anexoId)
  if (!anexo) {
    throw new ErroDaAplicacao('Anexo do fornecedor não encontrado neste pedido.', 404)
  }

  const tipo = validarAnexoConferivel(anexo.mimeType)

  const buffer = await readFile(caminhoAbsolutoAnexo(anexo.caminhoArquivo))
  console.log(`[conferencia-ia] anexo lido: ${buffer.length} bytes (tipo=${tipo})`)

  let cabecalho: CabecalhoExtraido = cabecalhoVazio()
  let itensArquivo: ItemExtraido[] = []
  let avisos: string[] = []
  let provider = 'determinístico'
  let modelo: string = tipo

  if (tipo === 'excel' || tipo === 'csv') {
    const linhas = await extrairLinhasDeTabela(buffer, tipo)
    const resultado = mapearLinhasParaItens(linhas)
    itensArquivo = resultado.itens
    avisos = resultado.avisos
  } else {
    const texto = await extrairTextoDoPdf(buffer)
    console.log(`[conferencia-ia] texto extraído do PDF: ${texto.length} caracteres`)
    if (texto.trim().length < 20) {
      return relatorioFalha('Não foi possível extrair texto do PDF (arquivo pode ser uma imagem escaneada).')
    }

    console.log('[conferencia-ia] chamando provedor de IA...')
    const resultado = await extrairItensComIa(texto)
    console.log(`[conferencia-ia] resposta da IA: sucesso=${resultado.sucesso}`)
    if (!resultado.sucesso) {
      return relatorioFalha(resultado.mensagem)
    }

    cabecalho = resultado.dados.cabecalho
    itensArquivo = resultado.dados.itens
    avisos = resultado.dados.avisos
    provider = resultado.provider
    modelo = resultado.modelo
  }

  const config = iaConfigurada() ? obterConfigIa() : null
  const limiarNome = config?.limiarNome ?? 0.82
  const toleranciaPreco = config?.toleranciaPreco ?? 0.01

  const linhas = compararItensPedidoComArquivo(itensPedidoParaMatch(pedido, companyId), itensArquivo, {
    limiarNome,
    toleranciaPreco,
  })

  const divergenciasCabecalho = compararCabecalho(pedido, cabecalho)

  const resumo = {
    totalItensPedido: pedido.itens.length,
    totalItensArquivo: itensArquivo.length,
    ok: linhas.filter((l) => l.status === 'ok').length,
    divergentes: linhas.filter((l) => l.status === 'divergente').length,
    semMatch: linhas.filter((l) => l.status === 'sem_match_pedido').length,
    sobrasArquivo: linhas.filter((l) => l.status === 'sobra_arquivo').length,
  }

  const statusGeral =
    divergenciasCabecalho.length > 0 || resumo.divergentes > 0 || resumo.semMatch > 0
      ? 'divergencias'
      : 'ok'

  console.log(`[conferencia-ia] relatório montado: statusGeral=${statusGeral}`)

  return {
    statusGeral,
    provider,
    modelo,
    resumo,
    cabecalho: { divergencias: divergenciasCabecalho },
    linhas,
    avisos,
  }
}

function relatorioFalha(mensagem: string): RelatorioConferenciaArquivo {
  return {
    statusGeral: 'falha_extracao',
    provider: '-',
    modelo: '-',
    resumo: {
      totalItensPedido: 0,
      totalItensArquivo: 0,
      ok: 0,
      divergentes: 0,
      semMatch: 0,
      sobrasArquivo: 0,
    },
    cabecalho: { divergencias: [] },
    linhas: [],
    avisos: [mensagem],
  }
}

export const servicoDeConferenciaArquivo = {
  conferirAnexoComIa,
}
