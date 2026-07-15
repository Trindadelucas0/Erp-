import { describe, expect, it } from 'vitest'
import PDFDocument from 'pdfkit'
import { extrairTextoDoPdf } from './extrator-texto-pdf.js'

function gerarPdfComTexto(texto: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument()
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.text(texto)
    doc.end()
  })
}

describe('extrairTextoDoPdf', () => {
  it('extrai o texto de um PDF válido (streams comprimidos pelo pdfkit)', async () => {
    const buffer = await gerarPdfComTexto('Pedido de teste 123,45 unidades')

    const texto = await extrairTextoDoPdf(buffer)

    expect(texto).toContain('Pedido de teste 123,45 unidades')
  })

  it('retorna string vazia para buffer que não é um PDF válido, sem lançar exceção', async () => {
    const buffer = Buffer.from('isso não é um PDF')

    const texto = await extrairTextoDoPdf(buffer)

    expect(texto).toBe('')
  })
})
