import type { Prisma } from '@prisma/client'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { repositorioDeEstoque } from '../estoque/repositorio-estoque.js'
import { servicoDeEstoque } from '../estoque/servico-estoque.js'
import { arredondarQtd, calcularQtdDisponivel } from '../estoque/tipos-estoque.js'
import { repositorioDeRequisicoesWms } from './repositorio-requisicoes-wms.js'
import {
  edicaoPermitida,
  statusAposAcao,
  type AcaoStatusRequisicao,
} from './maquina-status-requisicao.js'
import type {
  DadosConferirRequisicao,
  DadosCorpoRequisicao,
  DadosEdicaoRequisicao,
  FiltroListagemRequisicao,
} from './esquema-requisicoes-wms.js'
import {
  chavesIdempotenciaEstoque,
  conferenciaCompleta,
  enderecoConfere,
  ORIGEM_MOVIMENTO_REQUISICAO,
  passosExigidos,
  produtoConfere,
  quantidadeConfere,
  TIPO_MOV_ESTORNO,
  TIPO_MOV_RESERVA,
  TIPO_MOV_SAIDA,
  tipoMoveKardexSeparacao,
  type CamposOsConferencia,
} from './efeito-estoque-requisicao.js'

function exigirEmpresa(companyId: string) {
  if (!companyId) throw new ErroDaAplicacao('Empresa não selecionada', 400)
}

function decimalParaNumero(v: { toString(): string } | number | null | undefined): number | null {
  if (v == null) return null
  return Number(v)
}

function iso(d: Date | null | undefined) {
  return d?.toISOString() ?? null
}

function camposOs(row: {
  tipoOperacao: string
  origemEnderecoId: string | null
  destinoEnderecoId: string | null
  produtoId: string | null
  quantidade: { toString(): string } | number | null
}): CamposOsConferencia {
  return {
    tipoOperacao: row.tipoOperacao,
    origemEnderecoId: row.origemEnderecoId,
    destinoEnderecoId: row.destinoEnderecoId,
    produtoId: row.produtoId,
    quantidade: decimalParaNumero(row.quantidade),
  }
}

type RowFicha = NonNullable<Awaited<ReturnType<typeof repositorioDeRequisicoesWms.buscarPorId>>>

function mapearBase(row: RowFicha) {
  const os = camposOs(row)
  const qtdExecutada = decimalParaNumero(row.qtdExecutada)
  const flags = {
    conferidoOrigemEm: row.conferidoOrigemEm,
    conferidoProdutoEm: row.conferidoProdutoEm,
    conferidoDestinoEm: row.conferidoDestinoEm,
    qtdExecutada,
  }
  const exigidos = passosExigidos(os)
  return {
    id: row.id,
    numero: row.numero,
    tipoOperacao: row.tipoOperacao,
    prioridade: row.prioridade,
    status: row.status,
    origemEnderecoId: row.origemEnderecoId,
    origemCodigo: row.origemEndereco?.codigoCompleto ?? null,
    destinoEnderecoId: row.destinoEnderecoId,
    destinoCodigo: row.destinoEndereco?.codigoCompleto ?? null,
    produtoId: row.produtoId,
    produtoNome: row.produto?.nomeVenda ?? null,
    produtoSku: row.produto?.sku ?? null,
    produtoUnidade: row.produto?.unidade ?? null,
    controlaEstoque: row.produto?.controlaEstoque ?? null,
    quantidade: decimalParaNumero(row.quantidade),
    qtdExecutada,
    conferidoOrigemEm: iso(row.conferidoOrigemEm),
    conferidoProdutoEm: iso(row.conferidoProdutoEm),
    conferidoDestinoEm: iso(row.conferidoDestinoEm),
    conferidoOrigemValor: row.conferidoOrigemValor,
    conferidoProdutoValor: row.conferidoProdutoValor,
    conferidoDestinoValor: row.conferidoDestinoValor,
    passosExigidos: exigidos,
    conferenciaOk: conferenciaCompleta(os, flags),
    responsavelId: row.responsavelId,
    responsavelNome: row.responsavel?.name ?? null,
    observacao: row.observacao,
    nfeRecebidaId: row.nfeRecebidaId ?? null,
    nfeRecebidaChave: row.nfeRecebida?.chaveNfe ?? null,
    iniciadoEm: iso(row.iniciadoEm),
    pausadoEm: iso(row.pausadoEm),
    concluidoEm: iso(row.concluidoEm),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    eventos: row.eventos.map((ev) => ({
      id: ev.id,
      acao: ev.acao,
      deStatus: ev.deStatus,
      paraStatus: ev.paraStatus,
      motivo: ev.motivo,
      usuarioId: ev.usuarioId,
      usuarioNome: ev.usuario.name,
      createdAt: ev.createdAt.toISOString(),
    })),
  }
}

