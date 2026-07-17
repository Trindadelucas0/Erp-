/**
 * Migração Fase 2 — vínculos Produto × Fornecedor a partir do CSV de-para.
 *
 * Preencha `fornecedorPessoaId` (e opcionalmente `overrideMultiplicador`) no CSV
 * gerado pela Fase 1 (`depara-fase2-*.csv`).
 *
 * Regras ERP (doc §6.8 / esquema-produtos):
 * - unidade entrada = unidade venda → multiplicador e múltiplo = 1
 * - unidades diferentes → multiplicador deve ser ≠ 1 (use override se Santri veio 1/vazio)
 *
 * Uso:
 *   npx tsx --import ./scripts/carregar-url-do-banco.ts scripts/migrar-vinculos-fornecedor-santri.ts --company-id <uuid> --depara caminho.csv
 *   ... --aplicar
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { resolverMultiplicadoresVinculo } from './migracao-santri/normalizar-produto-santri.js'

const prisma = new PrismaClient()

type Args = {
  companyId?: string
  depara?: string
  aplicar: boolean
  saida?: string
}

type LinhaDepara = {
  sku: string
  codigoOriginal: string
  undVenda: string
  undCompra: string
  multiploCompraUnitario?: number
  multiploCompraSecundario?: number
  fabricante: string
  fornecedorPessoaId: string
  overrideMultiplicador?: number
}

function lerArgs(argv: string[]): Args {
  const args: Args = { aplicar: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--aplicar') args.aplicar = true
    else if (a === '--company-id') args.companyId = argv[++i]
    else if (a === '--depara') args.depara = argv[++i]
    else if (a === '--saida') args.saida = argv[++i]
  }
  return args
}

function parseCsv(conteudo: string): string[][] {
  const linhas: string[][] = []
  let atual: string[] = []
  let campo = ''
  let emAspas = false
  for (let i = 0; i < conteudo.length; i++) {
    const ch = conteudo[i]
    if (emAspas) {
      if (ch === '"' && conteudo[i + 1] === '"') {
        campo += '"'
        i++
      } else if (ch === '"') {
        emAspas = false
      } else {
        campo += ch
      }
      continue
    }
    if (ch === '"') {
      emAspas = true
      continue
    }
    if (ch === ',') {
      atual.push(campo)
      campo = ''
      continue
    }
    if (ch === '\n') {
      atual.push(campo)
      linhas.push(atual)
      atual = []
      campo = ''
      continue
    }
    if (ch === '\r') continue
    campo += ch
  }
  if (campo.length || atual.length) {
    atual.push(campo)
    linhas.push(atual)
  }
  return linhas.filter((l) => l.some((c) => c.trim()))
}

function num(v: string): number | undefined {
  const t = v.trim()
  if (!t) return undefined
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

async function main() {
  const args = lerArgs(process.argv.slice(2))
  if (!args.companyId || !args.depara) {
    console.error(
      'Uso: --company-id <uuid> --depara caminho.csv [--aplicar]'
    )
    process.exit(1)
  }

  const empresa = await prisma.company.findUnique({
    where: { id: args.companyId },
    select: { id: true, name: true },
  })
  if (!empresa) {
    console.error('Empresa não encontrada')
    process.exit(1)
  }

  const bruto = readFileSync(args.depara, 'utf8')
  const rows = parseCsv(bruto)
  if (rows.length < 2) {
    console.error('CSV vazio')
    process.exit(1)
  }

  const header = rows[0].map((h) => h.trim())
  const idx = (nome: string) => header.indexOf(nome)

  const iSku = idx('sku')
  const iCod = idx('codigoOriginal')
  const iUv = idx('undVenda')
  const iUc = idx('undCompra')
  const iMu = idx('multiploCompraUnitario')
  const iMs = idx('multiploCompraSecundario')
  const iFab = idx('fabricante')
  const iForn = idx('fornecedorPessoaId')
  const iOv = idx('overrideMultiplicador')

  if (iSku < 0 || iForn < 0) {
    console.error('CSV precisa das colunas sku e fornecedorPessoaId')
    process.exit(1)
  }

  const linhas: LinhaDepara[] = []
  for (const r of rows.slice(1)) {
    const fornecedorPessoaId = (r[iForn] ?? '').trim()
    if (!fornecedorPessoaId) continue
    linhas.push({
      sku: (r[iSku] ?? '').trim(),
      codigoOriginal: (r[iCod] ?? '').trim(),
      undVenda: (r[iUv] ?? '').trim(),
      undCompra: (r[iUc] ?? '').trim(),
      multiploCompraUnitario: num(r[iMu] ?? ''),
      multiploCompraSecundario: num(r[iMs] ?? ''),
      fabricante: (r[iFab] ?? '').trim(),
      fornecedorPessoaId,
      overrideMultiplicador: num(r[iOv] ?? ''),
    })
  }

  console.log(`Empresa: ${empresa.name}`)
  console.log(`Linhas com fornecedor preenchido: ${linhas.length}`)
  console.log(`Modo: ${args.aplicar ? 'APLICAR' : 'DRY-RUN'}`)

  const dirSaida =
    args.saida ||
    path.join(process.cwd(), 'scripts', 'migracao-santri', 'saida')
  mkdirSync(dirSaida, { recursive: true })
  const rel: string[] = [
    'sku,status,fornecedorPessoaId,unidadeEntrada,multiplicadorEntrada,multiploEntrada,avisos,erro',
  ]

  let ok = 0
  let skip = 0
  let erro = 0

  for (const linha of linhas) {
    const produto = await prisma.produto.findFirst({
      where: { companyId: args.companyId, sku: linha.sku },
      select: {
        id: true,
        unidade: true,
        fornecedores: {
          where: { fornecedorPessoaId: linha.fornecedorPessoaId },
          select: { id: true },
        },
      },
    })

    if (!produto) {
      erro += 1
      rel.push(
        [
          csvEscape(linha.sku),
          'erro_produto',
          linha.fornecedorPessoaId,
          '',
          '',
          '',
          '',
          'Produto não encontrado na empresa',
        ].join(',')
      )
      continue
    }

    if (produto.fornecedores.length) {
      skip += 1
      rel.push(
        [
          csvEscape(linha.sku),
          'skip_vinculo_existente',
          linha.fornecedorPessoaId,
          '',
          '',
          '',
          '',
          '',
        ].join(',')
      )
      continue
    }

    const fornecedor = await prisma.pessoa.findFirst({
      where: {
        id: linha.fornecedorPessoaId,
        companyId: args.companyId,
        papeis: { some: { papel: 'fornecedor', ativo: true } },
      },
      select: { id: true },
    })
    if (!fornecedor) {
      erro += 1
      rel.push(
        [
          csvEscape(linha.sku),
          'erro_fornecedor',
          linha.fornecedorPessoaId,
          '',
          '',
          '',
          '',
          'Fornecedor inválido ou inativo na empresa',
        ].join(',')
      )
      continue
    }

    const undVenda = linha.undVenda || produto.unidade
    const resolvido = resolverMultiplicadoresVinculo({
      unidadeVenda: undVenda,
      unidadeEntrada: linha.undCompra || undVenda,
      multiploCompraUnitario: linha.multiploCompraUnitario,
      multiploCompraSecundario: linha.multiploCompraSecundario,
      overrideMultiplicador: linha.overrideMultiplicador,
    })

    if (!resolvido.ok) {
      erro += 1
      rel.push(
        [
          csvEscape(linha.sku),
          'erro_multiplicador',
          linha.fornecedorPessoaId,
          resolvido.unidadeEntrada,
          '',
          '',
          csvEscape(resolvido.avisos.map((a) => a.mensagem).join(' | ')),
          csvEscape(resolvido.motivoErro ?? 'multiplicador inválido'),
        ].join(',')
      )
      continue
    }

    // Garante unidade de entrada cadastrada
    if (args.aplicar) {
      const und = await prisma.unidadeMedida.findFirst({
        where: { companyId: args.companyId, sigla: resolvido.unidadeEntrada },
      })
      if (!und) {
        await prisma.unidadeMedida.create({
          data: {
            companyId: args.companyId,
            sigla: resolvido.unidadeEntrada,
            nome: resolvido.unidadeEntrada,
          },
        })
      }
    }

    const avisosTxt = resolvido.avisos.map((a) => a.mensagem).join(' | ')

    if (!args.aplicar) {
      ok += 1
      rel.push(
        [
          csvEscape(linha.sku),
          'ok_dry_run',
          linha.fornecedorPessoaId,
          resolvido.unidadeEntrada,
          String(resolvido.multiplicadorEntrada),
          String(resolvido.multiploEntrada),
          csvEscape(avisosTxt),
          '',
        ].join(',')
      )
      continue
    }

    try {
      await prisma.produtoFornecedor.create({
        data: {
          produtoId: produto.id,
          fornecedorPessoaId: linha.fornecedorPessoaId,
          codigoFornecedor: linha.codigoOriginal || null,
          unidadeEntrada: resolvido.unidadeEntrada,
          multiplicadorEntrada: resolvido.multiplicadorEntrada,
          multiploEntrada: resolvido.multiploEntrada,
          ordem: 0,
        },
      })
      ok += 1
      rel.push(
        [
          csvEscape(linha.sku),
          'criado',
          linha.fornecedorPessoaId,
          resolvido.unidadeEntrada,
          String(resolvido.multiplicadorEntrada),
          String(resolvido.multiploEntrada),
          csvEscape(avisosTxt),
          '',
        ].join(',')
      )
    } catch (e) {
      erro += 1
      const msg = e instanceof Error ? e.message : String(e)
      rel.push(
        [
          csvEscape(linha.sku),
          'erro_insert',
          linha.fornecedorPessoaId,
          '',
          '',
          '',
          '',
          csvEscape(msg),
        ].join(',')
      )
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const relPath = path.join(dirSaida, `relatorio-fase2-${stamp}.csv`)
  writeFileSync(relPath, rel.join('\n'), 'utf8')
  console.log(`OK: ${ok} | Skip: ${skip} | Erros: ${erro}`)
  console.log(`Relatório: ${relPath}`)
  if (!args.aplicar) {
    console.log('Dry-run concluído. Rode com --aplicar para gravar vínculos.')
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
