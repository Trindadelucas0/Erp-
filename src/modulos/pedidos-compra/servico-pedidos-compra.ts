/**
 * Regras de negócio para pedidos de compra.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { repositorioDePedidosCompra } from './repositorio-pedidos-compra.js'
import { servicoCreditosPendencias } from './servico-creditos-pendencias.js'
import { conferirPedidoCompraComEntrada } from './conferencia-po-entrada.js'
import { compararPedidoComPdf } from './comparador-pdf-pedido.js'
import { baixarReservaPedido } from './servico-movimentacao-credito.js'
import { servicoDoPortalFornecedor } from '../portal-fornecedor/servico-portal-fornecedor.js'
import { caminhoAbsolutoAnexo, salvarBufferAnexoFornecedor } from '../portal-fornecedor/armazenamento-anexo-fornecedor.js'
import { servicoDeConferenciaArquivo } from './conferencia-arquivo/servico-conferencia-arquivo.js'
import { gerarPdfRelatorioConferencia } from './conferencia-arquivo/gerador-pdf-relatorio-conferencia.js'
import { nomeArquivoCopiaConferenciaIa } from './conferencia-arquivo/nome-arquivo-copia-conferencia-ia.js'
import {
  calcularTotalLiquidoPedido,
  normalizarPrazosPagamento,
} from './parcelas-pagamento.js'
import { repositorioDeFornecedores } from '../fornecedores/repositorio-fornecedores.js'
import { statusAposEdicao } from './resolver-status-edicao-pedido.js'
import {
  normalizarUnidadeCodigoItens,
  validarUnidadeCodigoItens,
} from './normalizar-itens-pedido-compra.js'
import type {
  DadosParaCriarPedidoCompra,
  DadosParaEditarPedidoCompra,
  DadosConferenciaEntrada,
} from './esquema-pedidos-compra.js'
import type { RelatorioConferenciaArquivo } from './conferencia-arquivo/tipos-conferencia.js'
import type { DadosUploadPortalFornecedor } from '../portal-fornecedor/esquema-portal-fornecedor.js'

async function validarFornecedor(fornecedorPessoaId: string, companyId: string) {
  const pessoa = await clientePrisma.pessoa.findFirst({
    where: {
      id: fornecedorPessoaId,
      companyId,
      papeis: { some: { papel: 'fornecedor', ativo: true } },
    },
  })
  if (!pessoa) {
    throw new ErroDaAplicacao('Fornecedor inválido ou inativo', 400)
  }
}

async function validarTransportadora(
  transportadoraPessoaId: string | null | undefined,
  companyId: string
) {
  if (!transportadoraPessoaId) return

  const pessoa = await clientePrisma.pessoa.findFirst({
    where: {
      id: transportadoraPessoaId,
      companyId,
      papeis: { some: { papel: 'transportadora', ativo: true } },
    },
  })
  if (!pessoa) {
    throw new ErroDaAplicacao('Transportadora inválida ou inativa', 400)
  }
}

async function validarItens(
  itens: { produtoId: string }[],
  companyId: string
) {
  for (const item of itens) {
    const produto = await clientePrisma.produto.findFirst({
      where: { id: item.produtoId, companyId, ativo: true },
    })
    if (!produto) {
      throw new ErroDaAplicacao('Produto inexistente ou inativo no pedido', 400)
    }
  }
}

async function listarPedidosCompra(
  companyId: string,
  filtros?: {
    fornecedorId?: string
    status?: string
    statusAberto?: boolean
    statusIn?: string[]
    numero?: number
    busca?: string
    dataInicio?: Date
    dataFim?: Date
  }
) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }
  return repositorioDePedidosCompra.listarPorEmpresa(companyId, filtros)
}

async function buscarPedidoCompra(id: string, companyId: string) {
  const pedido = await repositorioDePedidosCompra.buscarPorId(id)
  if (!pedido || pedido.companyId !== companyId) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }
  return repositorioDePedidosCompra.mapearPedido(pedido)
}

function prepararDadosComPrazos(
  dados: DadosParaCriarPedidoCompra | DadosParaEditarPedidoCompra,
  itens: DadosParaCriarPedidoCompra['itens']
) {
  if (!itens?.length) return dados
  if (dados.prazosPagamento === undefined) return dados

  const totalLiquido = calcularTotalLiquidoPedido(
    itens,
    dados.valorFrete,
    dados.creditoAplicado
  )

  const prazosNormalizados = normalizarPrazosPagamento(
    dados.prazosPagamento,
    dados.rateioParcelas,
    totalLiquido
  )

  return { ...dados, prazosPagamento: prazosNormalizados }
}

async function criarPedidoCompra(
  dados: DadosParaCriarPedidoCompra,
  companyId: string,
  idDoAutor: string
) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }

  await validarFornecedor(dados.fornecedorPessoaId, companyId)
  await validarTransportadora(dados.transportadoraPessoaId, companyId)
  await validarItens(dados.itens, companyId)

  const itensNormalizados = await normalizarUnidadeCodigoItens(
    dados.itens,
    dados.fornecedorPessoaId,
    companyId
  )

  const creditoValidado = await servicoCreditosPendencias.validarCreditoNoPedido(
    dados.creditoFornecedorId,
    dados.creditoAplicado ?? undefined,
    dados.fornecedorPessoaId,
    companyId
  )

  const dadosComCredito = creditoValidado
    ? {
        ...dados,
        itens: itensNormalizados,
        creditoFornecedorId: creditoValidado.creditoFornecedorId,
        creditoAplicado: creditoValidado.creditoAplicado,
      }
    : { ...dados, itens: itensNormalizados }

  const dadosFinais = prepararDadosComPrazos(dadosComCredito, dadosComCredito.itens)

  const pedido = await repositorioDePedidosCompra.criar(dadosFinais, companyId)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'criar',
    entidade: 'pedido_compra',
    entidadeId: pedido.id,
    valoresDepois: { numero: pedido.numero, fornecedor: pedido.fornecedorNome },
  })

  return pedido
}

async function copiarPedidoCompra(id: string, companyId: string, idDoAutor: string) {
  const copia = await repositorioDePedidosCompra.copiar(id, companyId)
  if (!copia) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'copiar',
    entidade: 'pedido_compra',
    entidadeId: copia.id,
    valoresDepois: { numero: copia.numero, copiadoDeId: id },
  })

  return copia
}

async function editarPedidoCompra(
  id: string,
  dados: DadosParaEditarPedidoCompra,
  companyId: string,
  idDoAutor: string
) {
  const existente = await repositorioDePedidosCompra.buscarPorId(id)
  if (!existente || existente.companyId !== companyId) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }

  if (['cancelado', 'recebido', 'aprovado'].includes(existente.status)) {
    throw new ErroDaAplicacao('Pedido não pode ser editado neste status', 400)
  }

  if (dados.status === 'cancelado') {
    throw new ErroDaAplicacao('Use a ação Cancelar pedido com motivo', 400)
  }

  if (dados.fornecedorPessoaId) {
    await validarFornecedor(dados.fornecedorPessoaId, companyId)
  }
  await validarTransportadora(dados.transportadoraPessoaId, companyId)
  const fornecedorId = dados.fornecedorPessoaId ?? existente.fornecedorPessoaId

  if (dados.itens) {
    await validarItens(dados.itens, companyId)
    await validarUnidadeCodigoItens(
      dados.itens,
      fornecedorId,
      companyId,
      existente.itens.map((i) => ({
        produtoId: i.produtoId,
        unidade: i.unidade,
        codigoOriginal: i.codigoOriginal,
      }))
    )
  }
  const creditoValidado = await servicoCreditosPendencias.validarCreditoNoPedido(
    dados.creditoFornecedorId !== undefined
      ? dados.creditoFornecedorId
      : existente.creditoFornecedorId,
    dados.creditoAplicado !== undefined
      ? dados.creditoAplicado ?? undefined
      : existente.creditoAplicado
        ? Number(existente.creditoAplicado)
        : undefined,
    fornecedorId,
    companyId,
    id
  )

  const dadosComCredito = creditoValidado
    ? {
        ...dados,
        creditoFornecedorId: creditoValidado.creditoFornecedorId,
        creditoAplicado: creditoValidado.creditoAplicado,
      }
    : dados

  const { concluir, ...dadosSemConcluir } = dadosComCredito
  const novoStatus = statusAposEdicao(existente.status, concluir)

  const itensParaTotal =
    dadosSemConcluir.itens ??
    existente.itens.map((i) => ({
      quantidade: Number(i.quantidade),
      precoUnitario: Number(i.precoUnitario),
      percentualDesconto: i.percentualDesconto ? Number(i.percentualDesconto) : null,
      valorDesconto: i.valorDesconto ? Number(i.valorDesconto) : null,
      outrasDespesas: i.outrasDespesas ? Number(i.outrasDespesas) : null,
    }))

  const dadosFinais = prepararDadosComPrazos(
    {
      ...dadosSemConcluir,
      ...(novoStatus ? { status: novoStatus } : {}),
      valorFrete:
        dadosSemConcluir.valorFrete !== undefined
          ? dadosSemConcluir.valorFrete
          : existente.valorFrete
            ? Number(existente.valorFrete)
            : null,
      creditoAplicado:
        dadosSemConcluir.creditoAplicado !== undefined
          ? dadosSemConcluir.creditoAplicado
          : existente.creditoAplicado
            ? Number(existente.creditoAplicado)
            : null,
      rateioParcelas:
        dadosSemConcluir.rateioParcelas ??
        (existente.rateioParcelas as 'igual' | 'manual' | undefined),
      prazosPagamento:
        dadosSemConcluir.prazosPagamento !== undefined
          ? dadosSemConcluir.prazosPagamento
          : (existente.prazosPagamento as DadosParaEditarPedidoCompra['prazosPagamento']),
    },
    itensParaTotal as DadosParaCriarPedidoCompra['itens']
  )

  const pedido = await repositorioDePedidosCompra.atualizar(id, dadosFinais)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'editar',
    entidade: 'pedido_compra',
    entidadeId: id,
    valoresDepois: { numero: pedido.numero, status: pedido.status },
  })

  // Ao concluir o pedido pela primeira vez, libera o portal e prepara o WhatsApp
  // automaticamente — evita depender de um segundo clique manual em "Liberar para fornecedor".
  let avisoPortal:
    | {
        avisoWhatsappDisponivel: boolean
        telefonesWhatsapp: { id: string; valor: string; valorFormatado: string }[]
        textoWhatsapp: string
        mensagemAviso?: string
      }
    | undefined
  if (novoStatus === 'enviado' && !existente.portalLiberadoEm) {
    try {
      avisoPortal = await servicoDoPortalFornecedor.liberarParaFornecedor(id, companyId)
      await registrarAuditoria({
        usuarioId: idDoAutor,
        acao: 'liberar_portal',
        entidade: 'pedido_compra',
        entidadeId: id,
        valoresDepois: {
          avisoWhatsappDisponivel: avisoPortal.avisoWhatsappDisponivel,
          qtdTelefones: avisoPortal.telefonesWhatsapp.length,
          automatico: true,
        },
      })
    } catch (erro) {
      avisoPortal = {
        avisoWhatsappDisponivel: false,
        telefonesWhatsapp: [],
        textoWhatsapp: '',
        mensagemAviso: (erro as Error).message,
      }
    }
  }

  return { ...pedido, avisoPortal }
}

async function cancelarPedidoCompra(
  id: string,
  motivo: string,
  companyId: string,
  idDoAutor: string
) {
  const existente = await repositorioDePedidosCompra.buscarPorId(id)
  if (!existente || existente.companyId !== companyId) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }

  if (existente.status === 'cancelado') {
    throw new ErroDaAplicacao('Pedido já está cancelado', 400)
  }

  if (existente.status === 'recebido') {
    throw new ErroDaAplicacao('Pedido já recebido não pode ser cancelado', 400)
  }

  const pedido = await repositorioDePedidosCompra.cancelar(id, motivo)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'cancelar',
    entidade: 'pedido_compra',
    entidadeId: id,
    valoresDepois: { motivo },
  })

  return pedido
}

async function aprovarPedidoCompra(id: string, companyId: string, idDoAutor: string) {
  const existente = await repositorioDePedidosCompra.buscarPorId(id)
  if (!existente || existente.companyId !== companyId) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }

  if (existente.status !== 'enviado') {
    throw new ErroDaAplicacao('Só é possível aprovar pedidos com status Enviado', 400)
  }

  const temAnexoAprovado = existente.anexosFornecedor.some(
    (anexo) =>
      anexo.tipoAnexo === 'documento_fornecedor' && anexo.statusConferencia === 'aprovado'
  )
  if (!temAnexoAprovado) {
    throw new ErroDaAplicacao(
      'Aprove ao menos um documento do fornecedor antes de aprovar o pedido.',
      400
    )
  }

  const pedido = await repositorioDePedidosCompra.aprovar(id)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'aprovar_pedido',
    entidade: 'pedido_compra',
    entidadeId: id,
    valoresDepois: { numero: pedido.numero, status: pedido.status },
  })

  return pedido
}

async function obterContextoFornecedor(fornecedorPessoaId: string, companyId: string) {
  const [pedidosAbertos, creditos, pendencias, ultimasEntradas, fornecedor] = await Promise.all([
    repositorioDePedidosCompra.listarPorEmpresa(companyId, {
      fornecedorId: fornecedorPessoaId,
      statusAberto: true,
    }),
    repositorioDePedidosCompra.listarCreditosFornecedor(companyId, fornecedorPessoaId),
    repositorioDePedidosCompra.listarPendenciasFornecedor(companyId, fornecedorPessoaId),
    repositorioDePedidosCompra.listarUltimasEntradasFornecedor(companyId, fornecedorPessoaId),
    repositorioDeFornecedores.buscarPorId(fornecedorPessoaId),
  ])

  const prazosPagamentoFornecedor =
    fornecedor?.prazosPagamento
      ?.filter((p): p is number => p != null && p >= 0) ?? []

  const modalidadeTransportePadrao = fornecedor?.modalidadeTransportePadrao ?? null

  return {
    pedidosAbertos,
    creditos: creditos.map((c) => ({
      id: c.id,
      valor: Number(c.valor),
      saldo: Number(c.saldo),
      origem: c.origem,
      vencimento: c.vencimento,
    })),
    pendencias: pendencias.map((p) => ({
      id: p.id,
      tipo: p.tipo,
      descricao: p.descricao,
      produtoId: p.produtoId,
      produtoNome: p.produto?.nomeVenda ?? null,
    })),
    ultimasEntradas,
    historicoComprasProduto: [],
    prazosPagamentoFornecedor,
    modalidadeTransportePadrao,
  }
}

async function conferirComEntrada(
  id: string,
  dados: DadosConferenciaEntrada,
  companyId: string
) {
  const pedido = await repositorioDePedidosCompra.buscarPorId(id)
  if (!pedido || pedido.companyId !== companyId) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }

  const divergencias = conferirPedidoCompraComEntrada(
    {
      condicaoPagamento: pedido.condicaoPagamento,
      transportadoraPessoaId: pedido.transportadoraPessoaId,
      modalidadeTransporte: pedido.modalidadeTransporte,
      itens: pedido.itens.map((i) => ({
        produtoId: i.produtoId,
        precoUnitario: Number(i.precoUnitario),
        produto: i.produto,
      })),
    },
    dados
  )

  return { divergencias, temDivergencia: divergencias.length > 0 }
}

async function compararComPdf(id: string, base64Pdf: string, companyId: string) {
  const pedidoDb = await repositorioDePedidosCompra.buscarPorId(id)
  if (!pedidoDb || pedidoDb.companyId !== companyId) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }

  const pedido = repositorioDePedidosCompra.mapearPedido(pedidoDb)
  return compararPedidoComPdf(pedido, base64Pdf)
}

async function historicoProduto(produtoId: string, companyId: string) {
  return repositorioDePedidosCompra.historicoComprasProduto(produtoId, companyId)
}

async function liberarParaPortalFornecedor(id: string, companyId: string, idDoAutor: string) {
  const resultado = await servicoDoPortalFornecedor.liberarParaFornecedor(id, companyId)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'liberar_portal',
    entidade: 'pedido_compra',
    entidadeId: id,
    valoresDepois: {
      avisoWhatsappDisponivel: resultado.avisoWhatsappDisponivel,
      qtdTelefones: resultado.telefonesWhatsapp.length,
    },
  })

  return resultado
}

async function obterAvisoWhatsappCredenciais(id: string, companyId: string) {
  return servicoDoPortalFornecedor.montarAvisoWhatsappCredenciais(id, companyId)
}

async function enviarAnexoFornecedor(
  id: string,
  companyId: string,
  idDoAutor: string,
  arquivo: DadosUploadPortalFornecedor
) {
  const resultado = await servicoDoPortalFornecedor.registrarUploadInterno(id, companyId, arquivo)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'enviar_anexo_fornecedor_interno',
    entidade: 'pedido_compra',
    entidadeId: id,
    valoresDepois: { anexoId: resultado.anexo.id, nomeArquivo: resultado.anexo.nomeArquivo },
  })

  return resultado
}

async function bloquearPortalFornecedor(id: string, companyId: string, idDoAutor: string) {
  await servicoDoPortalFornecedor.bloquearPortal(id, companyId)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'bloquear_portal',
    entidade: 'pedido_compra',
    entidadeId: id,
  })
}

async function voltarPedidoParaRascunho(id: string, companyId: string, idDoAutor: string) {
  const existente = await repositorioDePedidosCompra.buscarPorId(id)
  if (!existente || existente.companyId !== companyId) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }

  if (existente.status !== 'enviado') {
    throw new ErroDaAplicacao(
      'Só é possível voltar para rascunho pedidos com status Enviado.',
      400
    )
  }

  const pedido = await repositorioDePedidosCompra.voltarParaRascunho(id)
  await servicoDoPortalFornecedor.bloquearPortal(id, companyId)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'voltar_para_rascunho',
    entidade: 'pedido_compra',
    entidadeId: id,
    valoresDepois: { statusAnterior: 'enviado', status: 'rascunho', portalBloqueado: true },
  })

  return pedido
}

async function aprovarAnexoFornecedor(
  id: string,
  anexoId: string,
  companyId: string,
  idDoAutor: string
) {
  const resultado = await servicoDoPortalFornecedor.aprovarAnexo(id, anexoId, companyId)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'aprovar_anexo_fornecedor',
    entidade: 'pedido_compra',
    entidadeId: id,
    valoresDepois: {
      anexoId,
      avisoWhatsappDisponivel: resultado.avisoWhatsappDisponivel,
      qtdTelefones: resultado.telefonesWhatsapp.length,
    },
  })

  return resultado
}

async function excluirAnexoFornecedor(
  id: string,
  anexoId: string,
  companyId: string,
  idDoAutor: string
) {
  await servicoDoPortalFornecedor.excluirAnexo(id, anexoId, companyId)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'excluir_anexo_fornecedor',
    entidade: 'pedido_compra',
    entidadeId: id,
    valoresDepois: { anexoId },
  })
}

async function solicitarAjusteAnexoFornecedor(
  id: string,
  anexoId: string,
  companyId: string,
  idDoAutor: string,
  motivo: string,
  relatorio?: RelatorioConferenciaArquivo
) {
  const resultado = await servicoDoPortalFornecedor.solicitarAjusteAnexo(
    id,
    anexoId,
    companyId,
    motivo,
    relatorio
  )

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'solicitar_ajuste_anexo_fornecedor',
    entidade: 'pedido_compra',
    entidadeId: id,
    valoresDepois: {
      anexoId,
      motivo,
      avisoWhatsappDisponivel: resultado.avisoWhatsappDisponivel,
      qtdTelefones: resultado.telefonesWhatsapp.length,
    },
  })

  return resultado
}

async function baixarAnexoFornecedor(id: string, anexoId: string, companyId: string) {
  const pedido = await repositorioDePedidosCompra.buscarPorId(id)
  if (!pedido || pedido.companyId !== companyId) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }

  const anexo = pedido.anexosFornecedor.find((a) => a.id === anexoId)
  if (!anexo) {
    throw new ErroDaAplicacao('Anexo não encontrado', 404)
  }

  return {
    caminhoAbsoluto: caminhoAbsolutoAnexo(anexo.caminhoArquivo),
    nomeArquivo: anexo.nomeArquivo,
    mimeType: anexo.mimeType,
  }
}

async function baixarRelatorioConferenciaAnexo(id: string, anexoId: string, companyId: string) {
  const pedido = await repositorioDePedidosCompra.buscarPorId(id)
  if (!pedido || pedido.companyId !== companyId) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }

  const anexo = pedido.anexosFornecedor.find((a) => a.id === anexoId)
  if (!anexo) {
    throw new ErroDaAplicacao('Anexo não encontrado', 404)
  }

  if (!anexo.relatorioConferenciaJson) {
    throw new ErroDaAplicacao('Este anexo ainda não foi conferido com a IA.', 404)
  }

  const relatorio = anexo.relatorioConferenciaJson as unknown as RelatorioConferenciaArquivo
  const buffer = await gerarPdfRelatorioConferencia(relatorio, {
    numeroPedido: pedido.numero,
    nomeArquivo: anexo.nomeArquivo,
    statusConferencia: anexo.statusConferencia as 'pendente' | 'aprovado' | 'ajuste_solicitado',
    motivoAjuste: anexo.motivoAjuste,
  })

  return { buffer, nomeArquivo: `relatorio-conferencia-pedido-${pedido.numero}.pdf` }
}

async function conferirAnexoComIa(id: string, anexoId: string, companyId: string, idDoAutor: string) {
  const pedido = await repositorioDePedidosCompra.buscarPorId(id)
  if (!pedido || pedido.companyId !== companyId) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }

  const anexo = pedido.anexosFornecedor.find((a) => a.id === anexoId)
  if (!anexo) {
    throw new ErroDaAplicacao('Anexo não encontrado', 404)
  }
  if (anexo.tipoAnexo === 'relatorio_conferencia_ia') {
    throw new ErroDaAplicacao('Relatórios de conferência não podem ser conferidos com a IA.', 422)
  }

  const relatorio = await servicoDeConferenciaArquivo.conferirAnexoComIa(id, anexoId, companyId)
  const conferidoEm = new Date()

  await repositorioDePedidosCompra.salvarRelatorioConferenciaAnexo(anexoId, relatorio, conferidoEm)

  const bufferPdf = await gerarPdfRelatorioConferencia(relatorio, {
    numeroPedido: pedido.numero,
    nomeArquivo: anexo.nomeArquivo,
    statusConferencia: anexo.statusConferencia as 'pendente' | 'aprovado' | 'ajuste_solicitado',
    motivoAjuste: anexo.motivoAjuste,
  })

  const { caminhoArquivo, tamanhoBytes } = await salvarBufferAnexoFornecedor(id, bufferPdf, '.pdf')
  await repositorioDePedidosCompra.criarAnexoRelatorioConferencia({
    pedidoCompraId: id,
    anexoOrigemId: anexoId,
    nomeArquivo: nomeArquivoCopiaConferenciaIa(anexo.nomeArquivo, conferidoEm),
    caminhoArquivo,
    tamanhoBytes,
    enviadoEm: conferidoEm,
  })

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'conferir_anexo_ia',
    entidade: 'pedido_compra',
    entidadeId: id,
    valoresDepois: { anexoId, statusGeral: relatorio.statusGeral, provider: relatorio.provider },
  })

  return relatorio
}

async function baixarCreditoNaEntrada(pedidoCompraId: string, companyId: string) {
  return clientePrisma.$transaction(async (tx) => {
    const pedido = await tx.pedidoCompra.findFirst({
      where: { id: pedidoCompraId, companyId },
    })
    if (!pedido) {
      throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
    }

    return baixarReservaPedido(tx, pedidoCompraId, companyId)
  })
}

export const servicoDePedidosCompra = {
  listarPedidosCompra,
  buscarPedidoCompra,
  criarPedidoCompra,
  copiarPedidoCompra,
  editarPedidoCompra,
  cancelarPedidoCompra,
  aprovarPedidoCompra,
  obterContextoFornecedor,
  conferirComEntrada,
  compararComPdf,
  historicoProduto,
  baixarCreditoNaEntrada,
  liberarParaPortalFornecedor,
  obterAvisoWhatsappCredenciais,
  enviarAnexoFornecedor,
  bloquearPortalFornecedor,
  voltarPedidoParaRascunho,
  aprovarAnexoFornecedor,
  excluirAnexoFornecedor,
  solicitarAjusteAnexoFornecedor,
  baixarAnexoFornecedor,
  baixarRelatorioConferenciaAnexo,
  conferirAnexoComIa,
}
