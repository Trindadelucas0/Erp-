import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { RegrasFiscais } from './esquema-regras-fiscais.js'
import type { Prisma } from '@prisma/client'

async function buscarDaEmpresa(companyId: string, db: Prisma.TransactionClient = clientePrisma) {
  return db.regraFiscal.findUnique({ where: { companyId } })
}

async function gravar(companyId: string, regras: RegrasFiscais) {
  const data = {
    mercadoriaModo: regras.mercadoria.modo,
    mercadoriaAliquota: regras.mercadoria.aliquota,
    transporteModo: regras.transporte.modo,
    transporteAliquota: regras.transporte.aliquota,
    ...(regras.baseIcms !== undefined ? { baseIcms: regras.baseIcms } : {}),
    ...(regras.operacoes !== undefined ? { operacoes: regras.operacoes } : {}),
  }
  return clientePrisma.regraFiscal.upsert({ where: { companyId }, create: { companyId, ...data }, update: data })
}

export const repositorioRegrasFiscais = { buscarDaEmpresa, gravar }
