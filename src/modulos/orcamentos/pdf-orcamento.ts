import PDFDocument from 'pdfkit'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { repositorioDeOrcamentos, type OrcamentoPersistido } from './repositorio-orcamentos.js'

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const rotulos: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'Pix', boleto: 'Boleto',
  cartao_debito: 'Cartão de Débito', cartao_credito: 'Cartão de Crédito', a_vista: 'À vista' }

export function montarPdfOrcamento(orcamento: OrcamentoPersistido): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42, info: { Title: `Orçamento ${orcamento.numero}` } })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    const linha = (texto: string, negrito = false) => {
      doc.font(negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).text(texto, { width: 510 })
      doc.moveDown(0.4)
    }
    doc.font('Helvetica-Bold').fontSize(18).text('Orçamento de venda')
    doc.moveDown()
    linha(orcamento.nomeEmpresa, true)
    linha(`Número: ${orcamento.numero}   Data: ${orcamento.data.split('-').reverse().join('/')}   Validade: ${orcamento.validade ? orcamento.validade.split('-').reverse().join('/') : '—'}`)
    linha(`Cliente: ${orcamento.clienteNome}`, true)
    if (orcamento.cnpj) linha(`CPF/CNPJ: ${orcamento.cnpj}`)
    if (orcamento.telefone) linha(`Telefone: ${orcamento.telefone}`)
    const condicao = rotulos[orcamento.condicaoPagamento] ?? orcamento.condicaoPagamento
    linha(`Pagamento: ${condicao}${orcamento.parcelasCredito ? ` · ${orcamento.parcelasCredito}x` : ''}`)
    if (orcamento.prazosBoleto.length) linha(`Prazos: ${orcamento.prazosBoleto.join('/')} dias a partir do fechamento`)
    doc.moveDown()
    linha('Itens', true)
    for (const item of orcamento.itens) {
      if (doc.y > doc.page.height - 150) doc.addPage()
      linha(`${item.codigo} · ${item.descricao}`, true)
      const liquido4 = Math.round(Math.round(item.precoUnitario * 10000) * (100 - item.percentualDesconto) / 100)
      const total = Math.round(liquido4 * item.quantidade / 100) / 100 + item.valorSt
      linha(`${item.quantidade.toLocaleString('pt-BR')} ${item.unidade} × ${moeda(item.precoUnitario)} · Desconto: ${item.percentualDesconto}% · ST: ${moeda(item.valorSt)} · Total: ${moeda(total)}`)
    }
    doc.moveDown()
    linha(`Frete: ${moeda(orcamento.valorFrete)} · Outras despesas: ${moeda(orcamento.outrasDespesas)}`)
    linha(`Total: ${moeda(orcamento.total)}`, true)
    if (orcamento.endereco.logradouro) linha(`Entrega: ${orcamento.endereco.logradouro}, ${orcamento.endereco.numero} · ${orcamento.endereco.bairro} · ${orcamento.endereco.cidade}/${orcamento.endereco.uf} · ${orcamento.endereco.cep}`)
    if (orcamento.mensagem) linha(orcamento.mensagem)
    if (orcamento.complementares) linha(orcamento.complementares)
    if (orcamento.observacoes) linha(orcamento.observacoes)
    doc.end()
  })
}

export async function gerarPdfOrcamento(companyId: string, id: string) {
  const orcamento = await repositorioDeOrcamentos.buscarPorId(companyId, id)
  if (!orcamento) throw new ErroDaAplicacao('Orçamento não encontrado', 404)
  return montarPdfOrcamento(orcamento)
}
