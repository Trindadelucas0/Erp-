/**
 * Atualiza só o preço dos produtos já migrados (não recria catálogo).
 *
 * Fonte: coluna "Preço" do ODS Santri → campo ERP `precoCusto`
 * (único preço de produto no modelo; usado como sugestão no pedido de compra).
 *
 * Não existe `precoVenda` no ERP — o Preço Santri é gravado em `precoCusto`.
 *
 * Uso:
 *   npm run migrar:precos-santri -- --arquivo "C:\path\arquivo.zip" --company-id UUID
 *   npm run migrar:precos-santri -- --arquivo "..." --company-id UUID --aplicar
 *   npm run migrar:precos-santri -- --arquivo "..." --company-id UUID --somente-vazios --aplicar
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { parsearOdsProdutosSantri } from './migracao-santri/parser-ods-produtos.js'
import { parsearDecimalSantri } from './migracao-santri/normalizar-produto-santri.js'

const prisma = new PrismaClient()

type Args = {
  arquivo?: string
  companyId?: string
  aplicar: boolean
  somenteVazios: boolean
  limite?: number
  saida?: string
}

function lerArgs(argv: string[]): Args {
  const args: Args = { aplicar: false, somenteVazios: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--aplicar') args.aplicar = true
    else if (a === '--somente-vazios') args.somenteVazios = true
    else if (a === '--arquivo') args.arquivo = argv[++i]
    else if (a === '--company-id') args.companyId = argv[++i]
    else if (a === '--limite') args.limite = Number(argv[++i])
    else if (a === '--saida') args.saida = argv[++i]
  }
  return args
}

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

async function main() {
  const args = lerArgs(process.argv.slice(2))
  if (!args.arquivo || !args.companyId) {
    console.error(
      'Uso: --arquivo caminho.ods.zip --company-id UUID [--aplicar] [--somente-vazios] [--limite N]'
    )
    process.exit(1)
  }

  const empresa = await prisma.company.findUnique({
    where: { id: args.companyId },
    select: { id: true, name: true },
  })
  if (!empresa) {
    console.error('Empresa não encontrada:', args.companyId)
    process.exit(1)
  }

  console.log(`Empresa: ${empresa.name} (${empresa.id})`)
  console.log(`Modo: ${args.aplicar ? 'APLICAR' : 'DRY-RUN'}`)
  console.log(
    args.somenteVazios
      ? 'Só atualiza produtos sem precoCusto'
      : 'Atualiza todos com preço Santri > 0 (sobrescreve precoCusto existente)'
  )

  let brutos = parsearOdsProdutosSantri(args.arquivo)
  if (args.limite && args.limite > 0) brutos = brutos.slice(0, args.limite)

  const porSku = new Map<string, number>()
  let semPreco = 0
  let precoZero = 0
  for (const b of brutos) {
    const preco = parsearDecimalSantri(b.preco)
    if (preco == null) {
      semPreco += 1
      continue
    }
    if (!(preco > 0)) {
      precoZero += 1
      continue
    }
    porSku.set(b.codigo.trim(), preco)
  }

  console.log(`Linhas ODS com preço > 0: ${porSku.size}`)
  console.log(`Sem preço / zero: ${semPreco} / ${precoZero}`)

  const produtos = await prisma.produto.findMany({
    where: {
      companyId: args.companyId,
      sku: { in: [...porSku.keys()] },
    },
    select: { id: true, sku: true, nomeVenda: true, precoCusto: true },
  })

  const dirSaida =
    args.saida ||
    path.join(process.cwd(), 'scripts', 'migracao-santri', 'saida')
  mkdirSync(dirSaida, { recursive: true })

  const rel: string[] = [
    'sku,status,nomeVenda,precoAnterior,precoNovo,erro',
  ]

  let atualizados = 0
  let skip = 0
  let naoEncontrado = 0
  let erro = 0

  const skusNoBanco = new Set(produtos.map((p) => p.sku).filter(Boolean) as string[])
  for (const sku of porSku.keys()) {
    if (!skusNoBanco.has(sku)) {
      naoEncontrado += 1
      rel.push(
        [
          csvEscape(sku),
          'skip_produto_nao_encontrado',
          '',
          '',
          String(porSku.get(sku)),
          '',
        ].join(',')
      )
    }
  }

  for (const produto of produtos) {
    const sku = produto.sku!
    const novo = porSku.get(sku)
    if (novo == null) {
      skip += 1
      continue
    }

    const anterior = produto.precoCusto != null ? Number(produto.precoCusto) : null

    if (args.somenteVazios && anterior != null && anterior > 0) {
      skip += 1
      rel.push(
        [
          csvEscape(sku),
          'skip_ja_tem_preco',
          csvEscape(produto.nomeVenda),
          anterior,
          novo,
          '',
        ].join(',')
      )
      continue
    }

    if (anterior != null && Math.abs(anterior - novo) < 1e-9) {
      skip += 1
      rel.push(
        [
          csvEscape(sku),
          'skip_mesmo_valor',
          csvEscape(produto.nomeVenda),
          anterior,
          novo,
          '',
        ].join(',')
      )
      continue
    }

    if (!args.aplicar) {
      atualizados += 1
      rel.push(
        [
          csvEscape(sku),
          'ok_dry_run',
          csvEscape(produto.nomeVenda),
          anterior ?? '',
          novo,
          '',
        ].join(',')
      )
      continue
    }

    try {
      await prisma.produto.update({
        where: { id: produto.id },
        data: { precoCusto: novo },
      })
      atualizados += 1
      rel.push(
        [
          csvEscape(sku),
          'atualizado',
          csvEscape(produto.nomeVenda),
          anterior ?? '',
          novo,
          '',
        ].join(',')
      )
    } catch (e) {
      erro += 1
      const msg = e instanceof Error ? e.message : String(e)
      rel.push(
        [
          csvEscape(sku),
          'erro',
          csvEscape(produto.nomeVenda),
          anterior ?? '',
          novo,
          csvEscape(msg),
        ].join(',')
      )
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const relPath = path.join(dirSaida, `relatorio-precos-${stamp}.csv`)
  writeFileSync(relPath, rel.join('\n'), 'utf8')

  console.log('---')
  console.log(`A atualizar / atualizados: ${atualizados}`)
  console.log(`Skip: ${skip}`)
  console.log(`SKU no ODS sem produto no banco: ${naoEncontrado}`)
  console.log(`Erros: ${erro}`)
  console.log(`Relatório: ${relPath}`)
  if (!args.aplicar) {
    console.log('Dry-run concluído. Rode com --aplicar para gravar precoCusto.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
