import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import {
  codigoCompativelComTipo,
  codigoInicialSemPai,
  proximoCodigoFilho,
  raizDoTipo,
  type TipoPlanoFinanceiro,
} from './codigo-plano-financeiro.js'
import { repositorioDePlanosFinanceiros } from './repositorio-planos-financeiros.js'
import type {
  DadosParaCriarPlanoFinanceiro,
  DadosParaEditarPlanoFinanceiro,
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

  for (const plano of planos) {
    mapa.set(plano.id, { ...paraRespostaApi(repositorioDePlanosFinanceiros.mapear(plano)), filhos: [] })
  }

  for (const plano of planos) {
    const no = mapa.get(plano.id)!
    if (plano.parentId && mapa.has(plano.parentId)) {
      mapa.get(plano.parentId)!.filhos.push(no)
    } else {
      raizes.push(no)
    }
  }

  return raizes
}

async function listarParaGestao(
  companyId: string,
  tipo?: TipoPlanoFinanceiro,
  incluirInativos = true,
  q?: string
) {
  const planos = await repositorioDePlanosFinanceiros.listarPorEmpresa(companyId, {
    tipo,
    incluirInativos,
    q,
  })
  return {
    planos: planos.map((p) => paraRespostaApi(repositorioDePlanosFinanceiros.mapear(p))),
    arvore: montarArvore(planos),
  }
}

async function listarParaCatalogo(companyId: string, q?: string) {
  const folhas = await repositorioDePlanosFinanceiros.listarFolhasAtivas(companyId, q)
  return folhas.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    descricao: p.nome,
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

export const servicoDePlanosFinanceiros = {
  listarParaGestao,
  listarParaCatalogo,
  buscarPorId,
  sugerirProximoCodigo,
  criarPlano,
  editarPlano,
  alterarStatus,
}
