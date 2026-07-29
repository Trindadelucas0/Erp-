/**
 * NFe 55 de Consumo/Prestador (sem Revenda) entra em modo documental:
 * sem vínculo obrigatório de produtos nem exigência de PO — a menos que
 * `exigirItensEntrada` esteja marcado no fornecedor.
 */
export type FlagsFornecedorEntrada = {
  tipoRevenda?: boolean | null
  tipoConsumo?: boolean | null
  tipoPrestadorServico?: boolean | null
  exigirItensEntrada?: boolean | null
  permitirVinculoManual?: boolean | null
}

export function resolverModoDocumentalEntrada(
  flags: FlagsFornecedorEntrada | null | undefined
): boolean {
  if (!flags) return false
  const consumoOuPrestador = Boolean(flags.tipoConsumo) || Boolean(flags.tipoPrestadorServico)
  if (!consumoOuPrestador) return false
  if (flags.tipoRevenda) return false
  if (flags.exigirItensEntrada) return false
  return true
}

export function extrairFlagsFornecedorDaNota(nota: {
  fornecedorPessoa?: {
    papeis?: Array<{
      dadosFornecedor?: FlagsFornecedorEntrada | null
    } | null>
  } | null
}): FlagsFornecedorEntrada | null {
  return nota.fornecedorPessoa?.papeis?.[0]?.dadosFornecedor ?? null
}
