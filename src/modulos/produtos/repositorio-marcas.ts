import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { DadosParaCriarMarca } from './esquema-marcas.js'

async function listarPorEmpresa(companyId: string, busca?: string) {
  const termo = busca?.trim()
  return clientePrisma.marca.findMany({
    where: {
      companyId,
      ativo: true,
      ...(termo
        ? { nome: { contains: termo, mode: 'insensitive' } }
        : {}),
    },
    orderBy: [{ nome: 'asc' }],
    select: { id: true, nome: true },
    take: 80,
  })
}

async function criar(dados: DadosParaCriarMarca, companyId: string) {
  return clientePrisma.marca.create({
    data: {
      companyId,
      nome: dados.nome,
    },
    select: { id: true, nome: true },
  })
}

async function buscarPorNome(nome: string, companyId: string) {
  return clientePrisma.marca.findFirst({
    where: { companyId, nome, ativo: true },
    select: { id: true, nome: true },
  })
}

export const repositorioDeMarcas = {
  listarPorEmpresa,
  criar,
  buscarPorNome,
}
