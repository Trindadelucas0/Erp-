import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { inferirCfopDoCodigo } from './classificacao-cfop.js'
import { repositorioDeCfops } from './repositorio-cfops.js'
import type { DadosParaCriarCfop, DadosParaEditarCfop } from './esquema-cfops.js'

function paraRespostaApi(cfop: ReturnType<typeof repositorioDeCfops.mapear>) {
  return {
    ...cfop,
    descricaoCatalogo: cfop.nome,
  }
}

async function validarSugestaoEntrada(
  companyId: string,
  codigo: string,
  cfopSugestaoEntradaId: string | null | undefined,
  idAtual?: string
): Promise<string | null> {
  const id = cfopSugestaoEntradaId ?? null
  const classificacao = inferirCfopDoCodigo(codigo)

  if (classificacao.tipo !== 'saida') {
    if (id) {
      throw new ErroDaAplicacao('Sugestão de entrada só se aplica a CFOP de saída', 400)
    }
    return null
  }

  if (!id) return null

  if (idAtual && id === idAtual) {
    throw new ErroDaAplicacao('CFOP não pode ser sugestão de si mesmo', 400)
  }

  try {
    await repositorioDeCfops.validarIdsEntradaFornecedor(companyId, [id])
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'CFOP de sugestão inválido'
    throw new ErroDaAplicacao(mensagem, 400)
  }

  return id
}

async function validarPlanoFinanceiroPadrao(
  companyId: string,
  codigo: string,
  planoFinanceiroPadraoId: string | null | undefined
): Promise<string | null> {
  const id = planoFinanceiroPadraoId ?? null
  const classificacao = inferirCfopDoCodigo(codigo)
  if (classificacao.tipo !== 'entrada') {
    if (id) {
      throw new ErroDaAplicacao('Plano financeiro padrão só se aplica a CFOP de entrada', 400)
    }
    return null
  }
  if (!id) return null
  try {
    await repositorioDeCfops.validarPlanoFinanceiroAtivo(companyId, id)
  } catch (erro) {
    const mensagem =
      erro instanceof Error ? erro.message : 'Plano financeiro padrão inválido'
    throw new ErroDaAplicacao(mensagem, 400)
  }
  return id
}

async function listarParaGestao(
  companyId: string,
  q?: string,
  tipo?: string,
  subtipo?: string
) {
  const cfops = await repositorioDeCfops.listarPorEmpresa(companyId, {
    incluirInativos: true,
    q,
    tipo,
    subtipo,
  })
  return cfops.map((c) => paraRespostaApi(repositorioDeCfops.mapear(c)))
}

async function listarParaCatalogo(
  companyId: string,
  q?: string,
  tipo = 'entrada',
  subtipo?: string
) {
  const cfops = await repositorioDeCfops.listarPorEmpresa(companyId, { q, tipo, subtipo })
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

  const cfopSugestaoEntradaId = await validarSugestaoEntrada(
    companyId,
    dados.codigo,
    dados.cfopSugestaoEntradaId
  )
  const planoFinanceiroPadraoId = await validarPlanoFinanceiroPadrao(
    companyId,
    dados.codigo,
    dados.planoFinanceiroPadraoId
  )

  const cfop = await repositorioDeCfops.criar(companyId, {
    ...dados,
    cfopSugestaoEntradaId,
    planoFinanceiroPadraoId,
  })

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

  const cfopSugestaoEntradaId = await validarSugestaoEntrada(
    companyId,
    existente.codigo,
    dados.cfopSugestaoEntradaId,
    id
  )
  const planoFinanceiroPadraoId = await validarPlanoFinanceiroPadrao(
    companyId,
    existente.codigo,
    dados.planoFinanceiroPadraoId
  )

  const cfop = await repositorioDeCfops.atualizar(
    companyId,
    id,
    { ...dados, cfopSugestaoEntradaId, planoFinanceiroPadraoId },
    existente.codigo
  )

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'editar',
    entidade: 'cfop',
    entidadeId: cfop.id,
    valoresDepois: { nome: cfop.nome },
  })

  return paraRespostaApi(cfop)
}

async function excluirCfop(companyId: string, id: string, idDoAutor: string) {
  const existente = await repositorioDeCfops.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('CFOP não encontrado', 404)

  const uso = await repositorioDeCfops.contarUsoEmEntrada(companyId, id)
  if (uso > 0) {
    throw new ErroDaAplicacao(
      'Este CFOP está em uso na Entrada de notas e não pode ser excluído.',
      409
    )
  }

  const removidos = await repositorioDeCfops.remover(companyId, id)
  if (removidos === 0) throw new ErroDaAplicacao('CFOP não encontrado', 404)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'excluir',
    entidade: 'cfop',
    entidadeId: id,
    valoresAntes: { codigo: existente.codigo, nome: existente.nome },
  })
}

export const servicoDeCfops = {
  listarParaGestao,
  listarParaCatalogo,
  buscarPorId,
  criarCfop,
  editarCfop,
  excluirCfop,
}
