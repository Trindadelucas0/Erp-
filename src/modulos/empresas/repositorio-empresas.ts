/**
 * Acesso ao banco de dados para empresas.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

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
  return clientePrisma.company.findUnique({ where: { cnpj } })
}

async function criar(dados: { nome: string; cnpj: string }) {
  return clientePrisma.company.create({
    data: {
      name: dados.nome,
      cnpj: dados.cnpj,
    },
  })
}

async function atualizar(
  idDaEmpresa: string,
  dados: { nome: string; cnpj: string }
) {
  return clientePrisma.company.update({
    where: { id: idDaEmpresa },
    data: {
      name: dados.nome,
      cnpj: dados.cnpj,
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
