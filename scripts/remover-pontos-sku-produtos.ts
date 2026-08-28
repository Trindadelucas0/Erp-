/**
 * Remove pontos do SKU de produtos já importados (ex.: 9.325 → 9325).
 *
 * Uso:
 *   npm run migrar:remover-pontos-sku
 *   npm run migrar:remover-pontos-sku -- --company-id <uuid>
 *   npm run migrar:remover-pontos-sku -- --todas-empresas --aplicar
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
  todasEmpresas: boolean
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
  const args: Args = { aplicar: false, listarEmpresas: false, todasEmpresas: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--aplicar') args.aplicar = true
    else if (a === '--listar-empresas') args.listarEmpresas = true
    else if (a === '--todas-empresas') args.todasEmpresas = true
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
    select: { id: true, name: true, cnpj: true, active: true },
    orderBy: { name: 'asc' },
  })
  console.log('Empresas:')
  for (const e of empresas) {
    console.log(`  ${e.id}  ${e.active ? 'ATIVA' : 'inativa'}  ${e.name}  CNPJ ${e.cnpj}`)
  }
}

async function processarEmpresa(companyId: string, aplicar: boolean, saida?: string) {
  const produtos = await prisma.produto.findMany({
    where: {
      companyId,
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

    if (!aplicar) {
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

  const dirSaida = saida ?? path.join('scripts', 'migracao-santri', 'saida')
  mkdirSync(dirSaida, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const relatorioPath = path.join(dirSaida, `remover-pontos-sku-${companyId.slice(0, 8)}-${stamp}.csv`)
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
  console.log(`Empresa: ${companyId}`)
  console.log(`Produtos com ponto no SKU: ${produtos.length}`)
  console.log(`Atualizar: ${atualizar}`)
  console.log(`Colisões: ${colisao}`)
  console.log(`Sem mudança: ${semMudanca}`)
  console.log(`Erros: ${erros}`)
  console.log(`Modo: ${aplicar ? 'APLICAR' : 'DRY-RUN'}`)
  console.log(`Relatório: ${relatorioPath}`)

  return { atualizar, colisao, erros, total: produtos.length }
}

async function main() {
  const args = lerArgs(process.argv.slice(2))

  if (args.listarEmpresas) {
    await listarEmpresas()
    return
  }

  if (!args.companyId && !args.todasEmpresas) {
    console.error('Informe --company-id <uuid>, --todas-empresas ou use --listar-empresas')
    process.exit(1)
  }

  const companyIds = args.todasEmpresas
    ? (
        await prisma.company.findMany({
          where: { active: true },
          select: { id: true },
          orderBy: { name: 'asc' },
        })
      ).map((e) => e.id)
    : [args.companyId!]

  let totalAtualizar = 0
  let totalColisao = 0
  let totalErros = 0
  let totalComPonto = 0

  for (const companyId of companyIds) {
    const res = await processarEmpresa(companyId, args.aplicar, args.saida)
    totalAtualizar += res.atualizar
    totalColisao += res.colisao
    totalErros += res.erros
    totalComPonto += res.total
  }

  if (companyIds.length > 1) {
    console.log('=== TOTAL ===')
    console.log(`Empresas processadas: ${companyIds.length}`)
    console.log(`Produtos com ponto no SKU: ${totalComPonto}`)
    console.log(`Atualizar: ${totalAtualizar}`)
    console.log(`Colisões: ${totalColisao}`)
    console.log(`Erros: ${totalErros}`)
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
