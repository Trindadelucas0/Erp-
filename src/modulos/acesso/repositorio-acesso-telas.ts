/**
 * Telas e abas concedidas aos papéis do usuário.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

async function usuarioEhAdmin(idDoUsuario: string): Promise<boolean> {
  const count = await clientePrisma.userRole.count({
    where: { userId: idDoUsuario, role: { name: 'admin' } },
  })
  return count > 0
}

async function buscarRoleIdsDoUsuario(idDoUsuario: string): Promise<string[]> {
  const rows = await clientePrisma.userRole.findMany({
    where: { userId: idDoUsuario },
    select: { roleId: true },
  })
  return rows.map((r) => r.roleId)
}

async function usuarioPossuiPagina(
  idDoUsuario: string,
  pageKey: string
): Promise<boolean> {
  const roleIds = await buscarRoleIdsDoUsuario(idDoUsuario)
  if (roleIds.length === 0) return false

  const count = await clientePrisma.rolePageAccess.count({
    where: { roleId: { in: roleIds }, pageKey },
  })
  return count > 0
}

async function usuarioPossuiAba(
  idDoUsuario: string,
  pageKey: string,
  tabKey: string
): Promise<boolean> {
  const roleIds = await buscarRoleIdsDoUsuario(idDoUsuario)
  if (roleIds.length === 0) return false

  const count = await clientePrisma.roleTabAccess.count({
    where: { roleId: { in: roleIds }, pageKey, tabKey },
  })
  return count > 0
}

async function buscarPaginasPorRoleIds(roleIds: string[]): Promise<string[]> {
  if (roleIds.length === 0) return []
  const rows = await clientePrisma.rolePageAccess.findMany({
    where: { roleId: { in: roleIds } },
    select: { pageKey: true },
    distinct: ['pageKey'],
  })
  return rows.map((r) => r.pageKey)
}

async function buscarAbasPorRoleIds(
  roleIds: string[]
): Promise<Array<{ pageKey: string; tabKey: string }>> {
  if (roleIds.length === 0) return []
  return clientePrisma.roleTabAccess.findMany({
    where: { roleId: { in: roleIds } },
    select: { pageKey: true, tabKey: true },
  })
}

async function buscarTelasDoPapel(idDoPapel: string) {
  const [paginas, abas] = await Promise.all([
    clientePrisma.rolePageAccess.findMany({
      where: { roleId: idDoPapel },
      select: { pageKey: true },
    }),
    clientePrisma.roleTabAccess.findMany({
      where: { roleId: idDoPapel },
      select: { pageKey: true, tabKey: true },
    }),
  ])
  return { paginas, abas }
}

async function substituirTelasDoPapel(
  idDoPapel: string,
  telas: Array<{ pageKey: string; abas: string[] }>
) {
  return clientePrisma.$transaction(async (tx) => {
    await tx.roleTabAccess.deleteMany({ where: { roleId: idDoPapel } })
    await tx.rolePageAccess.deleteMany({ where: { roleId: idDoPapel } })

    for (const tela of telas) {
      await tx.rolePageAccess.create({
        data: { roleId: idDoPapel, pageKey: tela.pageKey },
      })
      for (const tabKey of tela.abas) {
        await tx.roleTabAccess.create({
          data: { roleId: idDoPapel, pageKey: tela.pageKey, tabKey },
        })
      }
    }
  })
}

export const repositorioDeAcessoTelas = {
  usuarioEhAdmin,
  usuarioPossuiPagina,
  usuarioPossuiAba,
  buscarRoleIdsDoUsuario,
  buscarPaginasPorRoleIds,
  buscarAbasPorRoleIds,
  buscarTelasDoPapel,
  substituirTelasDoPapel,
}