async function mapear(row: RowFicha | null) {
  if (!row) return null
  const base = mapearBase(row)
  let qtdDisponivel: number | null = null
  if (row.produtoId && row.produto?.controlaEstoque) {
    try {
      const atual = await servicoDeEstoque.obterSaldosAtuais(row.companyId, row.produtoId)
      qtdDisponivel = atual.saldos.qtdDisponivel
    } catch {
      qtdDisponivel = null
    }
  }
  return { ...base, qtdDisponivel }
}

function mapearLista(row: RowFicha) {
  return { ...mapearBase(row), qtdDisponivel: null as number | null }
}

async function validarVinculos(
  companyId: string,
  dados: {
    origemEnderecoId?: string | null
    destinoEnderecoId?: string | null
    produtoId?: string | null
    responsavelId?: string | null
  }
) {
  if (dados.origemEnderecoId) {
    const end = await repositorioDeRequisicoesWms.enderecoDaEmpresa(
      companyId,
      dados.origemEnderecoId
    )
    if (!end) throw new ErroDaAplicacao('Endereço de origem não encontrado', 400)
  }
  if (dados.destinoEnderecoId) {
    const end = await repositorioDeRequisicoesWms.enderecoDaEmpresa(
      companyId,
      dados.destinoEnderecoId
    )
    if (!end) throw new ErroDaAplicacao('Endereço de destino não encontrado', 400)
  }
  if (dados.produtoId) {
    const prod = await repositorioDeRequisicoesWms.produtoDaEmpresa(companyId, dados.produtoId)
    if (!prod) throw new ErroDaAplicacao('Produto não encontrado', 400)
  }
  if (dados.responsavelId) {
    const user = await repositorioDeRequisicoesWms.usuarioDaEmpresa(
      companyId,
      dados.responsavelId
    )
    if (!user) throw new ErroDaAplicacao('Responsável não pertence a esta empresa', 400)
  }
}

async function obterOu404(companyId: string, id: string) {
  exigirEmpresa(companyId)
  const row = await repositorioDeRequisicoesWms.buscarPorId(companyId, id)
  if (!row) throw new ErroDaAplicacao('Requisição não encontrada', 404)
  return row
}

function exigirOperador(row: { responsavelId: string | null }, usuarioId: string) {
  if (row.responsavelId !== usuarioId) {
    throw new ErroDaAplicacao('Só o responsável pode executar esta ação', 403)
  }
}

function enderecoOperacionalOk(end: { ativo: boolean; status: string } | null | undefined) {
  return Boolean(end && end.ativo && end.status === 'ativo')
}

function validarOsParaIniciar(row: RowFicha) {
  const qtd = decimalParaNumero(row.quantidade)
  if (row.tipoOperacao === 'separacao') {
    if (!row.produtoId || qtd == null || qtd <= 0) {
      throw new ErroDaAplicacao('Complete produto e quantidade na ficha', 400)
    }
  }
  if (row.tipoOperacao === 'reposicao') {
    if (!row.origemEnderecoId || !row.destinoEnderecoId || !row.produtoId || qtd == null || qtd <= 0) {
      throw new ErroDaAplicacao('Reposição exige origem, destino, produto e quantidade', 400)
    }
  }
  if (row.tipoOperacao === 'movimentacao') {
    if (!row.origemEnderecoId || !row.destinoEnderecoId) {
      throw new ErroDaAplicacao('Movimentação exige origem e destino', 400)
    }
  }
}

