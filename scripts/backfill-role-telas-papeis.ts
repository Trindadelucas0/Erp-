/**
 * Preenche RolePageAccess / RoleTabAccess a partir do menu legado por papel.
 * Rodar após migração: npx tsx scripts/backfill-role-telas-papeis.ts
 */
import { PrismaClient } from '@prisma/client'
import {
  PAPEIS_DO_SISTEMA,
  gerarTodasAsChavesDePermissao,
  resolverChavesDoPapel,
  type NomeDoPapel,
} from '../src/compartilhado/permissoes/registro-de-permissoes.js'
import { montarPaginasPermitidasLegado } from '../src/compartilhado/paginas/montar-paginas-legado.js'
import {
  idsAbasDaPagina,
  listarAbasDaPagina,
} from '../src/compartilhado/paginas/registro-de-abas.js'
import { PAINEIS_ENTRADA_ADMINISTRATIVO } from '../src/modulos/focus-nfe/paineis-entrada-listagem.js'

const prisma = new PrismaClient()

function abasLegadoParaPagina(nomePapel: string, pageKey: string): string[] {
  const catalogo = listarAbasDaPagina(pageKey)
  if (catalogo.length === 0) return []

  if (pageKey === 'entrada-notas' && nomePapel === 'administrativo') {
    return [...PAINEIS_ENTRADA_ADMINISTRATIVO]
  }

  return idsAbasDaPagina(pageKey)
}

async function main() {
  const todasChaves = gerarTodasAsChavesDePermissao()
  const roles = await prisma.role.findMany({
    include: {
      permissions: { include: { permission: true } },
    },
  })

  for (const role of roles) {
    if (role.name === 'admin') continue

    const chavesPermissao = (PAPEIS_DO_SISTEMA as readonly string[]).includes(
      role.name
    )
      ? resolverChavesDoPapel(role.name as NomeDoPapel, todasChaves)
      : role.permissions.map((rp) => rp.permission.key)

    const paginas = montarPaginasPermitidasLegado([], chavesPermissao, [
      { nome: role.name },
    ])

    await prisma.roleTabAccess.deleteMany({ where: { roleId: role.id } })
    await prisma.rolePageAccess.deleteMany({ where: { roleId: role.id } })

    for (const pagina of paginas) {
      const abas = abasLegadoParaPagina(role.name, pagina.chave)
      if (listarAbasDaPagina(pagina.chave).length > 0 && abas.length === 0) {
        continue
      }

      await prisma.rolePageAccess.create({
        data: { roleId: role.id, pageKey: pagina.chave },
      })

      for (const tabKey of abas) {
        await prisma.roleTabAccess.create({
          data: { roleId: role.id, pageKey: pagina.chave, tabKey },
        })
      }
    }

    console.log(`Papel ${role.name}: ${paginas.length} telas`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
