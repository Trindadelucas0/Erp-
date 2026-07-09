/**
 * Normaliza e valida unidade/código original dos itens conforme cadastro produto + fornecedor.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import {
  resolverUnidadeCodigoItem,
  type ProdutoComFornecedores,
} from './resolver-item-fornecedor.js'

type ItemComUnidadeCodigo = {
  produtoId: string
  unidade: string
  codigoOriginal?: string | null
}

type ItemExistenteSnapshot = {
  produtoId: string
  unidade: string
  codigoOriginal: string | null
}

function normalizarCodigo(valor: string | null | undefined): string {
  return valor?.trim() || ''
}

async function carregarProdutosComFornecedores(
  produtoIds: string[],
  companyId: string
): Promise<Map<string, ProdutoComFornecedores>> {
  const produtos = await clientePrisma.produto.findMany({
    where: { id: { in: produtoIds }, companyId, ativo: true },
    select: {
      id: true,
      unidade: true,
      fornecedores: {
        select: {
          fornecedorPessoaId: true,
          codigoFornecedor: true,
          unidadeEntrada: true,
        },
      },
    },
  })

  return new Map(produtos.map((p) => [p.id, p]))
}

export async function normalizarUnidadeCodigoItens<T extends ItemComUnidadeCodigo>(
  itens: T[],
  fornecedorPessoaId: string,
  companyId: string
): Promise<T[]> {
  const produtoIds = [...new Set(itens.map((i) => i.produtoId))]
  const produtosPorId = await carregarProdutosComFornecedores(produtoIds, companyId)

  return itens.map((item) => {
    const produto = produtosPorId.get(item.produtoId)
    if (!produto) {
      throw new ErroDaAplicacao('Produto inexistente ou inativo no pedido', 400)
    }

    const resolvido = resolverUnidadeCodigoItem(produto, fornecedorPessoaId)
    return {
      ...item,
      unidade: resolvido.unidade,
      codigoOriginal: resolvido.codigoOriginal || null,
    }
  })
}

export async function validarUnidadeCodigoItens(
  itens: ItemComUnidadeCodigo[],
  fornecedorPessoaId: string,
  companyId: string,
  itensExistentes?: ItemExistenteSnapshot[]
): Promise<void> {
  const produtoIds = [...new Set(itens.map((i) => i.produtoId))]
  const produtosPorId = await carregarProdutosComFornecedores(produtoIds, companyId)
  const snapshotPorProduto = new Map(
    (itensExistentes ?? []).map((i) => [i.produtoId, i])
  )

  for (const item of itens) {
    const produto = produtosPorId.get(item.produtoId)
    if (!produto) {
      throw new ErroDaAplicacao('Produto inexistente ou inativo no pedido', 400)
    }

    const esperado = resolverUnidadeCodigoItem(produto, fornecedorPessoaId)
    const unidadeEnviada = item.unidade.trim()
    const codigoEnviado = normalizarCodigo(item.codigoOriginal)

    const bateComCadastro =
      unidadeEnviada === esperado.unidade && codigoEnviado === esperado.codigoOriginal

    if (bateComCadastro) continue

    const snapshot = snapshotPorProduto.get(item.produtoId)
    const bateComSnapshot =
      snapshot &&
      unidadeEnviada === snapshot.unidade.trim() &&
      codigoEnviado === normalizarCodigo(snapshot.codigoOriginal)

    if (bateComSnapshot) continue

    throw new ErroDaAplicacao(
      'Unidade ou código original do item não correspondem ao cadastro do produto para este fornecedor. Edite no cadastro do produto, aba Compras.',
      400
    )
  }
}