async function reservaAindaAtiva(companyId: string, id: string, tx?: Prisma.TransactionClient) {
  const chaves = chavesIdempotenciaEstoque(id)
  const reserva = await repositorioDeEstoque.buscarMovimentoPorChave(companyId, chaves.reserva, tx)
  if (!reserva) return false
  const estorno = await repositorioDeEstoque.buscarMovimentoPorChave(
    companyId,
    chaves.estornoReserva,
    tx
  )
  return !estorno
}

function deveReservarKardex(row: RowFicha) {
  return tipoMoveKardexSeparacao(row.tipoOperacao) && Boolean(row.produto?.controlaEstoque)
}

async function aplicarReserva(
  tx: Prisma.TransactionClient,
  row: RowFicha,
  usuarioId: string
) {
  const qtd = arredondarQtd(decimalParaNumero(row.quantidade) ?? 0)
  if (qtd <= 0 || !row.produtoId) {
    throw new ErroDaAplicacao('Complete produto e quantidade na ficha', 400)
  }
  const chaves = chavesIdempotenciaEstoque(row.id)
  try {
    await servicoDeEstoque.registrarMovimentoEstoque(
      {
        companyId: row.companyId,
        produtoId: row.produtoId,
        dimensao: 'reserva',
        tipoMovimento: TIPO_MOV_RESERVA,
        quantidade: qtd,
        origem: ORIGEM_MOVIMENTO_REQUISICAO,
        origemId: row.id,
        chaveIdempotencia: chaves.reserva,
        observacao: `Requisição ${row.numero}`,
        usuarioId,
      },
      tx
    )
  } catch (erro) {
    if (erro instanceof ErroDaAplicacao && erro.statusCode === 400) {
      const saldos = await servicoDeEstoque.obterSaldosAtuais(row.companyId, row.produtoId)
      throw new ErroDaAplicacao(
        `Estoque disponível insuficiente (disponível: ${saldos.saldos.qtdDisponivel}, pedido: ${qtd}).`,
        409
      )
    }
    throw erro
  }
}

async function aplicarEstornoReserva(
  tx: Prisma.TransactionClient,
  row: RowFicha,
  usuarioId: string
) {
  if (!(await reservaAindaAtiva(row.companyId, row.id, tx))) return
  const qtd = arredondarQtd(decimalParaNumero(row.quantidade) ?? 0)
  if (qtd <= 0 || !row.produtoId) return
  const chaves = chavesIdempotenciaEstoque(row.id)
  await servicoDeEstoque.registrarMovimentoEstoque(
    {
      companyId: row.companyId,
      produtoId: row.produtoId,
      dimensao: 'reserva',
      tipoMovimento: TIPO_MOV_ESTORNO,
      quantidade: -qtd,
      origem: ORIGEM_MOVIMENTO_REQUISICAO,
      origemId: row.id,
      chaveIdempotencia: chaves.estornoReserva,
      observacao: `Estorno reserva requisição ${row.numero}`,
      usuarioId,
    },
    tx
  )
}

async function aplicarSaidaFisica(
  tx: Prisma.TransactionClient,
  row: RowFicha,
  usuarioId: string
) {
  const qtd = arredondarQtd(decimalParaNumero(row.quantidade) ?? 0)
  if (qtd <= 0 || !row.produtoId) {
    throw new ErroDaAplicacao('Complete produto e quantidade na ficha', 400)
  }
  const chaves = chavesIdempotenciaEstoque(row.id)
  await servicoDeEstoque.registrarMovimentoEstoque(
    {
      companyId: row.companyId,
      produtoId: row.produtoId,
      dimensao: 'fisico',
      tipoMovimento: TIPO_MOV_SAIDA,
      quantidade: -qtd,
      origem: ORIGEM_MOVIMENTO_REQUISICAO,
      origemId: row.id,
      chaveIdempotencia: chaves.saida,
      observacao: `Saída requisição ${row.numero}`,
      usuarioId,
    },
    tx
  )
}

