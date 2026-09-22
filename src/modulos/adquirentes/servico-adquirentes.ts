import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import type {
  DadosParaCriarAdquirente,
  DadosParaEditarAdquirente,
} from './esquema-adquirentes.js'
import { repositorioDeAdquirentes } from './repositorio-adquirentes.js'

async function garantirNomeUnico(companyId: string, nome: string, excluirId?: string) {
  const duplicada = await repositorioDeAdquirentes.buscarPorNome(companyId, nome, excluirId)
  if (duplicada) {
    throw new ErroDaAplicacao('Já existe uma adquirente com este nome nesta empresa', 400)
  }
}

async function listar(
  companyId: string,
  filtro: { q?: string; incluirInativos?: boolean; somenteAtivos?: boolean }
) {
  return repositorioDeAdquirentes.listar(companyId, filtro)
}

async function obter(companyId: string, id: string) {
  const registro = await repositorioDeAdquirentes.buscarPorId(companyId, id)
  if (!registro) throw new ErroDaAplicacao('Adquirente não encontrada', 404)
  return registro
}

async function criar(companyId: string, dados: DadosParaCriarAdquirente, usuarioId: string) {
  await garantirNomeUnico(companyId, dados.nome)
  const registro = await repositorioDeAdquirentes.criar(companyId, {
    nome: dados.nome,
    ativo: dados.ativo !== false,
  })

  await registrarAuditoria({
    usuarioId,
    acao: 'criar',
    entidade: 'Adquirente',
    entidadeId: registro.id,
    valoresDepois: { nome: registro.nome, ativo: registro.ativo },
  })

  return registro
}

async function editar(
  companyId: string,
  id: string,
  dados: DadosParaEditarAdquirente,
  usuarioId: string
) {
  const existente = await repositorioDeAdquirentes.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Adquirente não encontrada', 404)

  await garantirNomeUnico(companyId, dados.nome, id)
  const registro = await repositorioDeAdquirentes.atualizar(companyId, id, {
    nome: dados.nome,
    ativo: dados.ativo,
  })
  if (!registro) throw new ErroDaAplicacao('Adquirente não encontrada', 404)

  await registrarAuditoria({
    usuarioId,
    acao: 'editar',
    entidade: 'Adquirente',
    entidadeId: registro.id,
    valoresAntes: { nome: existente.nome, ativo: existente.ativo },
    valoresDepois: { nome: registro.nome, ativo: registro.ativo },
  })

  return registro
}

async function alterarStatus(
  companyId: string,
  id: string,
  ativo: boolean,
  usuarioId: string
) {
  const existente = await repositorioDeAdquirentes.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Adquirente não encontrada', 404)

  const registro = await repositorioDeAdquirentes.alterarStatus(companyId, id, ativo)
  if (!registro) throw new ErroDaAplicacao('Adquirente não encontrada', 404)

  await registrarAuditoria({
    usuarioId,
    acao: 'editar',
    entidade: 'Adquirente',
    entidadeId: registro.id,
    valoresAntes: { ativo: existente.ativo },
    valoresDepois: { ativo: registro.ativo },
  })

  return registro
}

export const servicoDeAdquirentes = {
  listar,
  obter,
  criar,
  editar,
  alterarStatus,
}
