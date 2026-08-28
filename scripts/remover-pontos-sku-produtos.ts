/**
 * Remove pontos do SKU de produtos já importados (ex.: 9.325 → 9325).
 *
 * Uso:
 *   npm run migrar:remover-pontos-sku
 *   npm run migrar:remover-pontos-sku -- --company-id <uuid>
 *   npm run migrar:remover-pontos-sku -- --aplicar
 *   npm run migrar:remover-pontos-sku -- --listar-empresas
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { normalizarSkuProduto } from '../src/modulos/produtos/normalizar-sku.js'

const prisma = new PrismaClient()

type Args = {
  companyId?: string
  aplicar: boolean
  listarEmpresas: boolean
  saida?: string
}

type LinhaRelatorio = {
  produtoId: string
  companyId: string
  skuAntigo: string
  skuNovo: string
  status: 'atualizar' | 'sem_mudanca' | 'colisao' | 'erro'
  mensagem: string
}

function lerArgs(argv: string[]): Args {
  const args: Args = { aplicar: false, listarEmpresas: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--aplicar') args.aplicar = true
    else if (a === '--listar-empresas') args.listarEmpresas = true
    else if (a === '--company-id') args.companyId = argv[++i]
    else if (a === '--saida') args.saida = argv[++i]
  }
  return args
}

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

async function listarEmpresas() {
  const empresas = await prisma.company.findMany({
    select: { id: true, nome: true, cnpj: true },
    orderBy: { nome: 'asc' },
  })
  for (const e of empresas) {
    console.log(`${e.id}\t${e.cnpj ?? ''}\t${e.nome}`)
  }
}

async function main() {
  const args = lerArgs(process.argv.slice(2))

  if (args.listarEmpresas) {
    await listarEmpresas()
    return
  }

  if (!args.companyId) {
    console.error('Informe --company-id <uuid> ou use --listar-empresas')
    process.exit(1)
  }

  const produtos = await prisma.produto.findMany({
    where: {
      companyId: args.companyId,
      sku: { contains: '.' },
    },
    select: { id: true, sku: true, nomeVenda: true, companyId: true },
    orderBy: { sku: 'asc' },
  })

  const linhas: LinhaRelatorio[] = []
  let atualizar = 0
  let colisao = 0
  let semMudanca = 0
  let erros = 0

  for (const produto of produtos) {
    const skuAntigo = produto.sku ?? ''
    const skuNovo = normalizarSkuProduto(skuAntigo)

    if (!skuNovo || skuNovo === skuAntigo) {
      semMudanca += 1
      linhas.push({
        produtoId: produto.id,
        companyId: produto.companyId,
        skuAntigo,
        skuNovo: skuNovo ?? '',
        status: 'sem_mudanca',
        mensagem: 'SKU sem alteração necessária',
      })
      continue
    }

    const conflito = await prisma.produto.findFirst({
      where: {
        companyId: produto.companyId,
        sku: skuNovo,
        id: { not: produto.id },
      },
      select: { id: true, sku: true, nomeVenda: true },
    })

    if (conflito) {
      colisao += 1
      linhas.push({
        produtoId: produto.id,
        companyId: produto.companyId,
        skuAntigo,
        skuNovo,
        status: 'colisao',
        mensagem: `Já existe produto ${conflito.id} com SKU ${conflito.sku} (${conflito.nomeVenda})`,
      })
      continue
    }

    if (!args.aplicar) {
      atualizar += 1
      linhas.push({
        produtoId: produto.id,
        companyId: produto.companyId,
        skuAntigo,
        skuNovo,
        status: 'atualizar',
        mensagem: 'Dry-run — use --aplicar para gravar',
      })
      continue
    }

    try {
      await prisma.produto.update({
        where: { id: produto.id },
        data: { sku: skuNovo },
      })
      atualizar += 1
      linhas.push({
        produtoId: produto.id,
        companyId: produto.companyId,
        skuAntigo,
        skuNovo,
        status: 'atualizar',
        mensagem: 'Atualizado',
      })
    } catch (e) {
      erros += 1
      const msg = e instanceof Error ? e.message : String(e)
      linhas.push({
        produtoId: produto.id,
        companyId: produto.companyId,
        skuAntigo,
        skuNovo,
        status: 'erro',
        mensagem: msg,
      })
    }
  }

  const dirSaida = args.saida ?? path.join('scripts', 'migracao-santri', 'saida')
  mkdirSync(dirSaida, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const relatorioPath = path.join(dirSaida, `remover-pontos-sku-${stamp}.csv`)
  const cabecalho =
    'produtoId,companyId,skuAntigo,skuNovo,status,mensagem,nomeVenda'
  const corpo = linhas.map((l) => {
    const produto = produtos.find((p) => p.id === l.produtoId)
    return [
      csvEscape(l.produtoId),
      csvEscape(l.companyId),
      csvEscape(l.skuAntigo),
      csvEscape(l.skuNovo),
      csvEscape(l.status),
      csvEscape(l.mensagem),
      csvEscape(produto?.nomeVenda ?? ''),
    ].join(',')
  })
  writeFileSync(relatorioPath, [cabecalho, ...corpo].join('\n'), 'utf8')

  console.log('---')
  console.log(`Produtos com ponto no SKU: ${produtos.length}`)
  console.log(`Atualizar: ${atualizar}`)
  console.log(`Colisões: ${colisao}`)
  console.log(`Sem mudança: ${semMudanca}`)
  console.log(`Erros: ${erros}`)
  console.log(`Modo: ${args.aplicar ? 'APLICAR' : 'DRY-RUN'}`)
  console.log(`Relatório: ${relatorioPath}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
