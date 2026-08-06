/**
 * Vínculos entre fornecedores (mesmo grupo econômico, sem nome).
 * Grafo não direcionado: arestas armazenadas com par ordenado (A < B).
 *
 * `obterRedeFornecedor` / `obterPessoaIdsRedePorPessoaId` retornam a rede transitiva.
 * Uso atual: Entrada de Notas → Negociação cruza NF e pedido de compra entre CNPJs
 * do mesmo grupo econômico.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import type { Prisma } from '@prisma/client'

type TxCliente = Prisma.TransactionClient

export type FornecedorRelacionadoView = {
  dadosFornecedorId: string
  pessoaId: string
  nome: string
  documento: string | null
  vinculoDireto: boolean
}

export function ordenarParFornecedorIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

function construirAdjacencia(
  vinculos: { fornecedorAId: string; fornecedorBId: string }[]
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>()
  for (const { fornecedorAId, fornecedorBId } of vinculos) {
    if (!adj.has(fornecedorAId)) adj.set(fornecedorAId, new Set())
    if (!adj.has(fornecedorBId)) adj.set(fornecedorBId, new Set())
    adj.get(fornecedorAId)!.add(fornecedorBId)
    adj.get(fornecedorBId)!.add(fornecedorAId)
  }
  return adj
}

function componenteConexo(
  origemId: string,
  adj: Map<string, Set<string>>
): Set<string> {
  const visitados = new Set<string>()
  const fila = [origemId]
  visitados.add(origemId)

  while (fila.length > 0) {
    const atual = fila.shift()!
    for (const vizinho of adj.get(atual) ?? []) {
      if (!visitados.has(vizinho)) {
        visitados.add(vizinho)
        fila.push(vizinho)
      }
    }
  }

  visitados.delete(origemId)
  return visitados
}

async function carregarVinculosDaEmpresa(companyId: string, tx: TxCliente = clientePrisma) {
  const fornecedores = await tx.dadosFornecedor.findMany({
    where: { papel: { pessoa: { companyId }, papel: 'fornecedor' } },
    select: { id: true },
  })
  const ids = fornecedores.map((f) => f.id)
  if (ids.length === 0) return []

  return tx.fornecedorVinculo.findMany({
    where: {
      OR: [{ fornecedorAId: { in: ids } }, { fornecedorBId: { in: ids } }],
    },
    select: { fornecedorAId: true, fornecedorBId: true },
  })
}

export async function listarVizinhosDiretosIds(
  dadosFornecedorId: string,
  tx: TxCliente = clientePrisma
): Promise<string[]> {
  const vinculos = await tx.fornecedorVinculo.findMany({
    where: {
      OR: [{ fornecedorAId: dadosFornecedorId }, { fornecedorBId: dadosFornecedorId }],
    },
    select: { fornecedorAId: true, fornecedorBId: true },
  })

  return vinculos.map((v) =>
    v.fornecedorAId === dadosFornecedorId ? v.fornecedorBId : v.fornecedorAId
  )
}

/**
 * Retorna todos os dadosFornecedorId da mesma rede (componente conexo, transitivo).
 * Inclui o próprio id informado.
 */
export async function obterRedeFornecedor(
  dadosFornecedorId: string,
  companyId: string,
  tx: TxCliente = clientePrisma
): Promise<string[]> {
  const vinculos = await carregarVinculosDaEmpresa(companyId, tx)
  const adj = construirAdjacencia(vinculos)
  const rede = componenteConexo(dadosFornecedorId, adj)
  rede.add(dadosFornecedorId)
  return Array.from(rede)
}

/**
 * PessoaIds da rede do grupo econômico a partir do emitente (pessoa).
 * Sempre inclui a própria pessoa; sem DadosFornecedor / sem vínculos → `[pessoaId]`.
 */
export async function obterPessoaIdsRedePorPessoaId(
  pessoaId: string,
  companyId: string,
  tx: TxCliente = clientePrisma
): Promise<string[]> {
  const dados = await tx.dadosFornecedor.findFirst({
    where: {
      papel: {
        pessoaId,
        papel: 'fornecedor',
        pessoa: { companyId },
      },
    },
    select: { id: true },
  })

  if (!dados) return [pessoaId]

  const redeDadosIds = await obterRedeFornecedor(dados.id, companyId, tx)
  const registros = await carregarDadosFornecedoresPorIds(redeDadosIds, tx)
  const pessoaIds = new Set<string>([pessoaId])
  for (const df of registros) {
    pessoaIds.add(df.papel.pessoa.id)
  }
  return Array.from(pessoaIds)
}

async function carregarDadosFornecedoresPorIds(ids: string[], tx: TxCliente) {
  if (ids.length === 0) return []

  return tx.dadosFornecedor.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      papel: {
        select: {
          pessoa: {
            select: { id: true, nome: true, cpf: true, cnpj: true },
          },
        },
      },
    },
  })
}

