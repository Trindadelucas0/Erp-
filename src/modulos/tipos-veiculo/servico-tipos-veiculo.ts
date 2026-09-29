import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import type {
  DadosParaCriarTipoVeiculo,
  DadosParaEditarTipoVeiculo,
} from './esquema-tipos-veiculo.js'
import { repositorioDeTiposVeiculo } from './repositorio-tipos-veiculo.js'

const MSG_NAO_ENCONTRADO = 'Tipo de veículo não encontrado'

async function garantirNomeUnico(companyId: string, nome: string, excluirId?: string) {
  const duplicado = await repositorioDeTiposVeiculo.buscarPorNome(companyId, nome, excluirId)
  if (duplicado) {
    throw new ErroDaAplicacao('Já existe um tipo de veículo com este nome nesta empresa', 400)
  }
}

async function listar(
  companyId: string,
  filtro: { q?: string; incluirInativos?: boolean; somenteAtivos?: boolean }
) {
  return repositorioDeTiposVeiculo.listar(companyId, filtro)
}

async function obter(companyId: string, id: string) {
  const registro = await repositorioDeTiposVeiculo.buscarPorId(companyId, id)
  if (!registro) throw new ErroDaAplicacao(MSG_NAO_ENCONTRADO, 404)
  return registro
}

async function criar(companyId: string, dados: DadosParaCriarTipoVeiculo, usuarioId: string) {
  await garantirNomeUnico(companyId, dados.nome)
  const registro = await repositorioDeTiposVeiculo.criar(companyId, {
    nome: dados.nome,
    pesoMaximoKg: dados.pesoMaximoKg,
    icone: dados.icone ?? null,
    ativo: dados.ativo !== false,
  })

  await registrarAuditoria({
    usuarioId,
    acao: 'criar',
    entidade: 'TipoVeiculo',
    entidadeId: registro.id,
    valoresDepois: {
      nome: registro.nome,
      pesoMaximoKg: registro.pesoMaximoKg,
      icone: registro.icone,
      ativo: registro.ativo,
    },
  })

  return registro
}

async function editar(
  companyId: string,
  id: string,
  dados: DadosParaEditarTipoVeiculo,
  usuarioId: string
) {
  const existente = await repositorioDeTiposVeiculo.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao(MSG_NAO_ENCONTRADO, 404)

  await garantirNomeUnico(companyId, dados.nome, id)
  const registro = await repositorioDeTiposVeiculo.atualizar(companyId, id, {
    nome: dados.nome,
    pesoMaximoKg: dados.pesoMaximoKg,
    icone: dados.icone === undefined ? existente.icone : dados.icone,
    ativo: dados.ativo,
  })
  if (!registro) throw new ErroDaAplicacao(MSG_NAO_ENCONTRADO, 404)

  await registrarAuditoria({
    usuarioId,
    acao: 'editar',
    entidade: 'TipoVeiculo',
    entidadeId: registro.id,
    valoresAntes: {
      nome: existente.nome,
      pesoMaximoKg: existente.pesoMaximoKg,
      icone: existente.icone,
      ativo: existente.ativo,
    },
    valoresDepois: {
      nome: registro.nome,
      pesoMaximoKg: registro.pesoMaximoKg,
      icone: registro.icone,
      ativo: registro.ativo,
    },
  })

  return registro
}

async function alterarStatus(
  companyId: string,
  id: string,
  ativo: boolean,
  usuarioId: string
) {
  const existente = await repositorioDeTiposVeiculo.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao(MSG_NAO_ENCONTRADO, 404)

  const registro = await repositorioDeTiposVeiculo.alterarStatus(companyId, id, ativo)
  if (!registro) throw new ErroDaAplicacao(MSG_NAO_ENCONTRADO, 404)

  await registrarAuditoria({
    usuarioId,
    acao: 'editar',
    entidade: 'TipoVeiculo',
    entidadeId: registro.id,
    valoresAntes: { ativo: existente.ativo },
    valoresDepois: { ativo: registro.ativo },
  })

  return registro
}

export const servicoDeTiposVeiculo = {
  listar,
  obter,
  criar,
  editar,
  alterarStatus,
}
