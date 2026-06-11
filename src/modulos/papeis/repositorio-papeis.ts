/**
 * Acesso ao banco de dados para papéis (roles).
 */
import { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

const camposDoPapel = {
  id: true,
  name: true,
  description: true,
  permissions: {
    include: {
      permission: true,
    },
  },
} as const

/**
 * Lista todos os papéis cadastrados com suas permissões.
 * @returns Lista de papéis ordenada por nome
 */
async function listarTodos() {
  return clientePrisma.role.findMany({
    orderBy: { name: 'asc' },
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  })
}

/**
 * Busca um papel pelo ID com suas permissões.
 * @param idDoPapel - UUID do papel
 * @returns Papel ou null
 */
async function buscarPorId(idDoPapel: string) {
  return clientePrisma.role.findUnique({
    where: { id: idDoPapel },
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  })
}

/**
 * Substitui as permissões vinculadas a um papel.
 * @param idDoPapel - UUID do papel
 * @param idsDasPermissoes - IDs das permissões selecionadas
 * @returns Papel atualizado
 */
async function atualizarPermissoesDoPapel(
  idDoPapel: string,
  idsDasPermissoes: string[]
) {
  return clientePrisma.$transaction(async (transacao: Prisma.TransactionClient) => {
    await transacao.rolePermission.deleteMany({
      where: { roleId: idDoPapel },
    })

    if (idsDasPermissoes.length > 0) {
      await transacao.rolePermission.createMany({
        data: idsDasPermissoes.map((permissionId) => ({
          roleId: idDoPapel,
          permissionId,
        })),
      })
    }

    return transacao.role.findUnique({
      where: { id: idDoPapel },
      select: camposDoPapel,
    })
  })
}

export const repositorioDePapeis = {
  listarTodos,
  buscarPorId,
  atualizarPermissoesDoPapel,
}
