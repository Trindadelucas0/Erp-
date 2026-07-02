import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import {
  codigoCompativelComTipo,
  codigoInicialSemPai,
  proximoCodigoFilho,
  raizDoTipo,
  type TipoPlanoFinanceiro,
} from './codigo-plano-financeiro.js'
import {
  codigoProfundidadeValido,
  sanitizarProfundidadeEmMemoria,
} from './profundidade-plano-financeiro.js'
import {
  ErroMovimentoPlano,
  executarMovimentoEmMemoria,
} from './logica-mover-plano-financeiro.js'
import { repositorioDePlanosFinanceiros } from './repositorio-planos-financeiros.js'
import type {
  DadosParaCriarPlanoFinanceiro,
  DadosParaEditarPlanoFinanceiro,
  DadosParaMoverPlanoFinanceiro,
} from './esquema-planos-financeiros.js'

function paraRespostaApi(plano: ReturnType<typeof repositorioDePlanosFinanceiros.mapear>) {
  return {
    ...plano,
    descricao: plano.nome,
  }
}

function montarArvore(
  planos: Awaited<ReturnType<typeof repositorioDePlanosFinanceiros.listarPorEmpresa>>
) {
  const mapa = new Map<string, ReturnType<typeof paraRespostaApi> & { filhos: unknown[] }>()
  const raizes: (ReturnType<typeof paraRespostaApi> & { filhos: unknown[] })[] = []
  const parentPorId = new Map(planos.map((p) => [p.id, p.parentId]))

  for (const plano of planos) {
    mapa.set(plano.id, { ...paraRespostaApi(repositorioDePlanosFinanceiros.mapear(plano)), filhos: [] })
  }

  for (const plano of planos) {
    const no = mapa.get(plano.id)!
    if (plano.parentId && mapa.has(plano.parentId)) {
      const paiParentId = parentPorId.get(plano.parentId)
      if (paiParentId === null || paiParentId === undefined) {
        mapa.get(plano.parentId)!.filhos.push(no)
      } else {
        raizes.push(no)
      }
    } else {
      raizes.push(no)
    }
  }

  return raizes
}

async function sanitizarPlanosSeNecessario(
  companyId: string,
  planos: Awaited<ReturnType<typeof repositorioDePlanosFinanceiros.listarPorEmpresa>>,
  tipo: TipoPlanoFinanceiro
) {
  const estadoInicial = planos.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    parentId: p.parentId,
  }))

  const updates = sanitizarProfundidadeEmMemoria(estadoInicial, tipo)
  if (updates.length === 0) return planos

  try {
    await repositorioDePlanosFinanceiros.atualizarPosicaoEmLote(updates)
  } catch (erro) {
    console.error(
      `[planos-financeiros] Falha ao sanitizar profundidade (tipo=${tipo}, companyId=${companyId}):`,
      erro
    )
    return planos
  }

  const atualizadosPorId = new Map(updates.map((u) => [u.id, u]))
  return planos.map((plano) => {
    const patch = atualizadosPorId.get(plano.id)
    if (!patch) return plano
    return {
      ...plano,
      codigo: patch.codigo,
      parentId: patch.parentId !== undefined ? patch.parentId : plano.parentId,
    }
  })
}

async function listarParaGestao(
  companyId: string,
  tipo?: TipoPlanoFinanceiro,
  incluirInativos = true,
  q?: string
) {
  let planos = await repositorioDePlanosFinanceiros.listarPorEmpresa(companyId, {
    tipo,
    incluirInativos,
    q,
  })

  if (tipo) {
    planos = await sanitizarPlanosSeNecessario(companyId, planos, tipo)
  }

  return {
    planos: planos.map((p) => paraRespostaApi(repositorioDePlanosFinanceiros.mapear(p))),
    arvore: montarArvore(planos),
  }
}

