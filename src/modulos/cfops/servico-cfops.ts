import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { repositorioDeCfops } from './repositorio-cfops.js'
import type { DadosParaCriarCfop, DadosParaEditarCfop } from './esquema-cfops.js'

function paraRespostaApi(cfop: ReturnType<typeof repositorioDeCfops.mapear>) {
  return {
    ...cfop,
    descricaoCatalogo: cfop.nome,
  }
}

async function listarParaGestao(companyId: string, q?: string, tipo?: string) {
  const cfops = await repositorioDeCfops.listarPorEmpresa(companyId, {
    incluirInativos: true,
    q,
    tipo,
  })
  return cfops.map((c) => paraRespostaApi(repositorioDeCfops.mapear(c)))
}

async function listarParaCatalogo(companyId: string, q?: string, tipo = 'entrada') {
  const cfops = await repositorioDeCfops.listarPorEmpresa(companyId, { q, tipo })
  return cfops.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    descricao: c.nome,
  }))
}

async function buscarPorId(companyId: string, id: string) {
  const cfop = await repositorioDeCfops.buscarPorId(companyId, id)
  if (!cfop) throw new ErroDaAplicacao('CFOP não encontrado', 404)
  return paraRespostaApi(repositorioDeCfops.mapear(cfop))
}

async function criarCfop(companyId: string, dados: DadosParaCriarCfop, idDoAutor: string) {
  const duplicado = await repositorioDeCfops.buscarPorCodigo(companyId, dados.codigo)
  if (duplicado) throw new ErroDaAplicacao('Código CFOP já cadastrado nesta empresa', 400)

  const cfop = await repositorioDeCfops.criar(companyId, dados)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'criar',
    entidade: 'cfop',
    entidadeId: cfop.id,
    valoresDepois: { codigo: cfop.codigo, nome: cfop.nome },
  })

  return paraRespostaApi(cfop)
}

async function editarCfop(
  companyId: string,
  id: string,
  dados: DadosParaEditarCfop,
  idDoAutor: string
) {
  const existente = await repositorioDeCfops.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('CFOP não encontrado', 404)

  const cfop = await repositorioDeCfops.atualizar(companyId, id, dados)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'editar',
    entidade: 'cfop',
    entidadeId: cfop.id,
    valoresDepois: { nome: cfop.nome },
  })

  return paraRespostaApi(cfop)
}

async function alterarStatus(companyId: string, id: string, ativo: boolean, idDoAutor: string) {
  const existente = await repositorioDeCfops.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('CFOP não encontrado', 404)

  const cfop = await repositorioDeCfops.alterarAtivo(companyId, id, ativo)
  if (!cfop) throw new ErroDaAplicacao('CFOP não encontrado', 404)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: ativo ? 'reativar' : 'desativar',
    entidade: 'cfop',
    entidadeId: cfop.id,
  })

  return paraRespostaApi(cfop)
}

export const servicoDeCfops = {
  listarParaGestao,
  listarParaCatalogo,
  buscarPorId,
  criarCfop,
  editarCfop,
  alterarStatus,
}
