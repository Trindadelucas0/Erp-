/**
 * Acesso ao banco de dados para permissões.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

/**
 * Lista todas as permissões cadastradas no sistema.
 * @returns Lista ordenada por módulo e ação
 */
async function listarTodas() {
  return clientePrisma.permission.findMany({
    orderBy: [{ module: 'asc' }, { action: 'asc' }],
  })
}

/**
 * Verifica se o usuário possui permissão via papel OU permissão extra direta.
 * @param idDoUsuario - UUID do usuário
 * @param chaveDaPermissao - Ex: "vendas:view"
 * @returns true se o usuário tiver a permissão
 */
async function usuarioPossuiPermissao(
  idDoUsuario: string,
  chaveDaPermissao: string
) {
  const quantidadePorPapel = await clientePrisma.permission.count({
    where: {
      key: chaveDaPermissao,
      roles: {
        some: {
          role: {
            users: {
              some: { userId: idDoUsuario },
            },
          },
        },
      },
    },
  })

  if (quantidadePorPapel > 0) return true

  const quantidadeExtra = await clientePrisma.permission.count({
    where: {
      key: chaveDaPermissao,
      usuariosExtras: {
        some: { userId: idDoUsuario },
      },
    },
  })

  return quantidadeExtra > 0
}

/**
 * Busca chaves de permissão vindas dos papéis do usuário.
 * @param idDoUsuario - UUID do usuário
 * @returns Lista de chaves dos papéis
 */
async function buscarChavesDosPapeisPorIdDoUsuario(idDoUsuario: string) {
  const permissoes = await clientePrisma.permission.findMany({
    where: {
      roles: {
        some: {
          role: {
            users: {
              some: { userId: idDoUsuario },
            },
          },
        },
      },
    },
    select: { key: true },
  })

  return permissoes.map((p: { key: string }) => p.key)
}

/**
 * Busca chaves de permissões extras do usuário (sem papel).
 * @param idDoUsuario - UUID do usuário
 * @returns Lista de chaves extras
 */
async function buscarChavesExtrasPorIdDoUsuario(idDoUsuario: string) {
  const permissoes = await clientePrisma.permission.findMany({
    where: {
      usuariosExtras: {
        some: { userId: idDoUsuario },
      },
    },
    select: { key: true },
  })

  return permissoes.map((p: { key: string }) => p.key)
}

/**
 * Busca todas as chaves efetivas (papéis + extras, sem duplicar).
 * @param idDoUsuario - UUID do usuário
 * @returns Lista unificada de chaves
 */
async function buscarChavesPorIdDoUsuario(idDoUsuario: string) {
  const [dosPapeis, extras] = await Promise.all([
    buscarChavesDosPapeisPorIdDoUsuario(idDoUsuario),
    buscarChavesExtrasPorIdDoUsuario(idDoUsuario),
  ])

  return [...new Set([...dosPapeis, ...extras])]
}

export const repositorioDePermissoes = {
  listarTodas,
  usuarioPossuiPermissao,
  buscarChavesDosPapeisPorIdDoUsuario,
  buscarChavesExtrasPorIdDoUsuario,
  buscarChavesPorIdDoUsuario,
}