async function criar(companyId: string, usuarioId: string, dados: DadosCorpoRequisicao) {
  exigirEmpresa(companyId)
  if (dados.tipoOperacao === 'contagem_entrada') {
    throw new ErroDaAplicacao(
      'Contagem de entrada só é criada ao liberar a nota para contagem.',
      400
    )
  }
  await validarVinculos(companyId, dados)
  const status = dados.responsavelId ? 'atribuida' : 'pendente'
  const row = await repositorioDeRequisicoesWms.criar(companyId, {
    tipoOperacao: dados.tipoOperacao,
    prioridade: dados.prioridade,
    status,
    origemEnderecoId: dados.origemEnderecoId ?? null,
    destinoEnderecoId: dados.destinoEnderecoId ?? null,
    produtoId: dados.produtoId ?? null,
    quantidade: dados.quantidade ?? null,
    responsavelId: dados.responsavelId ?? null,
    observacao: dados.observacao ?? null,
    evento: {
      usuarioId,
      acao: 'criar',
      deStatus: null,
      paraStatus: status,
    },
  })
  await registrarAuditoria({
    usuarioId,
    acao: 'criar',
    entidade: 'requisicao_wms',
    entidadeId: row.id,
    valoresDepois: { numero: row.numero, status },
  })
  return mapear(row)
}

async function listar(
  companyId: string,
  usuarioId: string,
  filtro: FiltroListagemRequisicao
) {
  exigirEmpresa(companyId)
  const resultado = await repositorioDeRequisicoesWms.listar(companyId, {
    q: filtro.q,
    status: filtro.status || undefined,
    tipo: filtro.tipo || undefined,
    prioridade: filtro.prioridade,
    fila: filtro.fila,
    usuarioId,
    pagina: filtro.pagina ?? 1,
    limite: filtro.limite ?? 50,
  })
  return {
    itens: resultado.itens.map((item) => mapearLista({ ...item, eventos: [] })),
    total: resultado.total,
    resumoPorStatus: resultado.resumoPorStatus,
  }
}

async function buscar(companyId: string, id: string) {
  const row = await obterOu404(companyId, id)
  return mapear(row)
}

async function editar(
  companyId: string,
  id: string,
  usuarioId: string,
  dados: DadosEdicaoRequisicao
) {
  const atual = await obterOu404(companyId, id)
  if (!edicaoPermitida(atual.status)) {
    throw new ErroDaAplicacao('Requisição encerrada não pode ser editada', 409)
  }
  if (atual.tipoOperacao === 'contagem_entrada' || dados.tipoOperacao === 'contagem_entrada') {
    throw new ErroDaAplicacao(
      'Contagem de entrada não pode ser criada nem alterada por esta tela.',
      400
    )
  }
  const reserva = await reservaAindaAtiva(companyId, id)
  const emExecucao = atual.status === 'em_execucao' || atual.status === 'pausada'
  if (reserva || emExecucao) {
    if (
      dados.produtoId !== undefined ||
      dados.quantidade !== undefined ||
      dados.tipoOperacao !== undefined
    ) {
      throw new ErroDaAplicacao(
        'Produto, quantidade e tipo não podem ser alterados com a execução em andamento',
        409
      )
    }
  }
  await validarVinculos(companyId, dados)
  const row = await repositorioDeRequisicoesWms.atualizar(companyId, id, {
    ...(dados.tipoOperacao !== undefined ? { tipoOperacao: dados.tipoOperacao } : {}),
    ...(dados.prioridade !== undefined ? { prioridade: dados.prioridade } : {}),
    ...(dados.origemEnderecoId !== undefined ? { origemEnderecoId: dados.origemEnderecoId } : {}),
    ...(dados.destinoEnderecoId !== undefined ? { destinoEnderecoId: dados.destinoEnderecoId } : {}),
    ...(dados.produtoId !== undefined ? { produtoId: dados.produtoId } : {}),
    ...(dados.quantidade !== undefined ? { quantidade: dados.quantidade } : {}),
    ...(dados.responsavelId !== undefined ? { responsavelId: dados.responsavelId } : {}),
    ...(dados.observacao !== undefined ? { observacao: dados.observacao } : {}),
  })
  await registrarAuditoria({
    usuarioId,
    acao: 'editar',
    entidade: 'requisicao_wms',
    entidadeId: id,
  })
  return mapear(row)
}

