/**
 * Regras de conversão e validação de quantidade na venda (UN/CX).
 */

export type ModoQuantidadeVenda = 'UN' | 'CX'

export type ProdutoParaRegrasVenda = {
  unidade: string
  multiploVenda?: number | null
  permiteVendaFracionada?: boolean
  embalagensMaster?: { quantidade: number | null }[]
  fornecedores?: { multiplicadorEntrada?: number | null }[]
}

function arredondar6(valor: number): number {
  return Math.round(valor * 1e6) / 1e6
}

function quantidadeEhMultiplo(quantidade: number, multiplo: number): boolean {
  if (!(multiplo > 0) || !(quantidade > 0)) return true
  const razao = quantidade / multiplo
  return Math.abs(razao - Math.round(razao)) < 1e-9
}

export function resolverItensNaCaixa(produto: ProdutoParaRegrasVenda): number {
  const master = produto.embalagensMaster?.[0]?.quantidade
  if (master != null && Number.isFinite(master) && master > 0) return master

  const multiplicador = produto.fornecedores?.[0]?.multiplicadorEntrada
  if (multiplicador != null && Number.isFinite(multiplicador) && multiplicador > 0) {
    return multiplicador
  }

  return 1
}

export function converterQtdParaUnidadeVenda(
  modo: ModoQuantidadeVenda,
  quantidadeInformada: number,
  itensNaCaixa: number
): number {
  if (!(quantidadeInformada > 0)) return 0
  if (modo === 'CX') {
    const fator = itensNaCaixa > 0 ? itensNaCaixa : 1
    return arredondar6(quantidadeInformada * fator)
  }
  return arredondar6(quantidadeInformada)
}

export function validarQuantidadeModoUn(
  quantidade: number,
  permiteVendaFracionada: boolean,
  multiploVenda: number | null | undefined
): { ok: true } | { ok: false; mensagem: string } {
  if (!(quantidade > 0)) {
    return { ok: false, mensagem: 'Quantidade deve ser maior que zero.' }
  }

  if (!permiteVendaFracionada && Math.abs(quantidade - Math.round(quantidade)) >= 1e-9) {
    return { ok: false, mensagem: 'Este produto não permite venda fracionada.' }
  }

  const multiplo = multiploVenda != null && multiploVenda > 0 ? multiploVenda : null
  if (multiplo != null && multiplo !== 1 && !quantidadeEhMultiplo(quantidade, multiplo)) {
    return {
      ok: false,
      mensagem: `Quantidade deve ser múltiplo de ${multiplo}.`,
    }
  }

  return { ok: true }
}

export function validarQuantidadeModoCx(
  quantidadeInformada: number
): { ok: true } | { ok: false; mensagem: string } {
  if (!(quantidadeInformada > 0)) {
    return { ok: false, mensagem: 'Quantidade deve ser maior que zero.' }
  }
  if (Math.abs(quantidadeInformada - Math.round(quantidadeInformada)) >= 1e-9) {
    return { ok: false, mensagem: 'Quantidade em caixas deve ser um número inteiro.' }
  }
  return { ok: true }
}
