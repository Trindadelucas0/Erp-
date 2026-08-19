/**
 * Pedido de teste: NF Saint-Gobain → Aguardando chegada (Conexão Atacadista).
 * Uso: npx tsx --import ./scripts/carregar-url-do-banco.ts scripts/criar-pedido-saint-gobain-teste.ts
 */
import { clientePrisma } from '../src/compartilhado/banco-dados/cliente-prisma.js'
import { repositorioDePedidosCompra } from '../src/modulos/pedidos-compra/repositorio-pedidos-compra.js'

const CNPJ_CONEXAO = '34221243000171'

const LINHAS: Array<{ sku: string; quantidade: number; precoUnitario: number; codigoOriginal?: string }> = [
  { sku: '11.171', quantidade: 4, precoUnitario: 119.08, codigoOriginal: '0563.00042.0360GL' },
  { sku: '11.170', quantidade: 11, precoUnitario: 106.33, codigoOriginal: '0563.00042.0018BD' },
  { sku: '11.170', quantidade: 3, precoUnitario: 56.7, codigoOriginal: '0563.00042.0001FR' },
  { sku: '10.741', quantidade: 20, precoUnitario: 44.38, codigoOriginal: '0069.00000.0020PL' },
  { sku: '1.864', quantidade: 99, precoUnitario: 8.71, codigoOriginal: '0001.00001.0020PL' },
  { sku: '8.321', quantidade: 99, precoUnitario: 25.24, codigoOriginal: '0069.00001.0020PL' },
  { sku: '5.849', quantidade: 99, precoUnitario: 19.13, codigoOriginal: '0479.00001.0020PL' },
  { sku: '11.180', quantidade: 2, precoUnitario: 272.6, codigoOriginal: '30934.20.34.056' },
  { sku: '11.166', quantidade: 3, precoUnitario: 181.74, codigoOriginal: '33583.02.34.056' },
  { sku: '1.049', quantidade: 3, precoUnitario: 102.87, codigoOriginal: '0107.00020.0015FD' },
  { sku: '11.268', quantidade: 7, precoUnitario: 35.42, codigoOriginal: '0043.00001.0020PL' },
  { sku: '11.060', quantidade: 5, precoUnitario: 145.67, codigoOriginal: '0486.00001.0018CX' },
  { sku: '1.038', quantidade: 18, precoUnitario: 41.24, codigoOriginal: '33223.09.34.051' },
  { sku: '11.168', quantidade: 5, precoUnitario: 66.46, codigoOriginal: '33216.02.34.052' },
  { sku: '4.273', quantidade: 2, precoUnitario: 74.23, codigoOriginal: '0592.00149.0001CX' },
  { sku: '48.277', quantidade: 2, precoUnitario: 109.06, codigoOriginal: '0607.00042.0018BD' },
  { sku: '8.598', quantidade: 2, precoUnitario: 130.83, codigoOriginal: '0607.00042.0036GL' },
  { sku: '13.460', quantidade: 1, precoUnitario: 102.87, codigoOriginal: '0107.00048.0015FD' },
  { sku: '1.994', quantidade: 1, precoUnitario: 110.09, codigoOriginal: '0579.00000.0001PC' },
  { sku: '3.755', quantidade: 1, precoUnitario: 163.37, codigoOriginal: '31825.99.33.043' },
  { sku: '6.732', quantidade: 1, precoUnitario: 133.57, codigoOriginal: '0733.00020.0008CX' },
  { sku: '3.754', quantidade: 2, precoUnitario: 163.38, codigoOriginal: '31824.99.33.043' },
]

function variantesSku(sku: string): string[] {
  const semPonto = sku.replace(/\./g, '')
  return [...new Set([sku, semPonto])]
}

