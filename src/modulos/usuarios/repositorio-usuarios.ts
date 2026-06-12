/**
 * Acesso ao banco de dados para usuários.
 */
import { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

/** Campos retornados nas consultas — nunca inclui a senha. */
const camposPublicosDoUsuario = {
  id: true,
  name: true,
  email: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  roles: {
    include: {
      role: true,
    },
  },
  companies: {
    include: {
      company: true,
    },
  },
  permissoesExtras: {
    include: {
      permission: true,
    },
  },
  paginasPermitidas: {
    select: {
      pageKey: true,
    },
  },
} as const

/**
 * Busca usuário pelo email (inclui senha — usado apenas no login).
 */
async function buscarPorEmail(email: string) {
  return clientePrisma.user.findUnique({ where: { email } })
}

/**
 * Busca usuário pelo ID sem expor a senha.
 */
async function buscarPorId(idDoUsuario: string) {
  return clientePrisma.user.findUnique({
    where: { id: idDoUsuario },
    select: camposPublicosDoUsuario,
  })
}

/**
 * Lista todos os usuários sem expor senha.
 */
async function listarTodos() {
  return clientePrisma.user.findMany({
    select: camposPublicosDoUsuario,
    orderBy: { name: 'asc' },
  })
}

/**
 * Cria usuário com papéis, empresas e permissões extras.
 */
async function buscarChavesDasPaginasPermitidas(idDoUsuario: string) {
  const registros = await clientePrisma.userPageAccess.findMany({
    where: { userId: idDoUsuario },
    select: { pageKey: true },
  })

  return registros.map((registro) => registro.pageKey)
}

async function criar(dados: {
  nome: string
  email: string
  senhaCriptografada: string
  idsDosPapeis: string[]
  idsDasEmpresas: string[]
  idsDasPermissoesExtras: string[]
  chavesDasPaginasPermitidas: string[]
}) {
  return clientePrisma.$transaction(async (transacao: Prisma.TransactionClient) => {
    return transacao.user.create({
      data: {
        name: dados.nome,
        email: dados.email,
        password: dados.senhaCriptografada,
        roles: {
          create: dados.idsDosPapeis.map((idDoPapel) => ({
            roleId: idDoPapel,
          })),
        },
        companies: {
          create: dados.idsDasEmpresas.map((idDaEmpresa) => ({
            companyId: idDaEmpresa,
          })),
        },
        permissoesExtras: {
          create: dados.idsDasPermissoesExtras.map((permissionId) => ({
            permissionId,
          })),
        },
        paginasPermitidas: {
          create: dados.chavesDasPaginasPermitidas.map((pageKey) => ({
            pageKey,
          })),
        },
      },
      select: camposPublicosDoUsuario,
    })
  })
}

/**
 * Atualiza usuário e recria vínculos de papéis, empresas e permissões extras.
 */
async function atualizar(
  idDoUsuario: string,
  dados: {
    nome: string
    email: string
    senhaCriptografada?: string
    idsDosPapeis: string[]
    idsDasEmpresas: string[]
    idsDasPermissoesExtras: string[]
    chavesDasPaginasPermitidas: string[]
  }
) {
  return clientePrisma.$transaction(async (transacao: Prisma.TransactionClient) => {
    await transacao.user.update({
      where: { id: idDoUsuario },
      data: {
        name: dados.nome,
        email: dados.email,
        ...(dados.senhaCriptografada
          ? { password: dados.senhaCriptografada }
          : {}),
      },
    })

    await transacao.userRole.deleteMany({ where: { userId: idDoUsuario } })
    await transacao.userCompany.deleteMany({ where: { userId: idDoUsuario } })
    await transacao.userPermission.deleteMany({ where: { userId: idDoUsuario } })
    await transacao.userPageAccess.deleteMany({ where: { userId: idDoUsuario } })

    if (dados.idsDosPapeis.length > 0) {
      await transacao.userRole.createMany({
        data: dados.idsDosPapeis.map((roleId) => ({
          userId: idDoUsuario,
          roleId,
        })),
      })
    }

    if (dados.idsDasEmpresas.length > 0) {
      await transacao.userCompany.createMany({
        data: dados.idsDasEmpresas.map((companyId) => ({
          userId: idDoUsuario,
          companyId,
        })),
      })
    }

    if (dados.idsDasPermissoesExtras.length > 0) {
      await transacao.userPermission.createMany({
        data: dados.idsDasPermissoesExtras.map((permissionId) => ({
          userId: idDoUsuario,
          permissionId,
        })),
      })
    }

    if (dados.chavesDasPaginasPermitidas.length > 0) {
      await transacao.userPageAccess.createMany({
        data: dados.chavesDasPaginasPermitidas.map((pageKey) => ({
          userId: idDoUsuario,
          pageKey,
        })),
      })
    }

    return transacao.user.findUniqueOrThrow({
      where: { id: idDoUsuario },
      select: camposPublicosDoUsuario,
    })
  })
}

/**
 * Ativa ou desativa um usuário.
 */
async function alterarStatus(idDoUsuario: string, ativo: boolean) {
  return clientePrisma.user.update({
    where: { id: idDoUsuario },
    data: { active: ativo },
    select: camposPublicosDoUsuario,
  })
}

export const repositorioDeUsuarios = {
  buscarPorEmail,
  buscarPorId,
  buscarChavesDasPaginasPermitidas,
  listarTodos,
  criar,
  atualizar,
  alterarStatus,
}
