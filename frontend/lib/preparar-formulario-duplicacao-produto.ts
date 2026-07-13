import type { EmbalagemMasterForm } from '@/components/produtos/lista-embalagens-master'
import type { EnderecoEstoqueForm } from '@/components/produtos/lista-enderecos-estoque'
import type { FornecedorProdutoForm } from '@/components/produtos/lista-fornecedores-produto'
import type { ProdutoSimilarItem } from '@/components/produtos/selecao-produtos-similares'

/** Campos que não são copiados no form (identificadores únicos). Foto é copiada via endpoint após salvar. */
export const CAMPOS_NAO_DUPLICADOS_PRODUTO = [
  'sku',
  'codigoBarras',
  'embalagensMaster.codigoBarras',
] as const

const SUFIXO_COPIA = ' (CÓPIA)'
const LIMITE_NOME_VENDA = 60

export type FormProdutoDuplicavel = {
  sku: string
  ativo: boolean
  nomeVenda: string
  marca: string
  unidade: string
  caracteristicas: string
  tipoEntrega: '' | 'pronta_entrega' | 'sob_encomenda'
  diasParaEntrega: string
  dataValidadePreco: string
  entregaNoAto: boolean
  entregaARetirar: boolean
  entregar: boolean
  entregaPorEncomenda: boolean
  flagDevolucao: boolean
  controlaEstoque: boolean
  flagComissao: boolean
  permiteEstoqueNegativo: boolean
  bloqueadoCompra: boolean
  bloqueadoVenda: boolean
  desativarAoZerarEstoque: boolean
  codigoBarras: string
  pesoKg: string
  alturaCm: string
  larguraCm: string
  comprimentoCm: string
  capacidadeEmpilhamento: string
  normaPalete: string
  multiploVenda: string
  permiteVendaFracionada: boolean
  unidadeEntregaMultiploVenda: string
  embalagensMaster: EmbalagemMasterForm[]
  enderecosEstoque: EnderecoEstoqueForm[]
  nomeCompra: string
  fornecedores: FornecedorProdutoForm[]
  similares: ProdutoSimilarItem[]
  agruparSimilaresRuptura: boolean
  ncm: string
  codigoOrigem: string
}

export function nomeVendaParaCopia(nomeOriginal: string): string {
  const base = nomeOriginal.trim().toUpperCase()
  if (!base) return 'PRODUTO (CÓPIA)'

  const maxBase = LIMITE_NOME_VENDA - SUFIXO_COPIA.length
  if (base.length <= maxBase) return `${base}${SUFIXO_COPIA}`
  return `${base.slice(0, maxBase)}${SUFIXO_COPIA}`
}

export function prepararFormularioDuplicacaoProduto(
  form: FormProdutoDuplicavel,
  produtoOrigemId: string,
  nomeVenda?: string
): FormProdutoDuplicavel {
  const nome = (nomeVenda ?? nomeVendaParaCopia(form.nomeVenda)).trim().toUpperCase()

  return {
    ...form,
    sku: '',
    ativo: true,
    nomeVenda: nome.slice(0, LIMITE_NOME_VENDA),
    codigoBarras: '',
    embalagensMaster: form.embalagensMaster.map((embalagem) => ({
      ...embalagem,
      codigoBarras: '',
    })),
    similares: form.similares.filter((similar) => similar.id !== produtoOrigemId),
    agruparSimilaresRuptura: form.agruparSimilaresRuptura,
  }
}
