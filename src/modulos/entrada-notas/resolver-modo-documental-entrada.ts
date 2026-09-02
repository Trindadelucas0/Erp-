/**
 * Modo documental da Entrada: NFS-e sempre; NFe 55 só com finalidade da nota
 * `uso_consumo`. Flags do fornecedor habilitam opções — não inferem o fluxo.
 */
export type FlagsFornecedorEntrada = {
  tipoRevenda?: boolean | null
  tipoConsumo?: boolean | null
  tipoPrestadorServico?: boolean | null
  exigirItensEntrada?: boolean | null
  permitirVinculoManual?: boolean | null
}

export const FINALIDADES_ENTRADA = ['revenda', 'uso_consumo'] as const
export type FinalidadeEntrada = (typeof FINALIDADES_ENTRADA)[number]

export const MSG_FINALIDADE_ENTRADA = 'Defina a finalidade da entrada'

export const STATUS_PERMITE_TROCA_FINALIDADE = [
  'pendente',
  'em_analise',
  'stand_by',
] as const

export type ParamsModoDocumentalEntrada = {
  tipoDocumento?: string | null
  finalidadeEntrada?: string | null
}

export function ehFinalidadeEntrada(valor: unknown): valor is FinalidadeEntrada {
  return valor === 'revenda' || valor === 'uso_consumo'
}

export function resolverModoDocumentalEntrada(
  params: ParamsModoDocumentalEntrada | null | undefined
): boolean {
  if (!params) return false
  if (params.tipoDocumento === 'nfse') return true
  return params.finalidadeEntrada === 'uso_consumo'
}

export function finalidadeHabilitadaNoFornecedor(
  finalidade: FinalidadeEntrada,
  flags: FlagsFornecedorEntrada | null | undefined
): boolean {
  if (!flags) return false
  if (finalidade === 'revenda') return Boolean(flags.tipoRevenda)
  return Boolean(flags.tipoConsumo) || Boolean(flags.tipoPrestadorServico)
}

export function statusPermiteTrocaFinalidade(statusEntrada: string | null | undefined): boolean {
  return (
    statusEntrada === 'pendente' ||
    statusEntrada === 'em_analise' ||
    statusEntrada === 'stand_by'
  )
}

/**
 * Réplica da regra antiga (flags do fornecedor) — só para backfill de notas
 * já lançadas/consolidadas. Não usar no pipeline.
 */
export function inferirFinalidadeLegadoDasFlags(
  flags: FlagsFornecedorEntrada | null | undefined
): FinalidadeEntrada {
  if (!flags) return 'revenda'
  const consumoOuPrestador =
    Boolean(flags.tipoConsumo) || Boolean(flags.tipoPrestadorServico)
  if (consumoOuPrestador && !flags.tipoRevenda && !flags.exigirItensEntrada) {
    return 'uso_consumo'
  }
  return 'revenda'
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
