import './carregar-url-do-banco.js'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { clientePrisma as db } from '../src/compartilhado/banco-dados/cliente-prisma.js'
import { esquemaOrcamento } from '../src/modulos/orcamentos/esquema-orcamentos.js'
import { servicoDeOrcamentos as servico } from '../src/modulos/orcamentos/servico-orcamentos.js'
import { opcoesPagamentoOrcamento } from '../src/modulos/orcamentos/pagamento-orcamento.js'
import { gerarPdfOrcamento } from '../src/modulos/orcamentos/pdf-orcamento.js'
import { extractText } from 'unpdf'

if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error('Somente banco local.')
const ids = [randomUUID(), randomUUID()]
const dados = (parcial = {}) => esquemaOrcamento.parse({ data: '2026-10-16', clienteNome: 'Cliente de teste',
  condicaoPagamento: 'pix', telefone: '11999998888', itens: [{ codigo: 'TESTE', descricao: 'Produto de teste', quantidade: 1, precoUnitario: 100, percentualDesconto: 0 }], ...parcial })
try {
  for (const id of ids) await db.company.create({ data: { id, name: 'QA temporário orçamento', cnpj: 'QA-' + id } })
  const parametro = await db.configuracaoBoleto.create({ data: { companyId: ids[0], nome: 'QA boleto', permitirParcelamento: true,
    quantidadeMaximaParcelas: 3, valorMinimo: 10, valorMaximo: 1000, prazoMedioMaximoDias: 60, clientSecret: 'nao-expor' } })
  const opcoes = await opcoesPagamentoOrcamento(ids[0])
  assert.equal(JSON.stringify(opcoes).includes('nao-expor'), false)
  assert.equal(JSON.stringify(opcoes).includes('clientSecret'), false)
  assert.equal((await opcoesPagamentoOrcamento(ids[1])).boletos.length, 0)
  const boleto = dados({ condicaoPagamento: 'boleto', parametroBoletoId: parametro.id, prazosBoleto: [28, 56, 84] })
  await assert.rejects(servico.criar(ids[1], boleto), /ativo da empresa/)
  await assert.rejects(servico.criar(ids[0], dados({ condicaoPagamento: 'a_vista' })), /condição/)
  await assert.rejects(servico.criar(ids[0], dados({ condicaoPagamento: 'cartao_credito', parcelasCredito: 2 })), /parcelas/)
  const criado = await servico.criar(ids[0], boleto)
  assert.equal(criado.status, 'em_aberto')
  assert.deepEqual((await servico.obter(ids[0], criado.id)).prazosBoleto, [28, 56, 84])
  await assert.rejects(servico.obter(ids[1], criado.id), /não encontrado/)
  await db.configuracaoBoleto.update({ where: { id: parametro.id }, data: { ativo: false } })
  await assert.rejects(servico.finalizar(ids[0], criado.id), /ativo da empresa/)
  await db.configuracaoBoleto.update({ where: { id: parametro.id }, data: { ativo: true } })
  const fechamento = await Promise.allSettled([servico.finalizar(ids[0], criado.id), servico.finalizar(ids[0], criado.id)])
  assert.equal(fechamento.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(await db.pedidoVenda.count({ where: { orcamentoId: criado.id } }), 1)
  const pedido = await db.pedidoVenda.findUniqueOrThrow({ where: { orcamentoId: criado.id } })
  assert.deepEqual(pedido.prazosBoleto, [28, 56, 84])
  assert.equal(pedido.parametroBoletoNome, 'QA boleto')
  const parcelas = pedido.parcelasPagamento as Array<{ valor: number; vencimento: string }>
  assert.equal(parcelas.reduce((s, p) => s + Math.round(p.valor * 100), 0), 10000)
  assert.equal(parcelas.every((p) => !!p.vencimento), true)
  await assert.rejects(servico.atualizar(ids[0], criado.id, dados()), /não pode ser editado/)
  const pix = await servico.criar(ids[0], dados({ parametroBoletoId: parametro.id, prazosBoleto: [28], parcelasCredito: 3 }))
  assert.equal(pix.parametroBoletoId, null)
  assert.deepEqual(pix.prazosBoleto, [])
  assert.equal(pix.parcelasCredito, null)
  // Grande volume e textos longos para exercitar a paginação automática do PDF.
  const extenso = await servico.criar(ids[0], dados({ itens: Array.from({ length: 60 }, (_, i) => ({ codigo: 'SKU-' + i,
    descricao: `Produto ${i} com descrição longa, conexão, iluminação e acessórios `.repeat(4), quantidade: 1, precoUnitario: 100, percentualDesconto: 0 })) }))
  const pdf = await gerarPdfOrcamento(ids[0], extenso.id)
  await assert.rejects(gerarPdfOrcamento(ids[1], extenso.id), /não encontrado/)
  const extraido = await extractText(new Uint8Array(pdf), { mergePages: true })
  assert.ok(extraido.totalPages > 1)
  assert.ok(extraido.text.includes('Produto 59'))
  assert.ok(extraido.text.includes('6.000,00'))
  await mkdir('tmp/pdfs', { recursive: true })
  await writeFile('tmp/pdfs/orcamento-qa.pdf', pdf)
  console.log(`Integração local aprovada: isolamento, opções sem credenciais, validação, concorrência, persistência, vencimentos, bloqueio de edição e PDF com ${extraido.totalPages} páginas.`)
} finally {
  await db.pedidoVenda.deleteMany({ where: { companyId: { in: ids } } })
  await db.company.deleteMany({ where: { id: { in: ids } } })
  await db.$disconnect()
}
