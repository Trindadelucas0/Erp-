/**
 * Etapa 1 — Análise de cadastro (fornecedor + vínculo de produtos).
 */
import { repositorioEntradaNotas } from '../repositorio-entrada-notas.js'
import type { ResultadoEtapa } from '../tipos-analise.js'

type ItemCadastro = {
  id: string
  gtin: string | null
  codigoProduto: string | null
  produtoId: string | null
  vinculoModo: string | null
}

export async function analisarCadastro(params: {
  companyId: string
  documentoEmitente: string | null
  fornecedorPessoaId: string | null
  itens: ItemCadastro[]
  /** NFe 55 exige itens; NFS-e não (serviço). Default true. */
  exigirItens?: boolean
}): Promise<{
  resultado: ResultadoEtapa
  fornecedorPessoaId: string | null
  itensAtualizados: Array<{
    id: string
    produtoId: string | null
    vinculoModo: string | null
    criticaCadastro: boolean
  }>
}> {
  const avisos: string[] = []
  const bloqueios: string[] = []
  const exigirItens = params.exigirItens !== false

  let fornecedorPessoaId = params.fornecedorPessoaId
  if (!fornecedorPessoaId && params.documentoEmitente) {
    const fornecedor = await repositorioEntradaNotas.buscarFornecedorPorCnpj(
      params.companyId,
      params.documentoEmitente
    )
    if (fornecedor) {
      fornecedorPessoaId = fornecedor.id
    } else {
      bloqueios.push(
        `Fornecedor com documento ${params.documentoEmitente} não cadastrado. Cadastre o fornecedor e rode a análise de novo.`
      )
    }
  } else if (!params.documentoEmitente) {
    bloqueios.push('XML sem CNPJ/CPF do emitente — não é possível vincular fornecedor.')
  }

  const itensAtualizados: Array<{
    id: string
    produtoId: string | null
    vinculoModo: string | null
    criticaCadastro: boolean
  }> = []

  for (const item of params.itens) {
    let produtoId = item.produtoId
    let vinculoModo = item.vinculoModo
    let critica = false
    const desvinculadoManualmente = vinculoModo === 'desvinculado'

    if (!produtoId && !desvinculadoManualmente && item.gtin) {
      const porBarras = await repositorioEntradaNotas.buscarProdutoPorGtin(
        params.companyId,
        item.gtin
      )
      if (porBarras) {
        produtoId = porBarras.id
        vinculoModo = 'barras'
      }
    }

    if (!produtoId && !desvinculadoManualmente && fornecedorPessoaId && item.codigoProduto) {
      const porOriginal = await repositorioEntradaNotas.buscarProdutoPorCodigoOriginal(
        params.companyId,
        fornecedorPessoaId,
        item.codigoProduto
      )
      if (porOriginal) {
        produtoId = porOriginal.id
        vinculoModo = 'codigo_original'
      }
    }

    if (!produtoId) {
      critica = true
      bloqueios.push(
        desvinculadoManualmente
          ? `Item desvinculado manualmente (GTIN: ${item.gtin ?? '—'} / cProd: ${item.codigoProduto ?? '—'}). Use busca manual para conciliar.`
          : `Item sem vínculo de produto (GTIN: ${item.gtin ?? '—'} / cProd: ${item.codigoProduto ?? '—'}). Use busca manual.`
      )
    }

    itensAtualizados.push({ id: item.id, produtoId, vinculoModo, criticaCadastro: critica })
  }

  if (exigirItens && params.itens.length === 0) {
    avisos.push('Nota sem itens parseados do XML. Reimporte o XML ou complete o download na Focus.')
  }

  const status =
    bloqueios.length > 0 ? 'bloqueante' : avisos.length > 0 ? 'aviso' : 'ok'

  return {
    resultado: { status, avisos, bloqueios },
    fornecedorPessoaId,
    itensAtualizados,
  }
}
