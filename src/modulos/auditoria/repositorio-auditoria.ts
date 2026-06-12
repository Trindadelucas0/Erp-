/**
 * Acesso ao banco para logs de auditoria.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

export type FiltrosDeAuditoria = {
  entidade?: string
  usuarioId?: string
  dataInicio?: Date
  dataFim?: Date
  pagina?: number
}

async function listar(filtros: FiltrosDeAuditoria = {}) {
  const por_pagina = 50
  const pagina = filtros.pagina ?? 1

  return clientePrisma.logDeAuditoria.findMany({
    where: {
      ...(filtros.entidade ? { entidade: filtros.entidade } : {}),
      ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
      ...(filtros.dataInicio || filtros.dataFim
        ? {
            criadoEm: {
              ...(filtros.dataInicio ? { gte: filtros.dataInicio } : {}),
              ...(filtros.dataFim ? { lte: filtros.dataFim } : {}),
            },
          }
        : {}),
    },
    include: {
      usuario: { select: { id: true, name: true, email: true } },
    },
    orderBy: { criadoEm: 'desc' },
    take: por_pagina,
    skip: (pagina - 1) * por_pagina,
  })
}

async function contarTotal(filtros: FiltrosDeAuditoria = {}) {
  return clientePrisma.logDeAuditoria.count({
    where: {
      ...(filtros.entidade ? { entidade: filtros.entidade } : {}),
      ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
    },
  })
}

export const repositorioDeAuditoria = {
  listar,
  contarTotal,
}
