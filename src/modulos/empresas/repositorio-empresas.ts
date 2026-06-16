/**
 * Acesso ao banco de dados para empresas.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type {
  DadosParaCriarEmpresa,
  DadosParaEditarEmpresa,
} from './esquema-empresas.js'

/**
 * Lista todas as empresas ativas.
 */
async function listarTodasAtivas() {
  return clientePrisma.company.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  })
}

/**
 * Busca empresas vinculadas a um usuário (apenas ativas).
 */
async function buscarPorIdDoUsuario(idDoUsuario: string) {
  const vinculosEncontrados = await clientePrisma.userCompany.findMany({
    where: {
      userId: idDoUsuario,
      company: { active: true },
    },
    include: { company: true },
  })

  return vinculosEncontrados.map(
    (vinculo: (typeof vinculosEncontrados)[number]) => vinculo.company
  )
}

async function buscarPorId(idDaEmpresa: string) {
  return clientePrisma.company.findUnique({ where: { id: idDaEmpresa } })
}

async function buscarPorCnpj(cnpj: string) {
  const cnpjSomenteNumeros = cnpj.replace(/\D/g, '')
  return clientePrisma.company.findFirst({
    where: {
      cnpj: { in: [cnpj, cnpjSomenteNumeros] },
    },
  })
}

async function criar(dados: DadosParaCriarEmpresa) {
  return clientePrisma.company.create({
    data: {
      name: dados.nome,
      cnpj: dados.cnpj.replace(/\D/g, ''),
      phone: dados.phone || null,
      email: dados.email || null,
      cep: dados.cep?.replace(/\D/g, '') || null,
      logradouro: dados.logradouro || null,
      numero: dados.numero || null,
      complemento: dados.complemento || null,
      bairro: dados.bairro || null,
      cidade: dados.cidade || null,
      estado: dados.estado || null,
    },
  })
}

async function atualizar(idDaEmpresa: string, dados: DadosParaEditarEmpresa) {
  return clientePrisma.company.update({
    where: { id: idDaEmpresa },
    data: {
      name: dados.nome,
      cnpj: dados.cnpj.replace(/\D/g, ''),
      phone: dados.phone || null,
      email: dados.email || null,
      cep: dados.cep?.replace(/\D/g, '') || null,
      logradouro: dados.logradouro || null,
      numero: dados.numero || null,
      complemento: dados.complemento || null,
      bairro: dados.bairro || null,
      cidade: dados.cidade || null,
      estado: dados.estado || null,
    },
  })
}

async function alterarStatus(idDaEmpresa: string, ativo: boolean) {
  return clientePrisma.company.update({
    where: { id: idDaEmpresa },
    data: { active: ativo },
  })
}

export const repositorioDeEmpresas = {
  listarTodasAtivas,
  buscarPorIdDoUsuario,
  buscarPorId,
  buscarPorCnpj,
  criar,
  atualizar,
  alterarStatus,
}
