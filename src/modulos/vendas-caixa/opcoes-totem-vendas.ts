import { repositorioDeCartoesPagamento } from '../cartoes-pagamento/repositorio-cartoes-pagamento.js'

export type ParcelaCreditoTotem = { numeroParcelas: number }

export function unirParcelasCreditoTotem(
  cartoes: Array<{
    ativo: boolean
    tipo: string
    permitirParcelamento: boolean
    adquirente: { ativo: boolean } | null
    taxas: Array<{ numeroParcelas: number }>
  }>
): ParcelaCreditoTotem[] {
  const numeros = new Set<number>()
  for (const cartao of cartoes) {
    if (!cartao.ativo || cartao.tipo !== 'credito') continue
    if (cartao.adquirente && !cartao.adquirente.ativo) continue
    if (!cartao.permitirParcelamento) {
      numeros.add(1)
      continue
    }
    for (const taxa of cartao.taxas) {
      if (taxa.numeroParcelas >= 1) numeros.add(taxa.numeroParcelas)
    }
  }
  return [...numeros].sort((a, b) => a - b).map((numeroParcelas) => ({ numeroParcelas }))
}

export async function listarParcelasCreditoTotem(companyId: string): Promise<ParcelaCreditoTotem[]> {
  const cartoes = await repositorioDeCartoesPagamento.listar(companyId, {
    tipo: 'credito',
    incluirInativos: false,
  })
  return unirParcelasCreditoTotem(cartoes)
}

/** Primeiro cartão crédito ativo (nome asc) com taxa para o N de parcelas. */
export async function resolverCartaoPagamentoCredito(
  companyId: string,
  numeroParcelas: number
): Promise<string | null> {
  const cartoes = await repositorioDeCartoesPagamento.listar(companyId, {
    tipo: 'credito',
    incluirInativos: false,
  })
  for (const cartao of cartoes) {
    if (!cartao.ativo || cartao.tipo !== 'credito') continue
    if (cartao.adquirente && !cartao.adquirente.ativo) continue
    const permitidas = cartao.permitirParcelamento
      ? cartao.taxas.map((t) => t.numeroParcelas)
      : [1]
    if (permitidas.includes(numeroParcelas)) return cartao.id
  }
  return null
}
