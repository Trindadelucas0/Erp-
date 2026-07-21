/**
 * Extrai chave, resumo e itens de XML fiscal: NFe modelo 55 ou NFS-e nacional.
 * Itens de produto (`extrairItensDoXml`) só se aplicam à NFe 55.
 */
export function normalizarXmlNfe(xml: string): string {
  return xml.replace(/^\uFEFF/, '').trim()
}

/** Classifica o XML fiscal (NFe 55 produto | NFS-e nacional serviço). */
export function detectarDocumentoFiscalXml(
  xmlBruto: string
): 'nfe55' | 'nfse' | 'desconhecido' {
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
  const re = new RegExp(
    `<(?:[\\w.]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[\\w.]+:)?${tag}>`,
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
  tipoDocumento?: 'nfe55' | 'nfse'
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
  quantidade: number | null
  valorUnitario: number | null
  valorTotal: number | null
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

/**
 * Preferência: dados do bloco &lt;emit&gt; / &lt;dest&gt; / ide / total
 * (evita pegar xNome/CNPJ do destinatário como emitente).
 */
export function extrairCamposResumoDoXml(xmlBruto: string): CamposResumoXmlNfe {
  if (detectarDocumentoFiscalXml(xmlBruto) === 'nfse') {
    return extrairCamposResumoDoXmlNfse(xmlBruto)
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

  return {
    chaveNfe,
    nomeEmitente,
    documentoEmitente,
    cnpjDestinatario,
    dataEmissao: parseDataEmissao(dhEmi),
    valorTotal,
    prazoPagamentoXml,
    tipoDocumento: 'nfe55',
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
      quantidade: parseValor(prod ? extrairCampoXml(prod, 'qCom') : null),
      valorUnitario: parseValor(prod ? extrairCampoXml(prod, 'vUnCom') : null),
      valorTotal: parseValor(prod ? extrairCampoXml(prod, 'vProd') : null),
    })
  }

  return itens
}

export type VisualizacaoNotaFiscal = {
  tipoDocumento: 'nfe55' | 'nfse' | 'desconhecido'
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