async function transicionar(params: {
  companyId: string
  id: string
  usuarioId: string
  acao: AcaoStatusRequisicao
  motivo?: string
  responsavelId?: string
}) {
  const atual = await obterOu404(params.companyId, params.id)
  const para = statusAposAcao(params.acao, atual.status, Boolean(atual.responsavelId))

  if (params.acao === 'iniciar') {
    if (atual.status === 'disponivel') {
      // autoatribui
    } else {
      exigirOperador(atual, params.usuarioId)
    }
    validarOsParaIniciar(atual)
  }
  if (params.acao === 'pausar' || params.acao === 'retomar' || params.acao === 'concluir') {
    exigirOperador(atual, params.usuarioId)
  }

  if (params.acao === 'concluir') {
    if (atual.tipoOperacao === 'contagem_entrada') {
      throw new ErroDaAplicacao('Conclua a contagem de entrada na tela Contagens.', 409)
    }
    const os = camposOs(atual)
    const flags = {
      conferidoOrigemEm: atual.conferidoOrigemEm,
      conferidoProdutoEm: atual.conferidoProdutoEm,
      conferidoDestinoEm: atual.conferidoDestinoEm,
      qtdExecutada: decimalParaNumero(atual.qtdExecutada),
    }
    if (!conferenciaCompleta(os, flags)) {
      throw new ErroDaAplicacao('Conferência incompleta: confirme os passos na tela de execução', 409)
    }
  }

  let responsavelId = atual.responsavelId
  if (params.acao === 'atribuir') {
    if (!params.responsavelId) throw new ErroDaAplicacao('Informe o responsável', 400)
    await validarVinculos(params.companyId, { responsavelId: params.responsavelId })
    responsavelId = params.responsavelId
  }
  if (params.acao === 'iniciar' && atual.status === 'disponivel') {
    responsavelId = params.usuarioId
  }

  const agora = new Date()
  const patch: Prisma.RequisicaoWmsUncheckedUpdateInput = {
    status: para,
    responsavelId,
    ...(params.acao === 'iniciar' ? { iniciadoEm: agora, pausadoEm: null } : {}),
    ...(params.acao === 'pausar' ? { pausadoEm: agora } : {}),
    ...(params.acao === 'retomar' ? { pausadoEm: null } : {}),
    ...(params.acao === 'concluir' ? { concluidoEm: agora } : {}),
  }
  const evento = {
    usuarioId: params.usuarioId,
    acao: params.acao,
    deStatus: atual.status,
    paraStatus: para,
    motivo: params.motivo ?? null,
  }

  const precisaKardexIniciar = params.acao === 'iniciar' && deveReservarKardex(atual)
  const precisaKardexConcluir = params.acao === 'concluir' && deveReservarKardex(atual)
  const precisaKardexCancelar =
    params.acao === 'cancelar' &&
    deveReservarKardex(atual) &&
    (await reservaAindaAtiva(params.companyId, params.id))

  let row: RowFicha
  if (precisaKardexIniciar || precisaKardexConcluir || precisaKardexCancelar) {
    if (precisaKardexIniciar && atual.produtoId && atual.produto && !atual.produto.permiteEstoqueNegativo) {
      const qtd = arredondarQtd(decimalParaNumero(atual.quantidade) ?? 0)
      const atualSaldos = await servicoDeEstoque.obterSaldosAtuais(
        params.companyId,
        atual.produtoId
      )
      const disp = calcularQtdDisponivel(atualSaldos.saldos)
      if (disp < qtd) {
        throw new ErroDaAplicacao(
          `Estoque disponível insuficiente (disponível: ${disp}, pedido: ${qtd}).`,
          409
        )
      }
    }
    row = await repositorioDeRequisicoesWms.executarEmTransacao(async (tx) => {
      if (precisaKardexIniciar) {
        await aplicarReserva(tx, atual, params.usuarioId)
      }
      if (precisaKardexCancelar) {
        await aplicarEstornoReserva(tx, atual, params.usuarioId)
      }
      if (precisaKardexConcluir) {
        await aplicarEstornoReserva(tx, atual, params.usuarioId)
        await aplicarSaidaFisica(tx, atual, params.usuarioId)
      }
      return repositorioDeRequisicoesWms.atualizarNoTx(
        tx,
        params.companyId,
        params.id,
        patch,
        evento
      )
    })
  } else {
    row = await repositorioDeRequisicoesWms.atualizar(
      params.companyId,
      params.id,
      patch,
      evento
    )
  }

  await registrarAuditoria({
    usuarioId: params.usuarioId,
    acao: params.acao,
    entidade: 'requisicao_wms',
    entidadeId: params.id,
    valoresAntes: { status: atual.status },
    valoresDepois: { status: para },
  })
  return mapear(row)
}

