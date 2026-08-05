const PRIMEIRO_DIGITO_CFOP = /^[123567]$/
const CODIGO_CFOP_COMPLETO = /^[123567]\.\d{3}$/

export type NaturezaCfop = 'entrada' | 'saida' | 'importacao' | 'exportacao'
export type AbrangenciaCfop = 'estadual' | 'interestadual'
export type SubtipoCfop = '03' | '04' | '05' | '06'

export const SUBTIPOS_CFOP = ['03', '04', '05', '06'] as const

export const ROTULOS_SUBTIPO_CFOP: Record<SubtipoCfop, string> = {
  '03': 'Conhecimento de frete',
  '04': 'Devolução de compra',
  '05': 'Devolução de venda',
  '06': 'Doação',
}

/** Subtipo obrigatório para CFOP de entrada de CT-e / frete (regra permanente §7). */
export const SUBTIPO_CFOP_CONHECIMENTO_FRETE: SubtipoCfop = '03'

export function cfopEhConhecimentoFrete(subtipoCfop?: string | null): boolean {
  return subtipoCfop === SUBTIPO_CFOP_CONHECIMENTO_FRETE
}

export type ClassificacaoCfop = {
  natureza: NaturezaCfop
  abrangencia: AbrangenciaCfop | null
  tipo: 'entrada' | 'saida'
  rotulo: string
}

export function mascaraCodigoCfop(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 4)
  if (digitos.length === 0) return ''
  if (!PRIMEIRO_DIGITO_CFOP.test(digitos[0])) return ''
  if (digitos.length <= 1) return digitos
  return `${digitos[0]}.${digitos.slice(1)}`
}

export function codigoCfopCompleto(codigo: string): boolean {
  return CODIGO_CFOP_COMPLETO.test(codigo)
}

export function prefixoDeCodigoCfop(codigo: string): string | null {
  const match = codigo.trim().match(/^([123567])/)
  return match ? match[1] : null
}

export function inferirCfopDoCodigo(codigo: string): ClassificacaoCfop | null {
  const prefixo = prefixoDeCodigoCfop(codigo)
  if (!prefixo) return null

  switch (prefixo) {
    case '1':
      return {
        natureza: 'entrada',
        abrangencia: 'estadual',
        tipo: 'entrada',
        rotulo: 'Entrada — Estadual',
      }
    case '2':
      return {
        natureza: 'entrada',
        abrangencia: 'interestadual',
        tipo: 'entrada',
        rotulo: 'Entrada — Interestadual',
      }
    case '3':
      return {
        natureza: 'importacao',
        abrangencia: null,
        tipo: 'entrada',
        rotulo: 'Importação',
      }
    case '5':
      return {
        natureza: 'saida',
        abrangencia: 'estadual',
        tipo: 'saida',
        rotulo: 'Saída — Estadual',
      }
    case '6':
      return {
        natureza: 'saida',
        abrangencia: 'interestadual',
        tipo: 'saida',
        rotulo: 'Saída — Interestadual',
      }
    case '7':
      return {
        natureza: 'exportacao',
        abrangencia: null,
        tipo: 'saida',
        rotulo: 'Exportação',
      }
    default:
      return null
  }
}

export function rotuloExibicaoCfop(
  natureza: string,
  abrangencia: string | null,
  subtipoCfop?: string | null
): string {
  let base: string
  if (natureza === 'importacao') base = 'Importação'
  else if (natureza === 'exportacao') base = 'Exportação'
  else if (natureza === 'entrada' && abrangencia === 'estadual') base = 'Entrada — Estadual'
  else if (natureza === 'entrada' && abrangencia === 'interestadual') base = 'Entrada — Interestadual'
  else if (natureza === 'saida' && abrangencia === 'estadual') base = 'Saída — Estadual'
  else if (natureza === 'saida' && abrangencia === 'interestadual') base = 'Saída — Interestadual'
  else base = natureza

  if (subtipoCfop && subtipoCfop in ROTULOS_SUBTIPO_CFOP) {
    return `${base} · ${ROTULOS_SUBTIPO_CFOP[subtipoCfop as SubtipoCfop]}`
  }
  return base
}

export function prefixoPermiteIcms(codigo: string): boolean {
  return prefixoDeCodigoCfop(codigo) === '1'
}