async function main() {
  const company = await clientePrisma.company.findFirst({
    where: {
      OR: [{ cnpj: CNPJ_CONEXAO }, { cnpj: '34.221.243/0001-71' }, { name: { contains: 'conex', mode: 'insensitive' } }],
    },
  })
  if (!company) {
    throw new Error('Empresa Conexão Atacadista não encontrada (CNPJ 34221243000171).')
  }

  const nfe = await clientePrisma.nfeRecebida.findFirst({
    where: {
      companyId: company.id,
      OR: [
        { nomeEmitente: { contains: 'gobain', mode: 'insensitive' } },
        { nomeEmitente: { contains: 'quartzolit', mode: 'insensitive' } },
        { nomeEmitente: { contains: 'saint', mode: 'insensitive' } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      nomeEmitente: true,
      documentoEmitente: true,
      fornecedorPessoaId: true,
      chaveNfe: true,
    },
  })

  let fornecedor = nfe?.fornecedorPessoaId
    ? await clientePrisma.pessoa.findFirst({
        where: { id: nfe.fornecedorPessoaId, companyId: company.id },
      })
    : null

  if (!fornecedor) {
    fornecedor = await clientePrisma.pessoa.findFirst({
      where: {
        companyId: company.id,
        papeis: { some: { papel: 'fornecedor', ativo: true } },
        OR: [
          { nome: { contains: 'gobain', mode: 'insensitive' } },
          { nome: { contains: 'quartzolit', mode: 'insensitive' } },
          { nomeFantasia: { contains: 'gobain', mode: 'insensitive' } },
          { nomeFantasia: { contains: 'quartzolit', mode: 'insensitive' } },
          ...(nfe?.documentoEmitente
            ? [{ cnpj: nfe.documentoEmitente.replace(/\D/g, '') }, { cnpj: nfe.documentoEmitente }]
            : []),
        ],
      },
    })
  }

  if (!fornecedor) {
    throw new Error('Fornecedor Saint-Gobain/Quartzolit não encontrado na Conexão.')
  }

  const skusUnicos = [...new Set(LINHAS.map((l) => l.sku))]
  const produtos = await clientePrisma.produto.findMany({
    where: {
      companyId: company.id,
      OR: skusUnicos.flatMap((sku) =>
        variantesSku(sku).map((s) => ({ sku: { equals: s, mode: 'insensitive' as const } }))
      ),
    },
    select: { id: true, sku: true, nomeVenda: true, unidade: true },
  })

  const porSku = new Map<string, (typeof produtos)[number]>()
  for (const p of produtos) {
    const sku = (p.sku ?? '').trim()
    porSku.set(sku, p)
    porSku.set(sku.replace(/\./g, ''), p)
  }

  const faltando: string[] = []
  const itens = LINHAS.map((linha, i) => {
    const prod = porSku.get(linha.sku) ?? porSku.get(linha.sku.replace(/\./g, ''))
    if (!prod) {
      faltando.push(linha.sku)
      return null
    }
    return {
      produtoId: prod.id,
      codigoOriginal: linha.codigoOriginal ?? null,
      quantidade: linha.quantidade,
      unidade: prod.unidade || 'UN',
      precoUnitario: linha.precoUnitario,
      ordem: i + 1,
    }
  })

  if (faltando.length > 0) {
    throw new Error(`SKU não encontrado na Conexão: ${[...new Set(faltando)].join(', ')}`)
  }

  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)
  const vencimento = new Date(hoje)
  vencimento.setDate(vencimento.getDate() + 28)

  const pedido = await repositorioDePedidosCompra.criar(
    {
      fornecedorPessoaId: fornecedor.id,
      modalidadeTransporte: 'CIF',
      tipoCompra: 'revenda',
      concluir: true,
      dataFaturamento: hoje,
      previsaoEntrega: hoje,
      descricao: 'NF Saint-Gobain — teste aguardando chegada',
      condicaoPagamento: '28 dias',
      prazosPagamento: [
        {
          numero: 1,
          vencimento: vencimento.toISOString().slice(0, 10),
          valor: null,
        },
      ],
      itens: itens.filter((x) => x != null),
    },
    company.id
  )

  console.log(
    JSON.stringify(
      {
        company: { id: company.id, name: company.name, cnpj: company.cnpj },
        fornecedor: { id: fornecedor.id, nome: fornecedor.nome, cnpj: fornecedor.cnpj },
        nfe: nfe
          ? { id: nfe.id, emitente: nfe.nomeEmitente, chave: nfe.chaveNfe }
          : null,
        pedido: { id: pedido.id, numero: pedido.numero, status: pedido.status, itens: pedido.itens.length },
      },
      null,
      2
    )
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await clientePrisma.$disconnect()
  })