async function conferir(
  companyId: string,
  id: string,
  usuarioId: string,
  dados: DadosConferirRequisicao
) {
  const atual = await obterOu404(companyId, id)
  if (atual.tipoOperacao === 'contagem_entrada') {
    throw new ErroDaAplicacao('Contagem de entrada é conferida na tela Contagens.', 400)
  }
  if (atual.status !== 'em_execucao') {
    throw new ErroDaAplicacao('Só é possível conferir com a requisição em execução', 409)
  }
  exigirOperador(atual, usuarioId)

  const exigidos = passosExigidos(camposOs(atual))
  if (!exigidos.includes(dados.etapa)) {
    throw new ErroDaAplicacao('Esta etapa não é exigida nesta requisição', 400)
  }

  const agora = new Date()
  const valor = dados.valor.trim()
  const patch: Prisma.RequisicaoWmsUncheckedUpdateInput = {}

  if (dados.etapa === 'origem') {
    const codigo = atual.origemEndereco?.codigoCompleto
    if (!enderecoConfere(codigo, valor)) {
      throw new ErroDaAplicacao('Origem conferida não confere com a ordem', 400)
    }
    if (!enderecoOperacionalOk(atual.origemEndereco)) {
      throw new ErroDaAplicacao('Endereço de origem inativo ou bloqueado', 409)
    }
    patch.conferidoOrigemEm = agora
    patch.conferidoOrigemValor = valor
  } else if (dados.etapa === 'destino') {
    const codigo = atual.destinoEndereco?.codigoCompleto
    if (!enderecoConfere(codigo, valor)) {
      throw new ErroDaAplicacao('Destino conferido não confere com a ordem', 400)
    }
    if (!enderecoOperacionalOk(atual.destinoEndereco)) {
      throw new ErroDaAplicacao('Endereço de destino inativo ou bloqueado', 409)
    }
    patch.conferidoDestinoEm = agora
    patch.conferidoDestinoValor = valor
  } else if (dados.etapa === 'produto') {
    const barrasMaster = (atual.produto?.embalagensMaster ?? [])
      .map((e) => e.codigoBarras)
      .filter((c): c is string => Boolean(c?.trim()))
    const ok =
      produtoConfere({
        sku: atual.produto?.sku,
        codigoBarras: atual.produto?.codigoBarras,
        gtin: barrasMaster[0] ?? null,
        informado: valor,
      }) || barrasMaster.some((c) => produtoConfere({ sku: null, codigoBarras: c, gtin: null, informado: valor }))
    if (!ok) {
      throw new ErroDaAplicacao('Produto conferido não confere com a ordem', 400)
    }
    patch.conferidoProdutoEm = agora
    patch.conferidoProdutoValor = valor
  } else {
    const esperada = decimalParaNumero(atual.quantidade)
    const informada = Number(String(valor).replace(',', '.'))
    if (esperada == null || !quantidadeConfere(esperada, informada)) {
      throw new ErroDaAplicacao('Quantidade conferida não confere com a ordem', 400)
    }
    patch.qtdExecutada = arredondarQtd(informada)
  }

  const row = await repositorioDeRequisicoesWms.atualizar(companyId, id, patch, {
    usuarioId,
    acao: `conferir_${dados.etapa}`,
    deStatus: atual.status,
    paraStatus: atual.status,
    motivo: valor,
  })
  return mapear(row)
}

async function listarOperadores(companyId: string) {
  exigirEmpresa(companyId)
  return repositorioDeRequisicoesWms.listarOperadores(companyId)
}

export const servicoDeRequisicoesWms = {
  criar,
  listar,
  buscar,
  editar,
  transicionar,
  conferir,
  listarOperadores,
}