export async function obterFornecedoresRelacionados(
  dadosFornecedorId: string,
  companyId: string,
  tx: TxCliente = clientePrisma
): Promise<FornecedorRelacionadoView[]> {
  const vinculos = await carregarVinculosDaEmpresa(companyId, tx)
  const adj = construirAdjacencia(vinculos)
  const diretos = adj.get(dadosFornecedorId) ?? new Set<string>()
  const rede = componenteConexo(dadosFornecedorId, adj)
  const idsRelacionados = Array.from(rede)

  const registros = await carregarDadosFornecedoresPorIds(idsRelacionados, tx)

  return registros
    .map((df) => {
      const pessoa = df.papel.pessoa
      return {
        dadosFornecedorId: df.id,
        pessoaId: pessoa.id,
        nome: pessoa.nome,
        documento: pessoa.cnpj ?? pessoa.cpf ?? null,
        vinculoDireto: diretos.has(df.id),
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function enriquecerFornecedoresComVinculos<
  T extends { dadosFornecedorId: string | null; companyId: string },
>(fornecedores: T[], companyId: string): Promise<
  (T & {
    fornecedoresVinculadosIds: string[]
    fornecedoresRelacionados: FornecedorRelacionadoView[]
  })[]
> {
  const comDados = fornecedores.filter((f) => f.dadosFornecedorId)
  if (comDados.length === 0) {
    return fornecedores.map((f) => ({
      ...f,
      fornecedoresVinculadosIds: [],
      fornecedoresRelacionados: [],
    }))
  }

  const vinculos = await carregarVinculosDaEmpresa(companyId)
  const adj = construirAdjacencia(vinculos)

  const todosIdsRelacionados = new Set<string>()
  for (const f of comDados) {
    const rede = componenteConexo(f.dadosFornecedorId!, adj)
    rede.forEach((id) => todosIdsRelacionados.add(id))
  }

  const registros = await carregarDadosFornecedoresPorIds(
    Array.from(todosIdsRelacionados),
    clientePrisma
  )
  const porId = new Map(registros.map((df) => [df.id, df]))

  return fornecedores.map((f) => {
    if (!f.dadosFornecedorId) {
      return { ...f, fornecedoresVinculadosIds: [], fornecedoresRelacionados: [] }
    }

    const diretos = adj.get(f.dadosFornecedorId) ?? new Set<string>()
    const rede = componenteConexo(f.dadosFornecedorId, adj)

    const fornecedoresRelacionados: FornecedorRelacionadoView[] = Array.from(rede)
      .map((id) => {
        const df = porId.get(id)
        if (!df) return null
        const pessoa = df.papel.pessoa
        return {
          dadosFornecedorId: df.id,
          pessoaId: pessoa.id,
          nome: pessoa.nome,
          documento: pessoa.cnpj ?? pessoa.cpf ?? null,
          vinculoDireto: diretos.has(id),
        }
      })
      .filter((item): item is FornecedorRelacionadoView => item !== null)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    return {
      ...f,
      fornecedoresVinculadosIds: Array.from(diretos),
      fornecedoresRelacionados,
    }
  })
}

export async function sincronizarVinculosDiretosFornecedor(
  tx: TxCliente,
  dadosFornecedorId: string,
  novosVinculosIds: string[],
  companyId: string
) {
  const unicos = [...new Set(novosVinculosIds)]

  if (unicos.includes(dadosFornecedorId)) {
    throw new ErroDaAplicacao('Fornecedor não pode ser vinculado a si mesmo', 400)
  }

  if (unicos.length > 0) {
    const alvos = await tx.dadosFornecedor.findMany({
      where: {
        id: { in: unicos },
        papel: { pessoa: { companyId }, papel: 'fornecedor', ativo: true },
      },
      select: { id: true },
    })

    if (alvos.length !== unicos.length) {
      throw new ErroDaAplicacao('Um ou mais fornecedores vinculados são inválidos', 400)
    }
  }

  const atuais = await listarVizinhosDiretosIds(dadosFornecedorId, tx)
  const setAtuais = new Set(atuais)
  const setNovos = new Set(unicos)

  for (const alvoId of atuais) {
    if (!setNovos.has(alvoId)) {
      const [a, b] = ordenarParFornecedorIds(dadosFornecedorId, alvoId)
      await tx.fornecedorVinculo.deleteMany({ where: { fornecedorAId: a, fornecedorBId: b } })
    }
  }

  for (const alvoId of unicos) {
    if (!setAtuais.has(alvoId)) {
      const [a, b] = ordenarParFornecedorIds(dadosFornecedorId, alvoId)
      await tx.fornecedorVinculo.create({ data: { fornecedorAId: a, fornecedorBId: b } })
    }
  }
}
