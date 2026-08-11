/**
 * Extrai chave, resumo e itens de XML fiscal: NFe modelo 55, NFS-e nacional ou CTe.
 * Itens de produto (`extrairItensDoXml`) só se aplicam à NFe 55.
 */
export function normalizarXmlNfe(xml: string): string {
  return xml.replace(/^\uFEFF/, '').trim()
}

/** Classifica o XML fiscal (NFe 55 | NFS-e | CTe). */
export function detectarDocumentoFiscalXml(
  xmlBruto: string
): 'nfe55' | 'nfse' | 'cte' | 'desconhecido' {
  const xml = normalizarXmlNfe(xmlBruto)
  if (!xml) return 'desconhecido'

  if (
    /<(?:[\w.]+:)?NFSe\b/i.test(xml) ||
    /sped\.fazenda\.gov\.br\/nfse/i.test(xml) ||
    /\bId\s*=\s*["']NFS\d+/i.test(xml) ||
    /<(?:[\w.]+:)?infNFSe\b/i.test(xml)
  ) {
    return 'nfse'
  }

  if (
    /<(?:[\w.]+:)?(?:cteProc|CTe|infCte)\b/i.test(xml) ||
    /Id\s*=\s*["']CTe\d{44}/i.test(xml) ||
    /<(?:[\w.]+:)?chCTe\b/i.test(xml)
  ) {
    return 'cte'
  }

  if (
    /<(?:[\w.]+:)?(?:nfeProc|NFe|infNFe)\b/i.test(xml) ||
    /Id\s*=\s*["']NFe\d{44}/i.test(xml) ||
    /<(?:[\w.]+:)?chNFe\b/i.test(xml)
  ) {
    return 'nfe55'
  }

  return 'desconhecido'
}

export function extrairChaveNfeDoXml(xmlBruto: string): string | null {
  const xml = normalizarXmlNfe(xmlBruto)
  if (!xml) return null

  const porAtributo = xml.match(/Id\s*=\s*["']NFe(\d{44})["']/i)
  if (porAtributo?.[1]) return porAtributo[1]

  const porIdSoDigitos = xml.match(/\bId\s*=\s*["'](\d{44})["']/i)
  if (porIdSoDigitos?.[1]) return porIdSoDigitos[1]

  const porTag = xml.match(/<(?:[\w.]+:)?chNFe[^>]*>\s*(\d{44})\s*<\/(?:[\w.]+:)?chNFe>/i)
  if (porTag?.[1]) return porTag[1]

  const generico = xml.match(/(\d{44})/)
  return generico?.[1] ?? null
}

function desembrulharCdata(conteudo: string): string {
  const m = conteudo.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i)
  return (m?.[1] ?? conteudo).trim()
}

export function extrairCampoXml(xmlBruto: string, tag: string): string | null {
  const xml = normalizarXmlNfe(xmlBruto)
  // `\b` evita que `toma` case `toma3`/`toma4` (layout CT-e comum Focus/Hivelog).
  const re = new RegExp(
    `<(?:[\\w.]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.]+:)?${tag}\\b>`,
    'i'
  )
  const m = xml.match(re)
  if (!m?.[1]) return null
  const texto = desembrulharCdata(m[1].trim())
  return texto || null
}

/** Conteúdo interno da primeira tag (com namespace opcional), não guloso demais. */
function blocoTag(xml: string, tag: string): string | null {
  const re = new RegExp(
    `<(?:[\\w.]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.]+:)?${tag}>`,
    'i'
  )
  const m = xml.match(re)
  return m?.[1] ?? null
}

function todosBlocosTag(xml: string, tag: string): string[] {
  const re = new RegExp(
    `<(?:[\\w.]+:)?${tag}\\b([^>]*)>([\\s\\S]*?)</(?:[\\w.]+:)?${tag}>`,
    'gi'
  )
  const blocos: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    blocos.push(m[0])
  }
  return blocos
}

function atributoTag(aberturaComAttrs: string, nome: string): string | null {
  const re = new RegExp(`\\b${nome}\\s*=\\s*["']([^"']+)["']`, 'i')
  const m = aberturaComAttrs.match(re)
  return m?.[1]?.trim() ?? null
}

function parseDataEmissao(texto: string | null): Date | null {
  if (!texto) return null
  const d = new Date(texto)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseValor(texto: string | null): number | null {
  if (!texto) return null
  const limpo = texto
    .trim()
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

function limparGtin(valor: string | null): string | null {
  if (!valor) return null
  const limpo = valor.replace(/\D/g, '')
  if (!limpo || /^0+$/.test(limpo)) return null
  return limpo
}

function extrairCstOrigem(blocoImposto: string | null): { cst: string | null; origem: string | null } {
  if (!blocoImposto) return { cst: null, origem: null }
  const candidatos = [
    'ICMS00',
    'ICMS10',
    'ICMS20',
    'ICMS30',
    'ICMS40',
    'ICMS51',
    'ICMS60',
    'ICMS70',
    'ICMS90',
    'ICMSSN101',
    'ICMSSN102',
    'ICMSSN201',
    'ICMSSN202',
    'ICMSSN500',
    'ICMSSN900',
  ]
  for (const tag of candidatos) {
    const bloco = blocoTag(blocoImposto, tag)
    if (!bloco) continue
    const origem = extrairCampoXml(bloco, 'orig')
    const cst = extrairCampoXml(bloco, 'CST') ?? extrairCampoXml(bloco, 'CSOSN')
    return { cst, origem }
  }
  return {
    cst: extrairCampoXml(blocoImposto, 'CST') ?? extrairCampoXml(blocoImposto, 'CSOSN'),
    origem: extrairCampoXml(blocoImposto, 'orig'),
  }
}

export type CamposResumoXmlNfe = {
  chaveNfe: string | null
  nomeEmitente: string | null
  documentoEmitente: string | null
  cnpjDestinatario: string | null
  dataEmissao: Date | null
  valorTotal: number | null
  prazoPagamentoXml: string | null
  tipoDocumento?: 'nfe55' | 'nfse' | 'cte'
  /** NFe 55: transp/modFrete */
  modFrete?: string | null
  /** CTe: chaves de NF-e referenciadas (infDoc/infNFe) */
  chavesNfeReferenciadas?: string[]
  /** CTe: primeira chave referenciada */
  chaveNfeReferenciada?: string | null
}

export type ItemXmlNfe = {
  nItem: number
  descricao: string | null
  gtin: string | null
  codigoProduto: string | null
  ncm: string | null
  cfop: string | null
  cst: string | null
  origem: string | null
  unidade: string | null
  quantidade: number | null
  valorUnitario: number | null
  valorTotal: number | null
  pesoKg?: number | null
}

/**
 * Itens da consulta Focus `GET /nfes_recebidas/{chave}?completa=1`
 * (`requisicao_nota_fiscal.itens`) — usado quando o endpoint `.xml` ainda
 * devolve só o resumo DistDFe (`resNFe`).
 */
export function extrairItensDoJsonFocusCompleta(
  dados: Record<string, unknown> | null | undefined
): ItemXmlNfe[] {
  if (!dados || typeof dados !== 'object') return []
  const req = dados.requisicao_nota_fiscal
  if (!req || typeof req !== 'object') return []
  const lista = (req as { itens?: unknown }).itens
  if (!Array.isArray(lista) || lista.length === 0) return []

  return lista.map((raw, indice) => {
    const it = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const nItem = Number(it.numero_item ?? indice + 1)
    return {
      nItem: Number.isFinite(nItem) && nItem > 0 ? nItem : indice + 1,
      descricao: it.descricao != null ? String(it.descricao) : null,
      gtin: limparGtin(it.codigo_barras_comercial != null ? String(it.codigo_barras_comercial) : null),
      codigoProduto: it.codigo_produto != null ? String(it.codigo_produto) : null,
      ncm: it.codigo_ncm != null ? String(it.codigo_ncm) : null,
      cfop: it.cfop != null ? String(it.cfop) : null,
      cst: it.icms_situacao_tributaria != null ? String(it.icms_situacao_tributaria) : null,
      origem: it.icms_origem != null ? String(it.icms_origem) : null,
      unidade: it.unidade_comercial != null ? String(it.unidade_comercial) : null,
      quantidade: parseValor(
        it.quantidade_comercial != null ? String(it.quantidade_comercial) : null
      ),
      valorUnitario: parseValor(
        it.valor_unitario_comercial != null ? String(it.valor_unitario_comercial) : null
      ),
      valorTotal: parseValor(it.valor_bruto != null ? String(it.valor_bruto) : null),
      pesoKg: null,
    }
  })
}

export function extrairChaveNfseDoXml(xmlBruto: string): string | null {
  const xml = normalizarXmlNfe(xmlBruto)
  const porId = xml.match(/\bId\s*=\s*["'](NFS[A-Za-z0-9]+)["']/i)
  if (porId?.[1]) return porId[1]
  const porInf = xml.match(/<(?:[\w.]+:)?infNFSe\b[^>]*\bId\s*=\s*["']([^"']+)["']/i)
  if (porInf?.[1]) return porInf[1]
  return null
}

/** Resumo de XML NFS-e nacional (Ambiente Nacional). */
export function extrairCamposResumoDoXmlNfse(xmlBruto: string): CamposResumoXmlNfe {
  const xml = normalizarXmlNfe(xmlBruto)
  const chaveNfe = extrairChaveNfseDoXml(xml)

  const emit = blocoTag(xml, 'emit')
  const prest = blocoTag(xml, 'prest')
  const toma = blocoTag(xml, 'toma') ?? blocoTag(xml, 'tomador')

  const nomeEmitente =
    (emit ? extrairCampoXml(emit, 'xNome') : null) ?? extrairCampoXml(xml, 'xNome')
  const documentoEmitente =
    (emit ? extrairCampoXml(emit, 'CNPJ') ?? extrairCampoXml(emit, 'CPF') : null) ??
    (prest ? extrairCampoXml(prest, 'CNPJ') ?? extrairCampoXml(prest, 'CPF') : null)

  const cnpjDestinatario = toma
    ? extrairCampoXml(toma, 'CNPJ') ?? extrairCampoXml(toma, 'CPF')
    : null

  const dhEmi =
    extrairCampoXml(xml, 'dhEmi') ??
    extrairCampoXml(xml, 'dhProc') ??
    extrairCampoXml(xml, 'dCompet')

  const valorTotal =
    parseValor(extrairCampoXml(xml, 'vLiq')) ??
    parseValor(extrairCampoXml(xml, 'vServ')) ??
    parseValor(extrairCampoXml(xml, 'vServPrest'))

  return {
    chaveNfe,
    nomeEmitente,
    documentoEmitente,
    cnpjDestinatario,
    dataEmissao: parseDataEmissao(dhEmi),
    valorTotal,
    prazoPagamentoXml: null,
    tipoDocumento: 'nfse',
  }
}

export function extrairChaveCteDoXml(xmlBruto: string): string | null {
  const xml = normalizarXmlNfe(xmlBruto)
  if (!xml) return null

  const porAtributo = xml.match(/Id\s*=\s*["']CTe(\d{44})["']/i)
  if (porAtributo?.[1]) return porAtributo[1]

  const porTag = xml.match(/<(?:[\w.]+:)?chCTe[^>]*>\s*(\d{44})\s*<\/(?:[\w.]+:)?chCTe>/i)
  if (porTag?.[1]) return porTag[1]

  const porIdSoDigitos = xml.match(/\bId\s*=\s*["'](\d{44})["']/i)
  if (porIdSoDigitos?.[1]) {
    const chave = porIdSoDigitos[1]
    // Modelo 57 = CTe (posições 21-22 da chave, índice 20-21)
    if (chave.slice(20, 22) === '57') return chave
  }

  return null
}

function documentoCnpjOuCpfDoBloco(bloco: string | null): string | null {
  if (!bloco) return null
  return extrairCampoXml(bloco, 'CNPJ') ?? extrairCampoXml(bloco, 'CPF')
}

/**
 * CNPJ/CPF do tomador do frete no CT-e.
 * `ide/toma` (ou toma3/toma4): 0=rem, 1=exped, 2=receb, 3=dest, 4=outros (toma4).
 * Sem indicador legível ou sem documento → null (fail-closed no filtro).
 */
export function extrairCnpjTomadorCte(xmlBruto: string): string | null {
  const xml = normalizarXmlNfe(xmlBruto)
  if (!xml) return null

  const ide = blocoTag(xml, 'ide')
  const toma3 = blocoTag(xml, 'toma3')
  const toma4 = blocoTag(xml, 'toma4')

  // Preferir toma3/toma4 (layout Focus/Hivelog) antes de ide/toma solto.
  const indicador =
    (toma3 ? extrairCampoXml(toma3, 'toma') : null) ??
    (toma4 ? extrairCampoXml(toma4, 'toma') : null) ??
    (ide ? extrairCampoXml(ide, 'toma') : null)

  const rem = blocoTag(xml, 'rem')
  const exped = blocoTag(xml, 'exped')
  const receb = blocoTag(xml, 'receb')
  const dest = blocoTag(xml, 'dest')

  switch ((indicador ?? '').trim()) {
    case '0':
      return documentoCnpjOuCpfDoBloco(rem)
    case '1':
      return documentoCnpjOuCpfDoBloco(exped)
    case '2':
      return documentoCnpjOuCpfDoBloco(receb)
    case '3':
      return documentoCnpjOuCpfDoBloco(dest)
    case '4':
      return (
        documentoCnpjOuCpfDoBloco(toma4) ??
        documentoCnpjOuCpfDoBloco(blocoTag(xml, 'toma'))
      )
    default:
      return (
        documentoCnpjOuCpfDoBloco(toma4) ??
        documentoCnpjOuCpfDoBloco(blocoTag(xml, 'toma')) ??
        documentoCnpjOuCpfDoBloco(toma3)
      )
  }
}

/**
 * Chaves de NF-e (44 dígitos) referenciadas no CT-e (`infDoc` / `infNFe` / `chave` / `chNFe`).
 */
export function extrairChavesNfeReferenciadasDoCte(xmlBruto: string): string[] {
  const xml = normalizarXmlNfe(xmlBruto)
  if (!xml) return []

  const chaves = new Set<string>()
  const adicionar = (raw: string | null | undefined) => {
    if (!raw) return
    const digitos = raw.replace(/\D/g, '')
    if (digitos.length === 44 && digitos.slice(20, 22) === '55') {
      chaves.add(digitos)
    }
  }

  const infDocs = todosBlocosTag(xml, 'infDoc')
  for (const infDoc of infDocs) {
    for (const infNFe of todosBlocosTag(infDoc, 'infNFe')) {
      adicionar(extrairCampoXml(infNFe, 'chave') ?? extrairCampoXml(infNFe, 'chNFe'))
    }
    for (const infNFeTran of todosBlocosTag(infDoc, 'infNFeTran')) {
      adicionar(extrairCampoXml(infNFeTran, 'chave') ?? extrairCampoXml(infNFeTran, 'chNFe'))
    }
  }

  // Fallback: qualquer <chave> / <chNFe> de 44 dígitos modelo 55 no XML do CT-e
  if (chaves.size === 0) {
    for (const m of xml.matchAll(
      /<(?:[\w.]+:)?(?:chave|chNFe)[^>]*>\s*(\d{44})\s*<\/(?:[\w.]+:)?(?:chave|chNFe)>/gi
    )) {
      adicionar(m[1])
    }
  }

  return [...chaves]
}

/**
 * Modalidade do frete na NFe 55 (`transp/modFrete`).
 * 0=remetente, 1=destinatário, 2=terceiros, 3=próprio rem., 4=próprio dest., 9=sem frete.
 */
export function extrairModFreteDoXml(xmlBruto: string): string | null {
  const xml = normalizarXmlNfe(xmlBruto)
  if (!xml || detectarDocumentoFiscalXml(xml) !== 'nfe55') return null

  const transp = blocoTag(xml, 'transp')
  const raw = (transp ? extrairCampoXml(transp, 'modFrete') : null) ?? extrairCampoXml(xml, 'modFrete')
  if (raw == null) return null
  const digito = raw.trim().replace(/\D/g, '')
  if (!digito) return null
  return digito.slice(0, 1)
}

export type DadosTransporteXmlNfe = {
  qtdVolumes: number | null
  pesoBruto: number | null
  pesoLiquido: number | null
  /** Frete declarado na NF (`ICMSTot/vFrete`), não o valor do CT-e. */
  valorFreteNf: number | null
}

/**
 * Volumes/pesos do bloco `transp/vol` e `vFrete` do total da NFe 55.
 * Soma `qVol` / `pesoB` / `pesoL` quando há vários `<vol>`.
 */
export function extrairDadosTransporteDoXmlNfe(xmlBruto: string): DadosTransporteXmlNfe | null {
  const xml = normalizarXmlNfe(xmlBruto)
  if (!xml || detectarDocumentoFiscalXml(xml) !== 'nfe55') return null

  const transp = blocoTag(xml, 'transp')
  const vols = transp ? todosBlocosTag(transp, 'vol') : todosBlocosTag(xml, 'vol')

  let qtdVolumes = 0
  let pesoBruto = 0
  let pesoLiquido = 0
  let temVol = false
  let temPesoB = false
  let temPesoL = false

  for (const vol of vols) {
    temVol = true
    const q = parseValor(extrairCampoXml(vol, 'qVol'))
    if (q != null) qtdVolumes += q
    const pb = parseValor(extrairCampoXml(vol, 'pesoB'))
    if (pb != null) {
      pesoBruto += pb
      temPesoB = true
    }
    const pl = parseValor(extrairCampoXml(vol, 'pesoL'))
    if (pl != null) {
      pesoLiquido += pl
      temPesoL = true
    }
  }

  const total = blocoTag(xml, 'total')
  const icmsTot = total ? blocoTag(total, 'ICMSTot') : null
  const valorFreteNf =
    parseValor(icmsTot ? extrairCampoXml(icmsTot, 'vFrete') : null) ??
    parseValor(extrairCampoXml(xml, 'vFrete'))

  if (!temVol && valorFreteNf == null) return null

  return {
    qtdVolumes: temVol ? qtdVolumes : null,
    pesoBruto: temPesoB ? pesoBruto : null,
    pesoLiquido: temPesoL ? pesoLiquido : null,
    valorFreteNf,
  }
}

export type IcmsXmlCte = {
  baseCalculoIcms: number | null
  aliquotaIcms: number | null
  valorIcms: number | null
}

/**
 * CFOP do CT-e (`ide/CFOP`). Somente leitura — usado na aba Frete/CT-e.
 */
export function extrairCfopDoXmlCte(xmlBruto: string): string | null {
  const xml = normalizarXmlNfe(xmlBruto)
  if (!xml || detectarDocumentoFiscalXml(xml) !== 'cte') return null

  const ide = blocoTag(xml, 'ide')
  const cfop =
    (ide ? extrairCampoXml(ide, 'CFOP') : null) ?? extrairCampoXml(xml, 'CFOP')
  const codigo = (cfop ?? '').replace(/\D/g, '').trim()
  return codigo || null
}

/**
 * ICMS do CT-e (`imp/ICMS` → grupo CST: ICMS00, ICMS20, ICMS45, ICMS60, ICMS90, ICMSOutraUF…).
 * Grupos padrão usam `vBC`/`pICMS`/`vICMS`; ICMSOutraUF usa `vBCOutraUF`/`pICMSOutraUF`/`vICMSOutraUF`.
 */
export function extrairIcmsDoXmlCte(xmlBruto: string): IcmsXmlCte | null {
  const xml = normalizarXmlNfe(xmlBruto)
  if (!xml || detectarDocumentoFiscalXml(xml) !== 'cte') return null

  const imp = blocoTag(xml, 'imp')
  const icms = (imp ? blocoTag(imp, 'ICMS') : null) ?? blocoTag(xml, 'ICMS')
  const escopo = icms ?? imp ?? xml

  // Preferir bloco ICMSOutraUF quando presente (tags vBC/pICMS/vICMS não existem nesse grupo).
  const outraUf = blocoTag(escopo, 'ICMSOutraUF')
  if (outraUf) {
    const baseCalculoIcms = parseValor(extrairCampoXml(outraUf, 'vBCOutraUF'))
    const aliquotaIcms = parseValor(extrairCampoXml(outraUf, 'pICMSOutraUF'))
    const valorIcms = parseValor(extrairCampoXml(outraUf, 'vICMSOutraUF'))
    if (baseCalculoIcms != null || aliquotaIcms != null || valorIcms != null) {
      return { baseCalculoIcms, aliquotaIcms, valorIcms }
    }
  }

  const baseCalculoIcms =
    parseValor(extrairCampoXml(escopo, 'vBC')) ??
    parseValor(extrairCampoXml(escopo, 'vBCOutraUF'))
  const aliquotaIcms =
    parseValor(extrairCampoXml(escopo, 'pICMS')) ??
    parseValor(extrairCampoXml(escopo, 'pICMSOutraUF'))
  const valorIcms =
    parseValor(extrairCampoXml(escopo, 'vICMS')) ??
    parseValor(extrairCampoXml(escopo, 'vICMSOutraUF'))

  if (baseCalculoIcms == null && aliquotaIcms == null && valorIcms == null) return null

  return { baseCalculoIcms, aliquotaIcms, valorIcms }
}

export type SugestaoFinanceiroXmlCte = {
  numeroDocumento: string | null
  valor: number | null
}

/**
 * Sugestão para o card Financeiro (prévia): número = `ide/nCT`, valor = `vPrest/vRec`.
 * Não altera `valorTotal` do resumo (que continua preferindo `vTPrest`).
 */
export function extrairSugestaoFinanceiroDoXmlCte(
  xmlBruto: string
): SugestaoFinanceiroXmlCte | null {
  const xml = normalizarXmlNfe(xmlBruto)
  if (!xml || detectarDocumentoFiscalXml(xml) !== 'cte') return null

  const ide = blocoTag(xml, 'ide')
  const vPrest = blocoTag(xml, 'vPrest')
  const numeroRaw =
    (ide ? extrairCampoXml(ide, 'nCT') : null) ?? extrairCampoXml(xml, 'nCT')
  const numeroDocumento = (numeroRaw ?? '').trim() || null
  const valor =
    parseValor(vPrest ? extrairCampoXml(vPrest, 'vRec') : null) ??
    parseValor(extrairCampoXml(xml, 'vRec'))

  if (numeroDocumento == null && valor == null) return null
  return { numeroDocumento, valor }
}

/** Resumo de XML CTe (conhecimento de transporte). */
export function extrairCamposResumoDoXmlCte(xmlBruto: string): CamposResumoXmlNfe {
  const xml = normalizarXmlNfe(xmlBruto)
  const chaveNfe = extrairChaveCteDoXml(xml)

  const emit = blocoTag(xml, 'emit')
  const dest = blocoTag(xml, 'dest')
  const ide = blocoTag(xml, 'ide')
  const vPrest = blocoTag(xml, 'vPrest')

  const nomeEmitente = emit ? extrairCampoXml(emit, 'xNome') : null
  const documentoEmitente = emit
    ? extrairCampoXml(emit, 'CNPJ') ?? extrairCampoXml(emit, 'CPF')
    : null

  // Destinatário ≠ tomador: não misturar com toma/toma4.
  const cnpjDestinatario = documentoCnpjOuCpfDoBloco(dest)

  const dhEmi =
    (ide ? extrairCampoXml(ide, 'dhEmi') : null) ??
    extrairCampoXml(xml, 'dhEmi') ??
    (ide ? extrairCampoXml(ide, 'dEmi') : null)

  const valorTotal =
    parseValor(vPrest ? extrairCampoXml(vPrest, 'vTPrest') : null) ??
    parseValor(vPrest ? extrairCampoXml(vPrest, 'vRec') : null) ??
    parseValor(extrairCampoXml(xml, 'vTPrest'))

  const chavesNfeReferenciadas = extrairChavesNfeReferenciadasDoCte(xml)

  return {
    chaveNfe,
    nomeEmitente,
    documentoEmitente,
    cnpjDestinatario,
    dataEmissao: parseDataEmissao(dhEmi),
    valorTotal,
    prazoPagamentoXml: null,
    tipoDocumento: 'cte',
    chavesNfeReferenciadas,
    chaveNfeReferenciada: chavesNfeReferenciadas[0] ?? null,
  }
}

/**
 * Preferência: dados do bloco &lt;emit&gt; / &lt;dest&gt; / ide / total
 * (evita pegar xNome/CNPJ do destinatário como emitente).
 */
export function extrairCamposResumoDoXml(xmlBruto: string): CamposResumoXmlNfe {
  const tipo = detectarDocumentoFiscalXml(xmlBruto)
  if (tipo === 'nfse') {
    return extrairCamposResumoDoXmlNfse(xmlBruto)
  }
  if (tipo === 'cte') {
    return extrairCamposResumoDoXmlCte(xmlBruto)
  }

  const xml = normalizarXmlNfe(xmlBruto)
  const chaveNfe = extrairChaveNfeDoXml(xml)

  const emit = blocoTag(xml, 'emit')
  const dest = blocoTag(xml, 'dest')
  const ide = blocoTag(xml, 'ide')
  const total = blocoTag(xml, 'total')
  const icmsTot = total ? blocoTag(total, 'ICMSTot') : null
  const issqnTot = total ? blocoTag(total, 'ISSQNtot') : null

  const nomeEmitente = emit
    ? extrairCampoXml(emit, 'xNome')
    : extrairCampoXml(xml, 'xNome')
  const documentoEmitente = emit
    ? extrairCampoXml(emit, 'CNPJ') ?? extrairCampoXml(emit, 'CPF')
    : extrairCampoXml(xml, 'CNPJ')
  const cnpjDestinatario = dest ? extrairCampoXml(dest, 'CNPJ') : null

  const dhEmi =
    (ide ? extrairCampoXml(ide, 'dhEmi') : null) ??
    extrairCampoXml(xml, 'dhEmi') ??
    (ide ? extrairCampoXml(ide, 'dEmi') : null) ??
    extrairCampoXml(xml, 'dEmi')

  const vNFTexto =
    (icmsTot ? extrairCampoXml(icmsTot, 'vNF') : null) ??
    (issqnTot ? extrairCampoXml(issqnTot, 'vNF') : null) ??
    extrairCampoXml(xml, 'vNF')

  let valorTotal = parseValor(vNFTexto)
  if (valorTotal == null) {
    const itens = extrairItensDoXml(xml)
    const comValor = itens.filter((item) => item.valorTotal != null)
    if (comValor.length > 0) {
      const soma = comValor.reduce((acc, item) => acc + (item.valorTotal ?? 0), 0)
      valorTotal = Number.isFinite(soma) ? soma : null
    }
  }

  const vencimentos = [...xml.matchAll(/<(?:[\w.]+:)?dVenc[^>]*>\s*([^<]+)\s*<\/(?:[\w.]+:)?dVenc>/gi)].map(
    (m) => m[1].trim()
  )
  const prazoPagamentoXml = vencimentos.length > 0 ? vencimentos.join(', ') : null
  const modFrete = extrairModFreteDoXml(xml)

  return {
    chaveNfe,
    nomeEmitente,
    documentoEmitente,
    cnpjDestinatario,
    dataEmissao: parseDataEmissao(dhEmi),
    valorTotal,
    prazoPagamentoXml,
    tipoDocumento: 'nfe55',
    modFrete,
  }
}

export function extrairItensDoXml(xmlBruto: string): ItemXmlNfe[] {
  const xml = normalizarXmlNfe(xmlBruto)
  const dets = todosBlocosTag(xml, 'det')
  const itens: ItemXmlNfe[] = []

  for (let i = 0; i < dets.length; i++) {
    const det = dets[i]
    const nAttr = atributoTag(det.slice(0, Math.min(det.length, 120)), 'nItem')
    const nItem = nAttr ? Number(nAttr) : i + 1
    const prod = blocoTag(det, 'prod')
    const imposto = blocoTag(det, 'imposto')
    const { cst, origem } = extrairCstOrigem(imposto)

    const gtin =
      limparGtin(prod ? extrairCampoXml(prod, 'cEAN') : null) ??
      limparGtin(prod ? extrairCampoXml(prod, 'cEANTrib') : null)

    itens.push({
      nItem: Number.isFinite(nItem) ? nItem : i + 1,
      descricao: prod ? extrairCampoXml(prod, 'xProd') : null,
      gtin,
      codigoProduto: prod ? extrairCampoXml(prod, 'cProd') : null,
      ncm: prod ? extrairCampoXml(prod, 'NCM') : null,
      cfop: prod ? extrairCampoXml(prod, 'CFOP') : null,
      cst,
      origem,
      unidade: prod ? extrairCampoXml(prod, 'uCom') : null,
      quantidade: parseValor(prod ? extrairCampoXml(prod, 'qCom') : null),
      valorUnitario: parseValor(prod ? extrairCampoXml(prod, 'vUnCom') : null),
      valorTotal: parseValor(prod ? extrairCampoXml(prod, 'vProd') : null),
      pesoKg: parseValor(prod ? extrairCampoXml(prod, 'pesoL') ?? extrairCampoXml(prod, 'pesoB') : null),
    })
  }

  return itens
}

/**
 * True se o XML é NFe completa com itens (`det`), não só resumo DistDFe (`resNFe`).
 * Usado para `nfeCompleta` — sem isso o sync para de rebaixar e o Cadastro fica sem linhas.
 */
export function xmlNfeTemItensParseaveis(xmlBruto: string | null | undefined): boolean {
  if (!xmlBruto) return false
  const xml = normalizarXmlNfe(xmlBruto)
  if (!xml) return false
  if (/<(?:[\w.]+:)?resNFe\b/i.test(xml)) return false
  return todosBlocosTag(xml, 'det').length > 0
}

export type VisualizacaoNotaFiscal = {
  tipoDocumento: 'nfe55' | 'nfse' | 'cte' | 'desconhecido'
  chaveNfe: string | null
  numero: string | null
  serie: string | null
  naturezaOperacao: string | null
  dataEmissao: string | null
  emitente: {
    nome: string | null
    documento: string | null
    endereco: string | null
  }
  destinatario: {
    nome: string | null
    documento: string | null
  }
  valorTotal: number | null
  prazoPagamento: string | null
  descricaoServico: string | null
  itens: ItemXmlNfe[]
}

function montarEnderecoBloco(bloco: string | null): string | null {
  if (!bloco) return null
  const ender = blocoTag(bloco, 'enderEmit') ?? blocoTag(bloco, 'enderDest') ?? blocoTag(bloco, 'end')
  const fonte = ender ?? bloco
  const partes = [
    extrairCampoXml(fonte, 'xLgr'),
    extrairCampoXml(fonte, 'nro'),
    extrairCampoXml(fonte, 'xCpl'),
    extrairCampoXml(fonte, 'xBairro'),
    extrairCampoXml(fonte, 'xMun'),
    extrairCampoXml(fonte, 'UF'),
    extrairCampoXml(fonte, 'CEP'),
  ].filter(Boolean)
  return partes.length > 0 ? partes.join(', ') : null
}

/** Monta visão legível da nota a partir do XML (não é o XML bruto). */
export function montarVisualizacaoDoXml(xmlBruto: string): VisualizacaoNotaFiscal {
  const tipo = detectarDocumentoFiscalXml(xmlBruto)
  const xml = normalizarXmlNfe(xmlBruto)
  const resumo = extrairCamposResumoDoXml(xml)

  if (tipo === 'nfse') {
    const prest = blocoTag(xml, 'prest') ?? blocoTag(xml, 'emit')
    const toma = blocoTag(xml, 'toma') ?? blocoTag(xml, 'tomador') ?? blocoTag(xml, 'dest')
    const descricaoServico =
      extrairCampoXml(xml, 'xDescServ') ??
      extrairCampoXml(xml, 'discriminacao') ??
      extrairCampoXml(xml, 'xServ') ??
      extrairCampoXml(xml, 'infComplementar')

    return {
      tipoDocumento: 'nfse',
      chaveNfe: resumo.chaveNfe,
      numero: extrairCampoXml(xml, 'nNFSe') ?? extrairCampoXml(xml, 'nDPS') ?? extrairCampoXml(xml, 'numero'),
      serie: extrairCampoXml(xml, 'serie'),
      naturezaOperacao: null,
      dataEmissao: resumo.dataEmissao ? resumo.dataEmissao.toISOString() : null,
      emitente: {
        nome: resumo.nomeEmitente,
        documento: resumo.documentoEmitente,
        endereco: montarEnderecoBloco(prest),
      },
      destinatario: {
        nome: toma ? extrairCampoXml(toma, 'xNome') : null,
        documento: resumo.cnpjDestinatario,
      },
      valorTotal: resumo.valorTotal,
      prazoPagamento: null,
      descricaoServico,
      itens: [],
    }
  }

  if (tipo === 'cte') {
    const emit = blocoTag(xml, 'emit')
    const dest = blocoTag(xml, 'dest')
    const toma =
      blocoTag(xml, 'toma') ?? blocoTag(xml, 'toma4') ?? blocoTag(xml, 'toma3')
    const ide = blocoTag(xml, 'ide')
    const descricaoServico =
      extrairCampoXml(xml, 'xObs') ??
      extrairCampoXml(xml, 'xDime') ??
      (ide ? extrairCampoXml(ide, 'natOp') : null)

    return {
      tipoDocumento: 'cte',
      chaveNfe: resumo.chaveNfe,
      numero: ide ? extrairCampoXml(ide, 'nCT') : extrairCampoXml(xml, 'nCT'),
      serie: ide ? extrairCampoXml(ide, 'serie') : extrairCampoXml(xml, 'serie'),
      naturezaOperacao: ide ? extrairCampoXml(ide, 'natOp') : null,
      dataEmissao: resumo.dataEmissao ? resumo.dataEmissao.toISOString() : null,
      emitente: {
        nome: resumo.nomeEmitente,
        documento: resumo.documentoEmitente,
        endereco: montarEnderecoBloco(emit),
      },
      destinatario: {
        nome:
          (dest ? extrairCampoXml(dest, 'xNome') : null) ??
          (toma ? extrairCampoXml(toma, 'xNome') : null),
        documento: resumo.cnpjDestinatario,
      },
      valorTotal: resumo.valorTotal,
      prazoPagamento: null,
      descricaoServico,
      itens: [],
    }
  }

  const emit = blocoTag(xml, 'emit')
  const dest = blocoTag(xml, 'dest')
  const ide = blocoTag(xml, 'ide')

  return {
    tipoDocumento: tipo === 'nfe55' ? 'nfe55' : 'desconhecido',
    chaveNfe: resumo.chaveNfe,
    numero: ide ? extrairCampoXml(ide, 'nNF') : extrairCampoXml(xml, 'nNF'),
    serie: ide ? extrairCampoXml(ide, 'serie') : extrairCampoXml(xml, 'serie'),
    naturezaOperacao: ide ? extrairCampoXml(ide, 'natOp') : extrairCampoXml(xml, 'natOp'),
    dataEmissao: resumo.dataEmissao ? resumo.dataEmissao.toISOString() : null,
    emitente: {
      nome: resumo.nomeEmitente,
      documento: resumo.documentoEmitente,
      endereco: montarEnderecoBloco(emit),
    },
    destinatario: {
      nome: dest ? extrairCampoXml(dest, 'xNome') : null,
      documento: resumo.cnpjDestinatario,
    },
    valorTotal: resumo.valorTotal,
    prazoPagamento: resumo.prazoPagamentoXml,
    descricaoServico: null,
    itens: tipo === 'nfe55' ? extrairItensDoXml(xml) : [],
  }
}

export type DuplicataCobrancaXml = {
  numeroDocumento: string | null
  vencimento: Date | null
  valor: number | null
}

/** Extrai cobr/dup (nDup, dVenc, vDup) do XML da NFe 55. */
export function extrairDuplicatasCobrancaDoXml(xmlBruto: string): DuplicataCobrancaXml[] {
  const xml = normalizarXmlNfe(xmlBruto)
  if (!xml) return []

  const dups = todosBlocosTag(xml, 'dup')
  const out: DuplicataCobrancaXml[] = []
  for (const bloco of dups) {
    const nDup = extrairCampoXml(bloco, 'nDup')
    const dVenc = extrairCampoXml(bloco, 'dVenc')
    const vDup = extrairCampoXml(bloco, 'vDup')
    out.push({
      numeroDocumento: nDup?.trim() || null,
      vencimento: parseDataEmissao(dVenc),
      valor: parseValor(vDup),
    })
  }
  return out
}

function parseDatasPrazoTexto(texto: string | null | undefined): Date[] {
  if (!texto?.trim()) return []
  const datas: Date[] = []
  const iso = [...texto.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)]
  for (const m of iso) {
    const d = parseDataEmissao(m[1])
    if (d) datas.push(d)
  }
  if (datas.length > 0) return datas
  const br = [...texto.matchAll(/\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})\b/g)]
  for (const m of br) {
    const d = parseDataEmissao(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`)
    if (d) datas.push(d)
  }
  return datas
}

/**
 * Monta parcelas de ContaPagar a partir das duplicatas da NFe.
 * Fail-closed se não houver vencimento utilizável (§7.4).
 */
export function montarParcelasContaPagarDaNfe(input: {
  duplicatasXml: DuplicataCobrancaXml[]
  valorTotalNf: number
  prazoPagamentoXml?: string | null
  prazoPagamentoTexto?: string | null
}):
  | {
      ok: true
      parcelas: Array<{ numeroDocumento: string | null; vencimento: Date; valor: number }>
    }
  | { ok: false; mensagem: string } {
  const dupsComVenc = input.duplicatasXml.filter((d) => d.vencimento != null)
  if (dupsComVenc.length > 0) {
    const comValor = dupsComVenc.filter((d) => d.valor != null && d.valor > 0)
    if (comValor.length === dupsComVenc.length) {
      return {
        ok: true,
        parcelas: comValor.map((d) => ({
          numeroDocumento: d.numeroDocumento,
          vencimento: d.vencimento!,
          valor: d.valor!,
        })),
      }
    }
    if (!(input.valorTotalNf > 0)) {
      return {
        ok: false,
        mensagem:
          'NF sem valor total e duplicatas sem vDup — não é possível gerar Contas a Pagar.',
      }
    }
    const n = dupsComVenc.length
    const base = Math.floor((input.valorTotalNf / n) * 100) / 100
    const parcelas = dupsComVenc.map((d, idx) => {
      const valor =
        idx === n - 1
          ? Math.round((input.valorTotalNf - base * (n - 1)) * 100) / 100
          : base
      return {
        numeroDocumento: d.numeroDocumento,
        vencimento: d.vencimento!,
        valor,
      }
    })
    return { ok: true, parcelas }
  }

  const datas = [
    ...parseDatasPrazoTexto(input.prazoPagamentoXml),
    ...parseDatasPrazoTexto(input.prazoPagamentoTexto),
  ]
  const unicas: Date[] = []
  const seen = new Set<string>()
  for (const d of datas) {
    const key = d.toISOString().slice(0, 10)
    if (seen.has(key)) continue
    seen.add(key)
    unicas.push(d)
  }

  if (unicas.length === 0) {
    return {
      ok: false,
      mensagem:
        'NF sem duplicatas/vencimento (cobr/dup) — informe o prazo na Negociação ou corrija o XML antes de lançar.',
    }
  }
  if (!(input.valorTotalNf > 0)) {
    return {
      ok: false,
      mensagem: 'NF sem valor total — não é possível gerar Contas a Pagar.',
    }
  }

  const n = unicas.length
  const base = Math.floor((input.valorTotalNf / n) * 100) / 100
  return {
    ok: true,
    parcelas: unicas.map((vencimento, idx) => ({
      numeroDocumento: null,
      vencimento,
      valor:
        idx === n - 1
          ? Math.round((input.valorTotalNf - base * (n - 1)) * 100) / 100
          : base,
    })),
  }
}
