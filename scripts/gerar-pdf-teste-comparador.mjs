import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function escaparLiteralPdf(texto) {
  return texto.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function montarPdf(linhas) {
  const conteudo = [
    'BT',
    '/F1 12 Tf',
    '50 780 Td',
    '16 TL',
    ...linhas.flatMap((linha, i) => {
      const literal = `(${escaparLiteralPdf(linha)}) Tj`
      return i === 0 ? [literal] : ['T*', literal]
    }),
    'ET',
  ].join('\n')

  const objetos = []
  objetos.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  objetos.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')
  objetos.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n'
  )
  objetos.push(`4 0 obj\n<< /Length ${Buffer.byteLength(conteudo, 'latin1')} >>\nstream\n${conteudo}\nendstream\nendobj\n`)
  objetos.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const obj of objetos) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += obj
  }

  const xrefStart = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objetos.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i <= objetos.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

const pdfOk = montarPdf([
  'ORCAMENTO / PROPOSTA DO FORNECEDOR',
  'Fornecedor ABC Ltda',
  'CNPJ: 12.345.678/0001-90',
  '',
  'Item 1: Produto X',
  'SKU: SKU001',
  'Quantidade: 10,000',
  'Preco unitario: 20,00',
  'Subtotal: 200,00',
  '',
  'Frete: 0,00',
  'Total: 200,00',
  '',
  'Condicao: 30 dias',
  'Observacao: PDF de teste para comparador do ERP',
])

const pdfDivergente = montarPdf([
  'ORCAMENTO / PROPOSTA DO FORNECEDOR',
  'Fornecedor XYZ Comercio',
  'CNPJ: 98.765.432/0001-10',
  '',
  'Item 1: Produto Y',
  'SKU: SKU999',
  'Quantidade: 5,000',
  'Preco unitario: 15,50',
  'Subtotal: 77,50',
  '',
  'Frete: 10,00',
  'Total: 87,50',
  '',
  'Observacao: PDF propositalmente divergente para teste',
])

const pasta = join(__dirname, '..', 'tests', 'fixtures')
writeFileSync(join(pasta, 'pedido-compra-comparador-ok.pdf'), pdfOk)
writeFileSync(join(pasta, 'pedido-compra-comparador-divergente.pdf'), pdfDivergente)

console.log('PDFs gerados em', pasta)
console.log('- pedido-compra-comparador-ok.pdf')
console.log('- pedido-compra-comparador-divergente.pdf')
