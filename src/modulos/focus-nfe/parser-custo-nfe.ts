import { extrairCampoXml } from './parser-xml-nfe.js'

export const TRIBUTOS_CUSTO = ['icms', 'icms_st', 'fcp_st', 'ipi', 'ii', 'pis', 'cofins', 'icms_frete'] as const
export type TributoCusto = typeof TRIBUTOS_CUSTO[number]
export type TributoXmlCusto = { grupo: string | null; cst: string | null; valor: number | null; base: number | null; aliquota: number | null; credito: number | null }
export type OriginalCustoXml = {
  nItem: number; quantidade: number | null; unitario: number | null; bruto: number | null
  desconto: number | null; frete: number | null; seguro: number | null; outras: number | null
  indTot: string | null; tributos: Partial<Record<TributoCusto, TributoXmlCusto>>
  invalidos?: string[]
}

function bloco(xml: string, tag: string) {
  return xml.match(new RegExp(`<(?:[\\w.]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.]+:)?${tag}>`, 'i'))?.[1] ?? null
}
function numero(xml: string | null, tag: string) {
  const texto = xml == null ? null : extrairCampoXml(xml, tag)
  if (texto == null) return null
  const n = Number(texto)
  return Number.isFinite(n) && n >= 0 ? n : null
}
function imposto(xml: string, pai: string, valor: string, base: string, aliquota: string): TributoXmlCusto {
  const conteudo = bloco(xml, pai)
  const grupo = conteudo?.match(/<(?:[\w.]+:)?([\w]+)\b/)?.[1] ?? null
  const cst = conteudo ? extrairCampoXml(conteudo, 'CST') ?? extrairCampoXml(conteudo, 'CSOSN') : null
  return { grupo, cst, valor: numero(conteudo, valor), base: numero(conteudo, base), aliquota: numero(conteudo, aliquota), credito: null }
}

export function extrairCustosXml(xml: string | null | undefined) {
  const itens: OriginalCustoXml[] = []
  if (!xml) return { itens, totais: {} as Record<string, number | null>, completo: false }
  const dets = xml.matchAll(/<(?:[\w.]+:)?det\b([^>]*)>([\s\S]*?)<\/(?:[\w.]+:)?det>/gi)
  for (const m of dets) {
    const nItem = Number(m[1].match(/\bnItem\s*=\s*["'](\d+)["']/i)?.[1])
    const prod = bloco(m[2], 'prod')
    const imp = bloco(m[2], 'imposto') ?? ''
    const icms = imposto(imp, 'ICMS', 'vICMS', 'vBC', 'pICMS')
    const creditoSn = numero(bloco(imp, 'ICMS'), 'vCredICMSSN')
    icms.credito = creditoSn ?? icms.valor
    if (creditoSn != null) icms.aliquota = numero(bloco(imp, 'ICMS'), 'pCredSN')
    const st = imposto(imp, 'ICMS', 'vICMSST', 'vBCST', 'pICMSST')
    const fcp = imposto(imp, 'ICMS', 'vFCPST', 'vBCFCPST', 'pFCPST')
    const ipi = imposto(imp, 'IPI', 'vIPI', 'vBC', 'pIPI')
    // IPI has cEnq before its taxable/non-taxable group.
    const ipiGrupo = bloco(imp, 'IPI')?.match(/<(?:[\w.]+:)?(IPITrib|IPINT)\b/i)?.[1] ?? null
    ipi.grupo = ipiGrupo
    const ii = imposto(imp, 'II', 'vII', 'vBC', 'pII')
    ii.grupo = bloco(imp, 'II') == null ? null : 'II'
    ii.cst = ii.grupo ? 'sem_cst' : null
    const invalidos = [...m[2].matchAll(/<(?:[\w.]+:)?(qCom|vUnCom|vProd|vDesc|vFrete|vSeg|vOutro|vICMS|vICMSST|vFCPST|vIPI|vII|vPIS|vCOFINS|vBC|vBCST|vBCFCPST|pICMS|pCredSN|vCredICMSSN)\b[^>]*>([^<]*)<\//gi)].filter(x => !x[2].trim() || !Number.isFinite(Number(x[2])) || Number(x[2]) < 0).map(x => x[1])
    itens.push({ nItem, invalidos, quantidade: numero(prod, 'qCom'), unitario: numero(prod, 'vUnCom'), bruto: numero(prod, 'vProd'),
      desconto: numero(prod, 'vDesc'), frete: numero(prod, 'vFrete'), seguro: numero(prod, 'vSeg'), outras: numero(prod, 'vOutro'),
      indTot: prod ? extrairCampoXml(prod, 'indTot') : null,
      tributos: { icms, icms_st: st, fcp_st: fcp, ipi, ii,
        pis: imposto(imp, 'PIS', 'vPIS', 'vBC', 'pPIS'), cofins: imposto(imp, 'COFINS', 'vCOFINS', 'vBC', 'pCOFINS') } })
  }
  const total = bloco(xml, 'ICMSTot')
  const tags = ['vProd', 'vDesc', 'vFrete', 'vSeg', 'vOutro', 'vICMS', 'vST', 'vFCPST', 'vIPI', 'vII', 'vPIS', 'vCOFINS', 'vNF', 'vIPIDevol', 'vICMSDeson', 'vFCP', 'vTotTrib']
  const totais = Object.fromEntries(tags.map(tag => [tag, numero(total, tag)]))
  return { itens, totais, completo: itens.length > 0 && total != null && bloco(xml, 'infNFe') != null }
}
