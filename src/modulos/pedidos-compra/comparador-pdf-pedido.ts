/**
 * Extração de texto de PDF e comparação com pedido de compra digitado.
 * Usa heurísticas de texto (sem LLM) para comparar quantidades e preços.
 */
import type { PedidoCompraView } from './repositorio-pedidos-compra.js'
import { extrairTextoDoPdf } from './extrator-texto-pdf.js'

export type DivergenciaPdf = {
  campo: string
  esperado: string
  encontrado: string
  severidade: 'alta' | 'media' | 'baixa'
}

function normalizarNumero(s: string): number | null {
  const limpo = s.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

function extrairNumerosDoTexto(texto: string): number[] {
  const padroes = texto.match(/\d{1,3}(?:\.\d{3})*,\d{2,7}|\d+[.,]\d{2,7}/g) ?? []
  return padroes
    .map(normalizarNumero)
    .filter((n): n is number => n != null && n > 0)
}

export async function compararPedidoComPdf(
  pedido: PedidoCompraView,
  base64Pdf: string
): Promise<{ divergencias: DivergenciaPdf[]; textoExtraido: string; temDivergencia: boolean }> {
  const buffer = Buffer.from(base64Pdf.replace(/^data:application\/pdf;base64,/, ''), 'base64')
  const texto = await extrairTextoDoPdf(buffer)
  const divergencias: DivergenciaPdf[] = []

  if (texto.trim().length < 20) {
    divergencias.push({
      campo: 'pdf',
      esperado: 'Texto legível no PDF',
      encontrado: 'Não foi possível extrair conteúdo do PDF',
      severidade: 'alta',
    })
    return { divergencias, textoExtraido: texto, temDivergencia: true }
  }

  const textoLower = texto.toLowerCase()
  const fornecedorNome = pedido.fornecedorNome.toLowerCase()
  const partesNome = fornecedorNome.split(/\s+/).filter((p) => p.length > 3)
  const nomeEncontrado = partesNome.some((p) => textoLower.includes(p))

  if (!nomeEncontrado && partesNome.length > 0) {
    divergencias.push({
      campo: 'fornecedor',
      esperado: pedido.fornecedorNome,
      encontrado: 'Nome do fornecedor não encontrado no PDF',
      severidade: 'media',
    })
  }

  const numerosPdf = extrairNumerosDoTexto(texto)

  for (const item of pedido.itens) {
    const preco = item.precoUnitario
    const qtd = item.quantidade
    const precoEncontrado = numerosPdf.some((n) => Math.abs(n - preco) < 0.02)
    const qtdEncontrada = numerosPdf.some((n) => Math.abs(n - qtd) < 0.001)

    const rotulo = item.produtoSku ?? item.produtoNome

    if (!precoEncontrado) {
      divergencias.push({
        campo: `item:${rotulo}:preco`,
        esperado: String(preco),
        encontrado: 'Preço unitário não encontrado no PDF',
        severidade: 'alta',
      })
    }

    if (!qtdEncontrada) {
      divergencias.push({
        campo: `item:${rotulo}:quantidade`,
        esperado: String(qtd),
        encontrado: 'Quantidade não encontrada no PDF',
        severidade: 'alta',
      })
    }
  }

  const totalEsperado = pedido.totalLiquido
  const totalEncontrado = numerosPdf.some((n) => Math.abs(n - totalEsperado) < 0.05)
  if (!totalEncontrado) {
    divergencias.push({
      campo: 'total',
      esperado: String(totalEsperado),
      encontrado: 'Total do pedido não encontrado no PDF',
      severidade: 'media',
    })
  }

  return {
    divergencias,
    textoExtraido: texto.slice(0, 2000),
    temDivergencia: divergencias.length > 0,
  }
}
