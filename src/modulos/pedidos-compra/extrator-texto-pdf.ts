/**
 * Extração de texto de PDF via pdf.js (unpdf) — decodifica streams comprimidos
 * (FlateDecode) e resolve códigos de glifo via CMap ToUnicode. Usado tanto pela
 * comparação heurística antiga (comparador-pdf-pedido.ts) quanto pela extração
 * via IA (conferencia-arquivo/servico-conferencia-arquivo.ts).
 */
export async function extrairTextoDoPdf(buffer: Buffer): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractText(pdf, { mergePages: true })
    return text
  } catch (erro) {
    console.error('[extrator-texto-pdf] Falha ao extrair texto do PDF:', erro)
    return ''
  }
}
