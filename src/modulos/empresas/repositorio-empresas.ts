/**
 * Acesso ao banco de dados para empresas.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

/**
 * Lista todas as empresas ativas.
 * @returns Lista ordenada por nome
 */
async function listarTodasAtivas() {
  return clientePrisma.company.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  })
}

/**
 * Busca empresas vinculadas a um usuário.
 * @param idDoUsuario - UUID do usuário
 * @returns Lista de empresas que o usuário pode acessar
 */
async function buscarPorIdDoUsuario(idDoUsuario: string) {
  const vinculosEncontrados = await clientePrisma.userCompany.findMany({
    where: { userId: idDoUsuario },
    include: { company: true },
  })

  return vinculosEncontrados.map(
    (vinculo: (typeof vinculosEncontrados)[number]) => vinculo.company
  )
}

export const repositorioDeEmpresas = {
  listarTodasAtivas,
  buscarPorIdDoUsuario,
}
