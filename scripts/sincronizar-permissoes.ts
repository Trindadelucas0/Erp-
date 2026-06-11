/**
 * Sincroniza permissões e vínculos padrão papel-permissão no banco.
 * Só adiciona vínculos novos — não remove ajustes feitos pelo admin na tela.
 */
import { PrismaClient } from '@prisma/client'
import {
  PAPEIS_DO_SISTEMA,
  ACOES_DO_SISTEMA,
  MODULOS_DO_SISTEMA,
  gerarTodasAsChavesDePermissao,
  resolverChavesDoPapel,
  type ChaveDoModulo,
  type ChaveDaAcao,
  type NomeDoPapel,
} from '../src/compartilhado/permissoes/registro-de-permissoes.js'

const prisma = new PrismaClient()

export async function sincronizarPermissoes() {
  console.log('Sincronizando permissões...')

  const permissoesNoBanco = []

  for (const modulo of Object.keys(MODULOS_DO_SISTEMA) as ChaveDoModulo[]) {
    for (const acao of Object.keys(ACOES_DO_SISTEMA) as ChaveDaAcao[]) {
      const permissao = await prisma.permission.upsert({
        where: { key: `${modulo}:${acao}` },
        update: {},
        create: { module: modulo, action: acao, key: `${modulo}:${acao}` },
      })
      permissoesNoBanco.push(permissao)
    }
  }

  const todasAsChaves = gerarTodasAsChavesDePermissao()

  console.log('Sincronizando papéis e vínculos padrão...')

  for (const nomeDoPapel of PAPEIS_DO_SISTEMA) {
    const papel = await prisma.role.upsert({
      where: { name: nomeDoPapel },
      update: {},
      create: {
        name: nomeDoPapel,
        description: `Papel ${nomeDoPapel}`,
      },
    })

    const chavesDoPapel = resolverChavesDoPapel(
      nomeDoPapel as NomeDoPapel,
      todasAsChaves
    )

    for (const chave of chavesDoPapel) {
      const permissao = permissoesNoBanco.find((p) => p.key === chave)
      if (!permissao) continue

      const vinculoExiste = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: papel.id,
            permissionId: permissao.id,
          },
        },
      })

      if (!vinculoExiste) {
        await prisma.rolePermission.create({
          data: { roleId: papel.id, permissionId: permissao.id },
        })
        console.log(`  + ${nomeDoPapel} ← ${chave}`)
      }
    }

    if (nomeDoPapel === 'admin') {
      for (const permissao of permissoesNoBanco) {
        const vinculoExiste = await prisma.rolePermission.findUnique({
          where: {
            roleId_permissionId: {
              roleId: papel.id,
              permissionId: permissao.id,
            },
          },
        })

        if (!vinculoExiste) {
          await prisma.rolePermission.create({
            data: { roleId: papel.id, permissionId: permissao.id },
          })
        }
      }
    }
  }

  console.log('Sincronização concluída!')
}

const executandoDireto = process.argv[1]?.includes('sincronizar-permissoes')

if (executandoDireto) {
  sincronizarPermissoes()
    .catch((erro) => {
      console.error(erro)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
