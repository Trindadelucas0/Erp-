/**
 * Controlador de pedidos de compra.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { readFile } from 'node:fs/promises'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDePedidosCompra } from './servico-pedidos-compra.js'
import { parsearStatusesQuery } from './filtro-status-pedido.js'
import {
  esquemaCancelarPedidoCompra,
  esquemaCompararPdf,
  esquemaConferenciaEntrada,
  esquemaDeCriacaoDePedidoCompra,
  esquemaDeEdicaoDePedidoCompra,
  esquemaSolicitarAjusteAnexo,
} from './esquema-pedidos-compra.js'
import { esquemaUploadPortalFornecedor } from '../portal-fornecedor/esquema-portal-fornecedor.js'

async function listarPedidosCompra(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  const { fornecedorId, status, statusAberto, statuses, numero, busca, dataInicio, dataFim } =
    requisicao.query as {
      fornecedorId?: string
      status?: string
      statusAberto?: string
      statuses?: string | string[]
      numero?: string
      busca?: string
      dataInicio?: string
      dataFim?: string
    }

  let numeroFiltro: number | undefined
  if (numero != null && numero.trim() !== '') {
    const n = Number(numero.replace(/^#/, '').trim())
    if (!Number.isInteger(n) || n <= 0) {
      throw new ErroDaAplicacao('Número do pedido inválido', 400)
    }
    numeroFiltro = n
  }

  let inicio: Date | undefined
  let fim: Date | undefined
  if (dataInicio) {
    inicio = new Date(`${dataInicio}T00:00:00`)
    if (Number.isNaN(inicio.getTime())) {
      throw new ErroDaAplicacao('Data inicial inválida', 400)
    }
  }
  if (dataFim) {
    fim = new Date(`${dataFim}T23:59:59.999`)
    if (Number.isNaN(fim.getTime())) {
      throw new ErroDaAplicacao('Data final inválida', 400)
    }
  }

  const statusIn = parsearStatusesQuery(statuses)

  const pedidos = await servicoDePedidosCompra.listarPedidosCompra(companyId, {
    fornecedorId,
    status,
    statusAberto: statusAberto === 'true',
    statusIn,
    numero: numeroFiltro,
    busca: busca?.trim() || undefined,
    dataInicio: inicio,
    dataFim: fim,
  })
  return resposta.send({ pedidos })
}

async function buscarPedidoCompra(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const companyId = requisicao.empresaAtivaId || ''
  const pedido = await servicoDePedidosCompra.buscarPedidoCompra(id, companyId)
  return resposta.send({ pedido })
}

async function criarPedidoCompra(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaDeCriacaoDePedidoCompra.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const pedido = await servicoDePedidosCompra.criarPedidoCompra(
    resultado.data,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ pedido })
}

async function copiarPedidoCompra(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const companyId = requisicao.empresaAtivaId || ''
  const pedido = await servicoDePedidosCompra.copiarPedidoCompra(
    id,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ pedido })
}

async function editarPedidoCompra(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDePedidoCompra.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const pedido = await servicoDePedidosCompra.editarPedidoCompra(
    id,
    resultado.data,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.send({ pedido })
}

async function cancelarPedidoCompra(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaCancelarPedidoCompra.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const pedido = await servicoDePedidosCompra.cancelarPedidoCompra(
    id,
    resultado.data.motivo,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.send({ pedido })
}

async function aprovarPedidoCompra(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const companyId = requisicao.empresaAtivaId || ''
  const pedido = await servicoDePedidosCompra.aprovarPedidoCompra(
    id,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.send({ pedido })
}

async function contextoFornecedor(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { fornecedorId } = requisicao.params as { fornecedorId: string }
  const companyId = requisicao.empresaAtivaId || ''
  const contexto = await servicoDePedidosCompra.obterContextoFornecedor(fornecedorId, companyId)
  return resposta.send(contexto)
}

async function conferirEntrada(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaConferenciaEntrada.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const conferencia = await servicoDePedidosCompra.conferirComEntrada(
    id,
    resultado.data,
    companyId
  )
  return resposta.send(conferencia)
}

async function compararPdf(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaCompararPdf.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const comparacao = await servicoDePedidosCompra.compararComPdf(
    id,
    resultado.data.base64Pdf,
    companyId
  )
  return resposta.send(comparacao)
}

async function historicoProduto(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { produtoId } = requisicao.params as { produtoId: string }
  const companyId = requisicao.empresaAtivaId || ''
  const historico = await servicoDePedidosCompra.historicoProduto(produtoId, companyId)
  return resposta.send({ historico })
}

async function liberarParaPortalFornecedor(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const companyId = requisicao.empresaAtivaId || ''
  const resultado = await servicoDePedidosCompra.liberarParaPortalFornecedor(
    id,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.send(resultado)
}

async function avisoWhatsappCredenciais(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const companyId = requisicao.empresaAtivaId || ''
  const resultado = await servicoDePedidosCompra.obterAvisoWhatsappCredenciais(id, companyId)
  return resposta.send(resultado)
}

async function enviarAnexoFornecedor(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaUploadPortalFornecedor.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const dados = await servicoDePedidosCompra.enviarAnexoFornecedor(
    id,
    companyId,
    requisicao.idDoUsuario!,
    resultado.data
  )
  return resposta.status(201).send(dados)
}

async function voltarPedidoParaRascunho(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const companyId = requisicao.empresaAtivaId || ''
  const pedido = await servicoDePedidosCompra.voltarPedidoParaRascunho(
    id,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.send({ pedido })
}

async function aprovarAnexoFornecedor(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id, anexoId } = requisicao.params as { id: string; anexoId: string }
  const companyId = requisicao.empresaAtivaId || ''
  const resultado = await servicoDePedidosCompra.aprovarAnexoFornecedor(
    id,
    anexoId,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.send(resultado)
}

async function excluirAnexoFornecedor(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id, anexoId } = requisicao.params as { id: string; anexoId: string }
  const companyId = requisicao.empresaAtivaId || ''
  await servicoDePedidosCompra.excluirAnexoFornecedor(id, anexoId, companyId, requisicao.idDoUsuario!)
  return resposta.send({ sucesso: true })
}

async function solicitarAjusteAnexoFornecedor(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id, anexoId } = requisicao.params as { id: string; anexoId: string }
  const resultado = esquemaSolicitarAjusteAnexo.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const resultadoAjuste = await servicoDePedidosCompra.solicitarAjusteAnexoFornecedor(
    id,
    anexoId,
    companyId,
    requisicao.idDoUsuario!,
    resultado.data.motivo,
    resultado.data.relatorio
  )
  return resposta.send(resultadoAjuste)
}

async function baixarAnexoFornecedor(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id, anexoId } = requisicao.params as { id: string; anexoId: string }
  const companyId = requisicao.empresaAtivaId || ''
  const { caminhoAbsoluto, nomeArquivo, mimeType } = await servicoDePedidosCompra.baixarAnexoFornecedor(
    id,
    anexoId,
    companyId
  )

  const buffer = await readFile(caminhoAbsoluto)
  resposta.header('Content-Disposition', `attachment; filename="${nomeArquivo}"`)
  return resposta.type(mimeType).send(buffer)
}

async function baixarRelatorioConferenciaAnexo(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id, anexoId } = requisicao.params as { id: string; anexoId: string }
  const companyId = requisicao.empresaAtivaId || ''
  const { buffer, nomeArquivo } = await servicoDePedidosCompra.baixarRelatorioConferenciaAnexo(
    id,
    anexoId,
    companyId
  )

  resposta.header('Content-Disposition', `attachment; filename="${nomeArquivo}"`)
  return resposta.type('application/pdf').send(buffer)
}

async function conferirAnexoComIa(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id, anexoId } = requisicao.params as { id: string; anexoId: string }
  const companyId = requisicao.empresaAtivaId || ''
  try {
    const relatorio = await servicoDePedidosCompra.conferirAnexoComIa(
      id,
      anexoId,
      companyId,
      requisicao.idDoUsuario!
    )
    return resposta.send({ relatorio })
  } catch (erro) {
    if (erro instanceof ErroDaAplicacao) {
      return resposta.status(erro.codigoHttp).send({ mensagem: erro.message })
    }
    requisicao.log.error(erro)
    return resposta.status(500).send({ mensagem: 'Erro inesperado ao conferir o documento com a IA.' })
  }
}

export const controladorDePedidosCompra = {
  listarPedidosCompra,
  buscarPedidoCompra,
  criarPedidoCompra,
  copiarPedidoCompra,
  editarPedidoCompra,
  cancelarPedidoCompra,
  aprovarPedidoCompra,
  contextoFornecedor,
  conferirEntrada,
  compararPdf,
  historicoProduto,
  liberarParaPortalFornecedor,
  avisoWhatsappCredenciais,
  enviarAnexoFornecedor,
  voltarPedidoParaRascunho,
  aprovarAnexoFornecedor,
  excluirAnexoFornecedor,
  solicitarAjusteAnexoFornecedor,
  baixarAnexoFornecedor,
  baixarRelatorioConferenciaAnexo,
  conferirAnexoComIa,
}
