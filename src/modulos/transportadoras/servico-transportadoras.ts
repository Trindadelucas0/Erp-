/**
 * Regras de negócio para transportadoras.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { normalizarCnpj, normalizarCpf } from '../../compartilhado/validacoes/documentos.js'
import { repositorioDeTransportadoras } from './repositorio-transportadoras.js'
import type { DadosParaCriarTransportadora, DadosParaEditarTransportadora } from './esquema-transportadoras.js'

async function listarTransportadoras(companyId: string) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada. Selecione uma empresa.', 400)
  }
  return repositorioDeTransportadoras.listarPorEmpresa(companyId)
}

async function criarTransportadora(
  dados: DadosParaCriarTransportadora,
  companyId: string,
  idDoAutor: string
) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }

  const documento =
    dados.tipo === 'PF'
      ? (dados.cpf ? normalizarCpf(dados.cpf) : undefined)
      : (dados.cnpj ? normalizarCnpj(dados.cnpj) : undefined)

  if (documento) {
    const busca = await repositorioDeTransportadoras.buscarPessoaPorDocumentoNaEmpresa(
      documento,
      companyId
    )
    if (busca.temPapelTransportadora && busca.pessoa?.ativo) {
      throw new ErroDaAplicacao(
        dados.tipo === 'PF'
          ? 'CPF já cadastrado como transportadora nesta empresa'
          : 'CNPJ já cadastrado como transportadora nesta empresa',
        400
      )
    }
  }

  const transportadora = await repositorioDeTransportadoras.criar(dados, companyId)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'criar',
    entidade: 'transportadora',
    entidadeId: transportadora.id,
    valoresDepois: { nome: dados.nome, tipo: dados.tipo },
  })

  return transportadora
}

async function editarTransportadora(
  id: string,
  dados: DadosParaEditarTransportadora,
  companyId: string,
  idDoAutor: string
) {
  const existente = await repositorioDeTransportadoras.buscarPorId(id)

  if (!existente || existente.companyId !== companyId) {
    throw new ErroDaAplicacao('Transportadora não encontrada', 404)
  }

  if (dados.tipo === 'PF' && dados.cpf) {
    const outro = await repositorioDeTransportadoras.buscarPorCpfNaEmpresa(dados.cpf, companyId)
    if (outro && outro.id !== id) {
      throw new ErroDaAplicacao('CPF já cadastrado como transportadora nesta empresa', 400)
    }
  }

  if (dados.tipo === 'PJ' && dados.cnpj) {
    const outro = await repositorioDeTransportadoras.buscarPorCnpjNaEmpresa(dados.cnpj, companyId)
    if (outro && outro.id !== id) {
      throw new ErroDaAplicacao('CNPJ já cadastrado como transportadora nesta empresa', 400)
    }
  }

  const atualizado = await repositorioDeTransportadoras.atualizar(id, dados)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'editar',
    entidade: 'transportadora',
    entidadeId: id,
    valoresDepois: { nome: dados.nome, tipo: dados.tipo },
  })

  return atualizado
}

async function alterarStatusDaTransportadora(
  id: string,
  ativo: boolean,
  companyId: string,
  idDoAutor: string
) {
  const existente = await repositorioDeTransportadoras.buscarPorId(id)

  if (!existente || existente.companyId !== companyId) {
    throw new ErroDaAplicacao('Transportadora não encontrada', 404)
  }

  const atualizado = await repositorioDeTransportadoras.alterarStatus(id, ativo)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: ativo ? 'reativar' : 'desativar',
    entidade: 'transportadora',
    entidadeId: id,
    valoresDepois: { ativo },
  })

  return atualizado
}

async function buscarTransportadoraPorDocumento(documento: string, companyId: string) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }
  return repositorioDeTransportadoras.buscarPessoaPorDocumentoNaEmpresa(documento, companyId)
}

export const servicoDeTransportadoras = {
  listarTransportadoras,
  criarTransportadora,
  editarTransportadora,
  alterarStatusDaTransportadora,
  buscarTransportadoraPorDocumento,
}
