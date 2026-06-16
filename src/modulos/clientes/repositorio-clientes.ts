/**
 * Acesso ao banco de dados para clientes.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { DadosParaCriarCliente, DadosParaEditarCliente } from './esquema-clientes.js'

function limparNumeros(v?: string | null): string | null {
  return v ? v.replace(/\D/g, '') : null
}

function normalizarDocumento(dados: DadosParaCriarCliente | DadosParaEditarCliente) {
  const base = {
    tipo: dados.tipo,
    nome: dados.nome,
    email: dados.email || null,
    telefone: dados.telefone ? limparNumeros(dados.telefone) : null,
    celular: dados.celular ? limparNumeros(dados.celular) : null,
    cep: dados.cep ? limparNumeros(dados.cep) : null,
    logradouro: dados.logradouro || null,
    numero: dados.numero || null,
    complemento: dados.complemento || null,
    bairro: dados.bairro || null,
    cidade: dados.cidade || null,
    estado: dados.estado || null,
    codigoIbge: dados.codigoIbge || null,
    indicadorIe: dados.indicadorIe || '9',
    observacoes: dados.observacoes || null,
  }

  if (dados.tipo === 'PF') {
    return {
      ...base,
      cpf: limparNumeros(dados.cpf),
      rg: dados.rg || null,
      dataNascimento: dados.dataNascimento || null,
      cnpj: null,
      nomeFantasia: null,
      ie: null,
      im: null,
      suframa: null,
    }
  }

  return {
    ...base,
    cnpj: limparNumeros(dados.cnpj),
    nomeFantasia: dados.nomeFantasia || null,
    ie: dados.ie || null,
    im: dados.im || null,
    suframa: dados.suframa || null,
    cpf: null,
    rg: null,
    dataNascimento: null,
  }
}

async function listarPorEmpresa(companyId: string) {
  return clientePrisma.cliente.findMany({
    where: { companyId },
    orderBy: { nome: 'asc' },
  })
}

async function buscarPorId(id: string) {
  return clientePrisma.cliente.findUnique({ where: { id } })
}

async function buscarPorCpfNaEmpresa(cpf: string, companyId: string) {
  const cpfLimpo = cpf.replace(/\D/g, '')
  return clientePrisma.cliente.findFirst({
    where: { cpf: cpfLimpo, companyId },
  })
}

async function buscarPorCnpjNaEmpresa(cnpj: string, companyId: string) {
  const cnpjLimpo = cnpj.replace(/\D/g, '')
  return clientePrisma.cliente.findFirst({
    where: { cnpj: cnpjLimpo, companyId },
  })
}

async function criar(dados: DadosParaCriarCliente, companyId: string) {
  return clientePrisma.cliente.create({
    data: {
      ...normalizarDocumento(dados),
      companyId,
    },
  })
}

async function atualizar(id: string, dados: DadosParaEditarCliente) {
  return clientePrisma.cliente.update({
    where: { id },
    data: normalizarDocumento(dados),
  })
}

async function alterarStatus(id: string, ativo: boolean) {
  return clientePrisma.cliente.update({
    where: { id },
    data: { ativo },
  })
}

export const repositorioDeClientes = {
  listarPorEmpresa,
  buscarPorId,
  buscarPorCpfNaEmpresa,
  buscarPorCnpjNaEmpresa,
  criar,
  atualizar,
  alterarStatus,
}
