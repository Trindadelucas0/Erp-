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

export type ClassificacaoCfop = {
  natureza: NaturezaCfop
  abrangencia: AbrangenciaCfop | null
  tipo: 'entrada' | 'saida'
  tipoCfopBase: '01' | '02'
  rotulo: string
}

export function prefixoDeCodigoCfop(codigo: string): string | null {
  const match = codigo.trim().match(/^([123567])/)
  return match ? match[1] : null
}

export function inferirCfopDoCodigo(codigo: string): ClassificacaoCfop {
  const prefixo = prefixoDeCodigoCfop(codigo)
  if (!prefixo) {
    throw new Error('Código CFOP inválido para classificação')
  }

  switch (prefixo) {
    case '1':
      return {
        natureza: 'entrada',
        abrangencia: 'estadual',
        tipo: 'entrada',
        tipoCfopBase: '01',
        rotulo: 'Entrada — Estadual',
      }
    case '2':
      return {
        natureza: 'entrada',
        abrangencia: 'interestadual',
        tipo: 'entrada',
        tipoCfopBase: '01',
        rotulo: 'Entrada — Interestadual',
      }
    case '3':
      return {
        natureza: 'importacao',
        abrangencia: null,
        tipo: 'entrada',
        tipoCfopBase: '01',
        rotulo: 'Importação',
      }
    case '5':
      return {
        natureza: 'saida',
        abrangencia: 'estadual',
        tipo: 'saida',
        tipoCfopBase: '02',
        rotulo: 'Saída — Estadual',
      }
    case '6':
      return {
        natureza: 'saida',
        abrangencia: 'interestadual',
        tipo: 'saida',
        tipoCfopBase: '02',
        rotulo: 'Saída — Interestadual',
      }
    case '7':
      return {
        natureza: 'exportacao',
        abrangencia: null,
        tipo: 'saida',
        tipoCfopBase: '02',
        rotulo: 'Exportação',
      }
    default:
      throw new Error('Prefixo CFOP inválido')
  }
}

export function tipoCfopFinal(
  classificacao: ClassificacaoCfop,
  subtipoCfop?: string | null
): string {
  if (subtipoCfop && SUBTIPOS_CFOP.includes(subtipoCfop as SubtipoCfop)) {
    return subtipoCfop
  }
  return classificacao.tipoCfopBase
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

export function aproveitarCreditoIcmsPermitido(codigo: string, valor?: boolean): boolean {
  return prefixoDeCodigoCfop(codigo) === '1' && valor === true
}

export function naturezaEhEntradaFornecedor(natureza: string): boolean {
  return natureza === 'entrada' || natureza === 'importacao'
}
