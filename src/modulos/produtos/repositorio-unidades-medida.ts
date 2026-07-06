import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { DadosParaCriarUnidadeMedida } from './esquema-unidades-medida.js'

const UNIDADES_PADRAO: { sigla: string; nome: string }[] = [
  { sigla: 'UN', nome: 'Unidade' },
  { sigla: 'CX', nome: 'Caixa' },
  { sigla: 'KG', nome: 'Quilograma' },
  { sigla: 'PC', nome: 'Peça' },
  { sigla: 'PAR', nome: 'Par' },
  { sigla: 'M', nome: 'Metro' },
  { sigla: 'M2', nome: 'Metro quadrado' },
  { sigla: 'M3', nome: 'Metro cúbico' },
  { sigla: 'L', nome: 'Litro' },
  { sigla: 'CJ', nome: 'Conjunto' },
]

async function garantirUnidadesPadrao(companyId: string) {
  const total = await clientePrisma.unidadeMedida.count({ where: { companyId } })
  if (total > 0) return

  await clientePrisma.unidadeMedida.createMany({
    data: UNIDADES_PADRAO.map((u) => ({ ...u, companyId })),
    skipDuplicates: true,
  })
}

async function listarPorEmpresa(companyId: string) {
  await garantirUnidadesPadrao(companyId)
  return clientePrisma.unidadeMedida.findMany({
    where: { companyId, ativo: true },
    orderBy: [{ sigla: 'asc' }],
    select: { id: true, sigla: true, nome: true },
  })
}

async function criar(dados: DadosParaCriarUnidadeMedida, companyId: string) {
  return clientePrisma.unidadeMedida.create({
    data: {
      companyId,
      sigla: dados.sigla,
      nome: dados.nome,
    },
    select: { id: true, sigla: true, nome: true },
  })
}

async function buscarPorSigla(sigla: string, companyId: string) {
  return clientePrisma.unidadeMedida.findFirst({
    where: { companyId, sigla, ativo: true },
    select: { id: true, sigla: true, nome: true },
  })
}

export const repositorioDeUnidadesMedida = {
  listarPorEmpresa,
  criar,
  buscarPorSigla,
}