async function listarParaCatalogo(
  companyId: string,
  q?: string,
  tipo?: TipoPlanoFinanceiro,
  somenteSubgrupo?: boolean
) {
  const folhas = await repositorioDePlanosFinanceiros.listarFolhasAtivas(
    companyId,
    q,
    tipo,
    somenteSubgrupo
  )
  return folhas.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    descricao: p.nome,
    tipo: p.tipo,
  }))
}

async function buscarPorId(companyId: string, id: string) {
  const plano = await repositorioDePlanosFinanceiros.buscarPorId(companyId, id)
  if (!plano) throw new ErroDaAplicacao('Plano financeiro não encontrado', 404)
  return paraRespostaApi(repositorioDePlanosFinanceiros.mapear(plano))
}

async function sugerirProximoCodigo(companyId: string, tipo: TipoPlanoFinanceiro, parentId?: string | null) {
  if (parentId) {
    const pai = await repositorioDePlanosFinanceiros.buscarPorId(companyId, parentId)
    if (!pai) throw new ErroDaAplicacao('Plano pai não encontrado', 404)
    if (pai.tipo !== tipo) throw new ErroDaAplicacao('Plano pai deve ser do mesmo tipo', 400)

    const irmaos = await repositorioDePlanosFinanceiros.listarFilhosDiretos(companyId, parentId)
    return proximoCodigoFilho(
      pai.codigo,
      irmaos.map((i) => i.codigo)
    )
  }

  const codigos = await repositorioDePlanosFinanceiros.listarCodigosPorEmpresa(companyId, tipo)
  return codigoInicialSemPai(tipo, codigos)
}

async function validarPai(companyId: string, tipo: TipoPlanoFinanceiro, parentId?: string | null) {
  if (!parentId) return

  const pai = await repositorioDePlanosFinanceiros.buscarPorId(companyId, parentId)
  if (!pai) throw new ErroDaAplicacao('Plano pai não encontrado', 404)
  if (pai.tipo !== tipo) throw new ErroDaAplicacao('Plano pai deve ser do mesmo tipo', 400)
  if (!pai.ativo) throw new ErroDaAplicacao('Plano pai está inativo', 400)
  if (pai.parentId) {
    throw new ErroDaAplicacao(
      'Só é permitido criar subgrupo dentro de um grupo de 1º nível',
      400
    )
  }
}

async function criarPlano(
  companyId: string,
  dados: DadosParaCriarPlanoFinanceiro,
  idDoAutor: string
) {
  await validarPai(companyId, dados.tipo, dados.parentId)

  const codigo =
    dados.codigo?.trim() ||
    (await sugerirProximoCodigo(companyId, dados.tipo, dados.parentId))

  if (!codigoCompativelComTipo(codigo, dados.tipo)) {
    throw new ErroDaAplicacao(
      `Código deve começar com ${raizDoTipo(dados.tipo)} para ${dados.tipo}`,
      400
    )
  }

  if (!codigoProfundidadeValido(codigo)) {
    throw new ErroDaAplicacao(
      'Código excede a profundidade máxima permitida (grupo + subgrupo)',
      400
    )
  }

  const duplicado = await repositorioDePlanosFinanceiros.buscarPorCodigo(companyId, codigo)
  if (duplicado) throw new ErroDaAplicacao('Código já cadastrado nesta empresa', 400)

  const plano = await repositorioDePlanosFinanceiros.criar(companyId, { ...dados, codigo })

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'criar',
    entidade: 'planoFinanceiro',
    entidadeId: plano.id,
    valoresDepois: { codigo: plano.codigo, nome: plano.nome },
  })

  return paraRespostaApi(plano)
}

async function editarPlano(
  companyId: string,
  id: string,
  dados: DadosParaEditarPlanoFinanceiro,
  idDoAutor: string
) {
  const existente = await repositorioDePlanosFinanceiros.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Plano financeiro não encontrado', 404)

  const plano = await repositorioDePlanosFinanceiros.atualizar(companyId, id, dados)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'editar',
    entidade: 'planoFinanceiro',
    entidadeId: plano.id,
    valoresDepois: { nome: plano.nome },
  })

  return paraRespostaApi(plano)
}

