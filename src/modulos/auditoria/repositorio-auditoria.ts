/**
 * Acesso ao banco para logs de auditoria.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

export const LIMITES_PAGINA_AUDITORIA = [10, 25, 50] as const
export type LimitePaginaAuditoria = (typeof LIMITES_PAGINA_AUDITORIA)[number]
export const LIMITE_PADRAO_AUDITORIA: LimitePaginaAuditoria = 10

export type FiltrosDeAuditoria = {
  entidade?: string
  usuarioId?: string
  dataInicio?: Date
  dataFim?: Date
  pagina?: number
  limite?: number
}

function montarWhere(filtros: FiltrosDeAuditoria) {
  return {
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
  }
}

function normalizarLimite(limite?: number): LimitePaginaAuditoria {
  if (
    limite !== undefined &&
    (LIMITES_PAGINA_AUDITORIA as readonly number[]).includes(limite)
  ) {
    return limite as LimitePaginaAuditoria
  }
  return LIMITE_PADRAO_AUDITORIA
}

async function listar(filtros: FiltrosDeAuditoria = {}) {
  const porPagina = normalizarLimite(filtros.limite)
  const pagina = filtros.pagina ?? 1

  return clientePrisma.logDeAuditoria.findMany({
    where: montarWhere(filtros),
    include: {
      usuario: { select: { id: true, name: true, email: true } },
    },
    orderBy: { criadoEm: 'desc' },
    take: porPagina,
    skip: (pagina - 1) * porPagina,
  })
}

async function contarTotal(filtros: FiltrosDeAuditoria = {}) {
  return clientePrisma.logDeAuditoria.count({
    where: montarWhere(filtros),
  })
}

export const repositorioDeAuditoria = {
  listar,
  contarTotal,
  normalizarLimite,
}
