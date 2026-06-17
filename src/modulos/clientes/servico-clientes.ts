/**
 * Regras de negócio para clientes.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { repositorioDeClientes } from './repositorio-clientes.js'
import type { DadosParaCriarCliente, DadosParaEditarCliente } from './esquema-clientes.js'

async function listarClientes(companyId: string) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada. Selecione uma empresa.', 400)
  }
  return repositorioDeClientes.listarPorEmpresa(companyId)
}

async function criarCliente(
  dados: DadosParaCriarCliente,
  companyId: string,
  idDoAutor: string
) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }

  if (dados.tipo === 'PF' && dados.cpf) {
    const existente = await repositorioDeClientes.buscarPorCpfNaEmpresa(dados.cpf, companyId)
    if (existente) {
      throw new ErroDaAplicacao('CPF já cadastrado nesta empresa', 400)
    }
  }

  if (dados.tipo === 'PJ' && dados.cnpj) {
    const existente = await repositorioDeClientes.buscarPorCnpjNaEmpresa(dados.cnpj, companyId)
    if (existente) {
      throw new ErroDaAplicacao('CNPJ já cadastrado nesta empresa', 400)
    }
  }

  const cliente = await repositorioDeClientes.criar(dados, companyId)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'criar',
    entidade: 'cliente',
    entidadeId: cliente.id,
    valoresDepois: { nome: dados.nome, tipo: dados.tipo },
  })

  return cliente
}

async function editarCliente(
  id: string,
  dados: DadosParaEditarCliente,
  companyId: string,
  idDoAutor: string
) {
  const clienteExistente = await repositorioDeClientes.buscarPorId(id)

  if (!clienteExistente || clienteExistente.companyId !== companyId) {
    throw new ErroDaAplicacao('Cliente não encontrado', 404)
  }

  if (dados.tipo === 'PF' && dados.cpf) {
    const existente = await repositorioDeClientes.buscarPorCpfNaEmpresa(dados.cpf, companyId)
    if (existente && existente.id !== id) {
      throw new ErroDaAplicacao('CPF já cadastrado nesta empresa', 400)
    }
  }

  if (dados.tipo === 'PJ' && dados.cnpj) {
    const existente = await repositorioDeClientes.buscarPorCnpjNaEmpresa(dados.cnpj, companyId)
    if (existente && existente.id !== id) {
      throw new ErroDaAplicacao('CNPJ já cadastrado nesta empresa', 400)
    }
  }

  const atualizado = await repositorioDeClientes.atualizar(id, dados)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'editar',
    entidade: 'cliente',
    entidadeId: id,
    valoresDepois: { nome: dados.nome, tipo: dados.tipo },
  })

  return atualizado
}

async function alterarStatusDoCliente(
  id: string,
  ativo: boolean,
  companyId: string,
  idDoAutor: string
) {
  const clienteExistente = await repositorioDeClientes.buscarPorId(id)

  if (!clienteExistente || clienteExistente.companyId !== companyId) {
    throw new ErroDaAplicacao('Cliente não encontrado', 404)
  }

  const atualizado = await repositorioDeClientes.alterarStatus(id, ativo)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: ativo ? 'reativar' : 'desativar',
    entidade: 'cliente',
    entidadeId: id,
    valoresDepois: { ativo },
  })

  return atualizado
}

async function buscarClientePorDocumento(documento: string, companyId: string) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }
  return repositorioDeClientes.buscarPessoaPorDocumentoNaEmpresa(documento, companyId)
}

export const servicoDeClientes = {
  listarClientes,
  criarCliente,
  editarCliente,
  alterarStatusDoCliente,
  buscarClientePorDocumento,
}