async function alterarStatus(companyId: string, id: string, ativo: boolean, idDoAutor: string) {
  const existente = await repositorioDePlanosFinanceiros.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Plano financeiro não encontrado', 404)

  if (!ativo) {
    const filhosAtivos = await repositorioDePlanosFinanceiros.contarFilhosAtivos(companyId, id)
    if (filhosAtivos > 0) {
      throw new ErroDaAplicacao('Desative os planos filhos antes de desativar este plano', 400)
    }
  }

  const plano = await repositorioDePlanosFinanceiros.alterarAtivo(companyId, id, ativo)
  if (!plano) throw new ErroDaAplicacao('Plano financeiro não encontrado', 404)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: ativo ? 'reativar' : 'desativar',
    entidade: 'planoFinanceiro',
    entidadeId: plano.id,
  })

  return paraRespostaApi(plano)
}

async function moverPlano(
  companyId: string,
  planoId: string,
  dados: DadosParaMoverPlanoFinanceiro,
  idDoAutor: string
) {
  const registroInicial = await repositorioDePlanosFinanceiros.buscarPorId(companyId, planoId)
  if (!registroInicial) throw new ErroDaAplicacao('Plano financeiro não encontrado', 404)

  const tipo = registroInicial.tipo as TipoPlanoFinanceiro
  const todos = await repositorioDePlanosFinanceiros.listarPorEmpresaParaMover(companyId, tipo)

  const plano = todos.find((p) => p.id === planoId)
  if (!plano) throw new ErroDaAplicacao('Plano financeiro não encontrado', 404)

  const alvo = todos.find((p) => p.id === dados.alvoId)
  if (!alvo) throw new ErroDaAplicacao('Plano alvo não encontrado', 404)

  if (plano.tipo !== alvo.tipo) {
    throw new ErroDaAplicacao('Plano e alvo devem ser do mesmo tipo', 400)
  }

  const codigoAntes = plano.codigo
  const parentIdAntigo = plano.parentId

  let updates: { id: string; codigo: string; parentId?: string | null }[]
  try {
    const resultado = executarMovimentoEmMemoria(
      todos.map((p) => ({ id: p.id, codigo: p.codigo, parentId: p.parentId })),
      tipo,
      planoId,
      dados.alvoId,
      dados.posicao
    )
    updates = resultado.updates
  } catch (erro) {
    if (erro instanceof ErroMovimentoPlano) {
      throw new ErroDaAplicacao(erro.message, 400)
    }
    throw erro
  }

  if (updates.length === 0) {
    return paraRespostaApi(repositorioDePlanosFinanceiros.mapear(plano))
  }

  try {
    await repositorioDePlanosFinanceiros.atualizarPosicaoEmLote(updates)
  } catch {
    throw new ErroDaAplicacao(
      'Não foi possível mover o plano. Verifique se outro usuário alterou a estrutura.',
      409
    )
  }

  const atualizado = await repositorioDePlanosFinanceiros.buscarPorId(companyId, planoId)
  if (!atualizado) throw new ErroDaAplicacao('Plano financeiro não encontrado', 404)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'mover',
    entidade: 'planoFinanceiro',
    entidadeId: planoId,
    valoresAntes: { codigo: codigoAntes, parentId: parentIdAntigo },
    valoresDepois: { codigo: atualizado.codigo, parentId: atualizado.parentId },
  })

  return paraRespostaApi(repositorioDePlanosFinanceiros.mapear(atualizado))
}

export const servicoDePlanosFinanceiros = {
  listarParaGestao,
  listarParaCatalogo,
  buscarPorId,
  sugerirProximoCodigo,
  criarPlano,
  editarPlano,
  alterarStatus,
  moverPlano,
}
