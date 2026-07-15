/**
 * Regras de negócio do portal do fornecedor: login, consulta do pedido,
 * geração do Excel e recebimento de upload. Rotas públicas — autenticação
 * própria por token de sessão (não usa o JWT do ERP).
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { repositorioDoPortalFornecedor } from './repositorio-portal-fornecedor.js'
import { salvarAnexoFornecedor } from './armazenamento-anexo-fornecedor.js'
import { gerarExcelPedidoCompra } from './gerar-excel-pedido.js'
import { repositorioDePedidosCompra } from '../pedidos-compra/repositorio-pedidos-compra.js'
import { servicoDeNotificacoesEmail } from '../notificacoes-email/servico-notificacoes-email.js'
import {
  limparTentativas,
  registrarTentativaFalha,
  verificarBloqueio,
} from './rate-limit-login-portal.js'
import type {
  DadosLoginPortalFornecedor,
  DadosUploadPortalFornecedor,
} from './esquema-portal-fornecedor.js'
import type { RelatorioConferenciaArquivo } from '../pedidos-compra/conferencia-arquivo/tipos-conferencia.js'
import { gerarPdfRelatorioConferencia } from '../pedidos-compra/conferencia-arquivo/gerador-pdf-relatorio-conferencia.js'
import { urlPublicaFoto } from '../produtos/armazenamento-foto-produto.js'

async function login(dados: DadosLoginPortalFornecedor) {
  const bloqueio = verificarBloqueio(dados.cnpj, dados.senha)
  if (bloqueio.bloqueado) {
    throw new ErroDaAplicacao(
      `Muitas tentativas de login. Tente novamente em ${bloqueio.segundosRestantes} segundos.`,
      429
    )
  }

  const pedido = await repositorioDoPortalFornecedor.buscarPedidoLiberadoPorCnpjENumero(
    dados.cnpj,
    dados.senha
  )

  if (!pedido) {
    registrarTentativaFalha(dados.cnpj, dados.senha)
    throw new ErroDaAplicacao(
      'CNPJ ou senha inválidos, ou o pedido ainda não foi liberado para o portal.',
      401
    )
  }

  if (pedido.portalBloqueadoEm) {
    throw new ErroDaAplicacao('Acesso ao portal foi bloqueado pelo comprador.', 401)
  }

  limparTentativas(dados.cnpj, dados.senha)

  const sessao = await repositorioDoPortalFornecedor.criarSessao(pedido.id)
  return { token: sessao.token, expiraEm: sessao.expiraEm, numeroPedido: pedido.numero }
}

async function pedidoDaSessaoValida(token: string) {
  const sessao = await repositorioDoPortalFornecedor.buscarSessaoValidaPorToken(token)
  if (!sessao) {
    throw new ErroDaAplicacao('Sessão inválida ou expirada. Faça login novamente.', 401)
  }

  const pedido = await repositorioDoPortalFornecedor.buscarPedidoCompletoPorId(sessao.pedidoCompraId)
  if (!pedido) {
    throw new ErroDaAplicacao('Pedido não encontrado', 404)
  }

  if (pedido.portalBloqueadoEm) {
    await repositorioDoPortalFornecedor.revogarSessoesDoPedido(pedido.id)
    throw new ErroDaAplicacao('Acesso ao portal foi bloqueado pelo comprador.', 401)
  }

  return pedido
}

type PedidoCompletoPortal = Awaited<ReturnType<typeof pedidoDaSessaoValida>>

function mapearPedidoParaPortal(pedido: PedidoCompletoPortal) {
  return {
    numero: pedido.numero,
    fornecedorNome: pedido.fornecedor.nome,
    transportadoraNome: pedido.transportadora?.nome ?? null,
    modalidadeTransporte: pedido.modalidadeTransporte,
    condicaoPagamento: pedido.condicaoPagamento,
    previsaoEntrega: pedido.previsaoEntrega,
    observacoes: pedido.observacoes,
    status: pedido.status,
    itens: pedido.itens.map((item) => ({
      codigo: item.codigoOriginal ?? item.produto.sku ?? null,
      produtoNome: item.produto.nomeVenda,
      unidade: item.unidade,
      quantidade: Number(item.quantidade),
      precoUnitario: Number(item.precoUnitario),
      total: Number(item.totalLiquido ?? item.total),
      urlFotoMiniatura: item.produto.fotos[0]
        ? urlPublicaFoto(pedido.companyId, item.produtoId, item.produto.fotos[0].arquivo)
        : null,
    })),
    anexos: pedido.anexosFornecedor.map((anexo) => ({
      id: anexo.id,
      nomeArquivo: anexo.nomeArquivo,
      enviadoEm: anexo.enviadoEm,
      statusConferencia: anexo.statusConferencia,
      motivoAjuste: anexo.motivoAjuste,
      temRelatorioPdf: anexo.statusConferencia === 'ajuste_solicitado' && !!anexo.relatorioConferenciaJson,
    })),
  }
}

async function buscarPedidoParaPortal(token: string) {
  const pedido = await pedidoDaSessaoValida(token)
  return mapearPedidoParaPortal(pedido)
}

async function gerarExcelPedido(token: string) {
  const pedido = await pedidoDaSessaoValida(token)
  const pedidoDbCompleto = await repositorioDePedidosCompra.buscarPorId(pedido.id)
  if (!pedidoDbCompleto) {
    throw new ErroDaAplicacao('Pedido não encontrado', 404)
  }

  const pedidoView = repositorioDePedidosCompra.mapearPedido(pedidoDbCompleto)
  const buffer = await gerarExcelPedidoCompra(pedidoView)
  return { buffer, nomeArquivo: `pedido-${pedido.numero}.xlsx` }
}

async function registrarUpload(token: string, arquivo: DadosUploadPortalFornecedor) {
  const pedido = await pedidoDaSessaoValida(token)

  const { caminhoArquivo, tamanhoBytes } = await salvarAnexoFornecedor(
    pedido.id,
    arquivo.mimeType,
    arquivo.base64Arquivo
  )

  const anexo = await repositorioDoPortalFornecedor.criarAnexo({
    pedidoCompraId: pedido.id,
    nomeArquivo: arquivo.nomeArquivo,
    mimeType: arquivo.mimeType,
    caminhoArquivo,
    tamanhoBytes,
  })

  const avisoEmail = await servicoDeNotificacoesEmail
    .avisarUploadFornecedor({
      numeroPedido: pedido.numero,
      fornecedorNome: pedido.fornecedor.nome,
      nomeEmpresa: pedido.company.name,
      nomeArquivo: arquivo.nomeArquivo,
    })
    .catch((erro: unknown) => ({ sucesso: false, mensagem: (erro as Error).message }))

  return {
    anexo: { id: anexo.id, nomeArquivo: anexo.nomeArquivo, enviadoEm: anexo.enviadoEm },
    avisoEmailEnviado: avisoEmail.sucesso,
  }
}

async function liberarParaFornecedor(pedidoCompraId: string, companyId: string) {
  const pedido = await repositorioDoPortalFornecedor.buscarPedidoParaLiberar(pedidoCompraId, companyId)
  if (!pedido) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }

  if (!pedido.fornecedor.cnpj) {
    throw new ErroDaAplicacao(
      'Fornecedor sem CNPJ cadastrado — cadastre o CNPJ antes de liberar o portal.',
      400
    )
  }

  await repositorioDoPortalFornecedor.liberarPedidoParaPortal(pedidoCompraId)

  const emailFornecedor = pedido.fornecedor.contatos[0]?.valor
  if (!emailFornecedor) {
    return {
      avisoEmailEnviado: false,
      mensagemAviso:
        'Fornecedor sem e-mail cadastrado. Portal liberado — avise manualmente o CNPJ e o número do pedido.',
    }
  }

  const resultado = await servicoDeNotificacoesEmail
    .enviarCredenciaisPortal({
      emailFornecedor,
      fornecedorNome: pedido.fornecedor.nome,
      nomeEmpresa: pedido.company.name,
      cnpj: pedido.fornecedor.cnpj,
      numeroPedido: pedido.numero,
    })
    .catch((erro: unknown) => ({ sucesso: false, mensagem: (erro as Error).message }))

  return {
    avisoEmailEnviado: resultado.sucesso,
    mensagemAviso: resultado.sucesso ? undefined : resultado.mensagem,
  }
}

async function bloquearPortal(pedidoCompraId: string, companyId: string) {
  const pedido = await repositorioDoPortalFornecedor.buscarPedidoParaLiberar(pedidoCompraId, companyId)
  if (!pedido) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }

  await repositorioDoPortalFornecedor.bloquearPortal(pedidoCompraId)
}

async function validarAnexoDoPedido(pedidoCompraId: string, anexoId: string, companyId: string) {
  const pedido = await repositorioDoPortalFornecedor.buscarPedidoParaLiberar(pedidoCompraId, companyId)
  if (!pedido) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }

  const anexo = await repositorioDoPortalFornecedor.buscarAnexoPorId(anexoId)
  if (!anexo || anexo.pedidoCompraId !== pedidoCompraId) {
    throw new ErroDaAplicacao('Anexo não encontrado', 404)
  }

  return { pedido, anexo }
}

async function aprovarAnexo(pedidoCompraId: string, anexoId: string, companyId: string) {
  const { pedido } = await validarAnexoDoPedido(pedidoCompraId, anexoId, companyId)

  await repositorioDoPortalFornecedor.aprovarAnexo(anexoId)

  const emailFornecedor = pedido.fornecedor.contatos[0]?.valor
  if (!emailFornecedor) {
    return {
      avisoEmailEnviado: false,
      mensagemAviso: 'Fornecedor sem e-mail cadastrado. Documento aprovado — avise manualmente.',
    }
  }

  const resultado = await servicoDeNotificacoesEmail
    .avisarDocumentoAprovado({
      emailFornecedor,
      fornecedorNome: pedido.fornecedor.nome,
      nomeEmpresa: pedido.company.name,
      numeroPedido: pedido.numero,
    })
    .catch((erro: unknown) => ({ sucesso: false, mensagem: (erro as Error).message }))

  return {
    avisoEmailEnviado: resultado.sucesso,
    mensagemAviso: resultado.sucesso ? undefined : resultado.mensagem,
  }
}

async function solicitarAjusteAnexo(
  pedidoCompraId: string,
  anexoId: string,
  companyId: string,
  motivo: string,
  relatorio?: RelatorioConferenciaArquivo
) {
  const { pedido } = await validarAnexoDoPedido(pedidoCompraId, anexoId, companyId)

  await repositorioDoPortalFornecedor.solicitarAjusteAnexo(anexoId, motivo, relatorio)

  const emailFornecedor = pedido.fornecedor.contatos[0]?.valor
  if (!emailFornecedor) {
    return {
      avisoEmailEnviado: false,
      mensagemAviso: 'Fornecedor sem e-mail cadastrado. Ajuste solicitado — avise manualmente.',
    }
  }

  const resultado = await servicoDeNotificacoesEmail
    .avisarAjusteNecessario({
      emailFornecedor,
      fornecedorNome: pedido.fornecedor.nome,
      nomeEmpresa: pedido.company.name,
      numeroPedido: pedido.numero,
      motivo,
    })
    .catch((erro: unknown) => ({ sucesso: false, mensagem: (erro as Error).message }))

  return {
    avisoEmailEnviado: resultado.sucesso,
    mensagemAviso: resultado.sucesso ? undefined : resultado.mensagem,
  }
}

async function buscarRelatorioValidado(token: string, anexoId: string) {
  const pedido = await pedidoDaSessaoValida(token)

  const anexo = await repositorioDoPortalFornecedor.buscarAnexoPorId(anexoId)
  if (!anexo || anexo.pedidoCompraId !== pedido.id) {
    throw new ErroDaAplicacao('Anexo não encontrado', 404)
  }

  if (anexo.statusConferencia !== 'ajuste_solicitado' || !anexo.relatorioConferenciaJson) {
    throw new ErroDaAplicacao('Relatório da conferência não disponível para este documento.', 404)
  }

  const relatorio = anexo.relatorioConferenciaJson as unknown as RelatorioConferenciaArquivo
  return { pedido, anexo, relatorio }
}

async function baixarRelatorioConferenciaAnexo(token: string, anexoId: string) {
  const { pedido, anexo, relatorio } = await buscarRelatorioValidado(token, anexoId)

  const buffer = await gerarPdfRelatorioConferencia(relatorio, {
    numeroPedido: pedido.numero,
    nomeArquivo: anexo.nomeArquivo,
    statusConferencia: anexo.statusConferencia as 'pendente' | 'aprovado' | 'ajuste_solicitado',
    motivoAjuste: anexo.motivoAjuste,
  })

  return { buffer, nomeArquivo: `relatorio-conferencia-pedido-${pedido.numero}.pdf` }
}

async function buscarRelatorioConferenciaAnexo(token: string, anexoId: string) {
  const { pedido, anexo, relatorio } = await buscarRelatorioValidado(token, anexoId)

  return {
    relatorio,
    numeroPedido: pedido.numero,
    nomeArquivo: anexo.nomeArquivo,
    motivoAjuste: anexo.motivoAjuste,
  }
}

export const servicoDoPortalFornecedor = {
  login,
  buscarPedidoParaPortal,
  gerarExcelPedido,
  registrarUpload,
  liberarParaFornecedor,
  bloquearPortal,
  aprovarAnexo,
  solicitarAjusteAnexo,
  baixarRelatorioConferenciaAnexo,
  buscarRelatorioConferenciaAnexo,
}
