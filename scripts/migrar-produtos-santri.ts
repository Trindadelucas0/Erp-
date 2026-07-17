/**
 * Migração Fase 1 — catálogo Santri → Produtos do ERP.
 *
 * Escopo fixo (plano):
 * - Mantém SKU Santri
 * - Não grava Preço em precoCusto
 * - Não cria vínculo fornecedor (Fase 2)
 * - Não migra estoque
 *
 * Uso:
 *   npx tsx --import ./scripts/carregar-url-do-banco.ts scripts/migrar-produtos-santri.ts --arquivo "C:\path\arquivo.ods" --company-id <uuid>
 *   (dry-run por padrão)
 *   ... --aplicar
 *   ... --limite 50
 *   ... --listar-empresas
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { esquemaDeCriacaoDeProduto } from '../src/modulos/produtos/esquema-produtos.js'
import { normalizarTextoCadastro } from '../src/compartilhado/normalizacao/texto-cadastro.js'
import { parsearOdsProdutosSantri } from './migracao-santri/parser-ods-produtos.js'
import {
  nomeUnidadePorSigla,
  normalizarProdutoSantri,
  type ProdutoSantriNormalizado,
} from './migracao-santri/normalizar-produto-santri.js'

const prisma = new PrismaClient()

type Args = {
  arquivo?: string
  companyId?: string
  aplicar: boolean
  limite?: number
  listarEmpresas: boolean
  saida?: string
}

function lerArgs(argv: string[]): Args {
  const args: Args = { aplicar: false, listarEmpresas: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--aplicar') args.aplicar = true
    else if (a === '--listar-empresas') args.listarEmpresas = true
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

async function garantirMarca(nome: string, companyId: string, cache: Set<string>) {
  const normalizado = normalizarTextoCadastro(nome)!
  if (cache.has(normalizado)) return normalizado
  const existente = await prisma.marca.findFirst({
    where: { companyId, nome: normalizado },
    select: { nome: true },
  })
  if (existente) {
    cache.add(existente.nome)
    return existente.nome
  }
  const criada = await prisma.marca.create({
    data: { companyId, nome: normalizado },
    select: { nome: true },
  })
  cache.add(criada.nome)
  return criada.nome
}

async function garantirUnidade(sigla: string, companyId: string, cache: Set<string>) {
  const s = sigla.toUpperCase()
  if (cache.has(s)) return s
  const existente = await prisma.unidadeMedida.findFirst({
    where: { companyId, sigla: s },
    select: { sigla: true },
  })
  if (existente) {
    cache.add(existente.sigla)
    return existente.sigla
  }
  await prisma.unidadeMedida.create({
    data: {
      companyId,
      sigla: s,
      nome: nomeUnidadePorSigla(s),
    },
  })
  cache.add(s)
  return s
}

function payloadCriacao(p: ProdutoSantriNormalizado) {
  return {
    sku: p.sku,
    ativo: p.ativo,
    nomeVenda: p.nomeVenda,
    marca: p.marca,
    unidade: p.unidade,
    nomeCompra: p.nomeCompra,
    bloqueadoCompra: p.bloqueadoCompra,
    controlaEstoque: p.controlaEstoque,
    permiteEstoqueNegativo: p.permiteEstoqueNegativo,
    entregaNoAto: p.entregaNoAto,
    entregaARetirar: p.entregaARetirar,
    entregar: p.entregar,
    flagComissao: p.flagComissao,
    flagDevolucao: p.flagDevolucao,
    ncm: p.ncm,
    codigoOrigem: p.codigoOrigem,
    codigoBarras: p.codigoBarras,
    pesoKg: p.pesoKg,
    alturaCm: p.alturaCm,
    larguraCm: p.larguraCm,
    comprimentoCm: p.comprimentoCm,
    capacidadeEmpilhamento: p.capacidadeEmpilhamento,
    multiploVenda: p.multiploVenda,
    permiteVendaFracionada: p.permiteVendaFracionada,
    embalagensMaster: p.embalagensMaster,
    fornecedores: [],
    similaresIds: [],
    enderecosEstoque: [],
  }
}

async function main() {
  const args = lerArgs(process.argv.slice(2))

  if (args.listarEmpresas) {
    const empresas = await prisma.company.findMany({
      select: { id: true, name: true, cnpj: true, active: true },
      orderBy: { name: 'asc' },
    })
    console.log('Empresas:')
    for (const e of empresas) {
      console.log(`  ${e.id}  ${e.active ? 'ATIVA' : 'inativa'}  ${e.name}  CNPJ ${e.cnpj}`)
    }
    return
  }

  if (!args.arquivo) {
    console.error('Informe --arquivo caminho.ods (ou .zip do ODS Santri)')
    process.exit(1)
  }
  if (!args.companyId) {
    console.error('Informe --company-id <uuid> (use --listar-empresas)')
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
  console.log('Lendo ODS...')

  let brutos = parsearOdsProdutosSantri(args.arquivo)
  if (args.limite && args.limite > 0) {
    brutos = brutos.slice(0, args.limite)
  }
  console.log(`Produtos no arquivo (após filtro): ${brutos.length}`)

  const dirSaida =
    args.saida ||
    path.join(process.cwd(), 'scripts', 'migracao-santri', 'saida')
  mkdirSync(dirSaida, { recursive: true })

  const linhasRelatorio: string[] = [
    [
      'sku',
      'status',
      'nomeVenda',
      'marca',
      'unidade',
      'ncm',
      'codigoBarras',
      'avisos',
      'erro',
      'codigoOriginal',
      'undCompra',
      'multiploCompraUnitario',
      'fabricante',
    ].join(','),
  ]

  const marcasCache = new Set<string>()
  const unidadesCache = new Set<string>()
  const existentes = await prisma.produto.findMany({
    where: { companyId: args.companyId },
    select: { sku: true },
  })
  const skusExistentes = new Set(
    existentes.map((p) => p.sku).filter((s): s is string => Boolean(s))
  )

  let ok = 0
  let skip = 0
  let erro = 0
  let avisosTotal = 0

  // Pré-coleta marcas/unidades do lote
  const marcasLote = new Set<string>()
  const unidadesLote = new Set<string>()
  const normalizados: ProdutoSantriNormalizado[] = []

  for (const bruto of brutos) {
    const r = normalizarProdutoSantri(bruto)
    if ('erro' in r) {
      erro += 1
      linhasRelatorio.push(
        [
          csvEscape(bruto.codigo),
          'erro_normalizacao',
          csvEscape(bruto.nome),
          '',
          '',
          '',
          '',
          '',
          csvEscape(r.erro),
          '',
          '',
          '',
          '',
        ].join(',')
      )
      continue
    }
    normalizados.push(r)
    marcasLote.add(r.marca)
    unidadesLote.add(r.unidade)
  }

  if (args.aplicar) {
    for (const m of marcasLote) {
      await garantirMarca(m, args.companyId, marcasCache)
    }
    for (const u of unidadesLote) {
      await garantirUnidade(u, args.companyId, unidadesCache)
    }
  } else {
    console.log(`Marcas distintas: ${marcasLote.size}`)
    console.log(`Unidades distintas: ${unidadesLote.size}`)
  }

  const fase2Linhas: string[] = [
    [
      'sku',
      'codigoOriginal',
      'undVenda',
      'undCompra',
      'multiploCompraUnitario',
      'multiploCompraSecundario',
      'fabricante',
      'fornecedorPessoaId',
      'overrideMultiplicador',
    ].join(','),
  ]

  for (const p of normalizados) {
    avisosTotal += p.avisos.length
    const avisosTxt = p.avisos.map((a) => a.mensagem).join(' | ')

    fase2Linhas.push(
      [
        csvEscape(p.sku),
        csvEscape(p.fase2.codigoOriginal ?? ''),
        csvEscape(p.unidade),
        csvEscape(p.fase2.undCompra ?? ''),
        p.fase2.multiploCompraUnitario ?? '',
        p.fase2.multiploCompraSecundario ?? '',
        csvEscape(p.fase2.fabricante ?? ''),
        '',
        '',
      ].join(',')
    )

    if (skusExistentes.has(p.sku)) {
      skip += 1
      linhasRelatorio.push(
        [
          csvEscape(p.sku),
          'skip_sku_existente',
          csvEscape(p.nomeVenda),
          csvEscape(p.marca),
          csvEscape(p.unidade),
          csvEscape(p.ncm ?? ''),
          csvEscape(p.codigoBarras ?? ''),
          csvEscape(avisosTxt),
          '',
          csvEscape(p.fase2.codigoOriginal ?? ''),
          csvEscape(p.fase2.undCompra ?? ''),
          p.fase2.multiploCompraUnitario ?? '',
          csvEscape(p.fase2.fabricante ?? ''),
        ].join(',')
      )
      continue
    }

    const body = payloadCriacao(p)
    const validacao = esquemaDeCriacaoDeProduto.safeParse(body)
    if (!validacao.success) {
      erro += 1
      const msg = validacao.error.issues.map((i) => i.message).join('; ')
      linhasRelatorio.push(
        [
          csvEscape(p.sku),
          'erro_validacao',
          csvEscape(p.nomeVenda),
          csvEscape(p.marca),
          csvEscape(p.unidade),
          csvEscape(p.ncm ?? ''),
          csvEscape(p.codigoBarras ?? ''),
          csvEscape(avisosTxt),
          csvEscape(msg),
          csvEscape(p.fase2.codigoOriginal ?? ''),
          csvEscape(p.fase2.undCompra ?? ''),
          p.fase2.multiploCompraUnitario ?? '',
          csvEscape(p.fase2.fabricante ?? ''),
        ].join(',')
      )
      continue
    }

    if (!args.aplicar) {
      ok += 1
      linhasRelatorio.push(
        [
          csvEscape(p.sku),
          'ok_dry_run',
          csvEscape(p.nomeVenda),
          csvEscape(p.marca),
          csvEscape(p.unidade),
          csvEscape(p.ncm ?? ''),
          csvEscape(p.codigoBarras ?? ''),
          csvEscape(avisosTxt),
          '',
          csvEscape(p.fase2.codigoOriginal ?? ''),
          csvEscape(p.fase2.undCompra ?? ''),
          p.fase2.multiploCompraUnitario ?? '',
          csvEscape(p.fase2.fabricante ?? ''),
        ].join(',')
      )
      continue
    }

    try {
      await garantirMarca(p.marca, args.companyId, marcasCache)
      await garantirUnidade(p.unidade, args.companyId, unidadesCache)

      // Conflito de EAN na empresa
      if (p.codigoBarras) {
        const conflito = await prisma.produto.findFirst({
          where: {
            companyId: args.companyId,
            OR: [
              { codigoBarras: p.codigoBarras },
              { embalagensMaster: { some: { codigoBarras: p.codigoBarras } } },
            ],
          },
          select: { sku: true, nomeVenda: true },
        })
        if (conflito) {
          // remove barcode and retry without it
          validacao.data.codigoBarras = undefined
          p.avisos.push({
            campo: 'codigoBarras',
            mensagem: `EAN já em uso no SKU ${conflito.sku}; importado sem código de barras`,
          })
        }
      }

      await prisma.produto.create({
        data: {
          companyId: args.companyId,
          sku: validacao.data.sku!,
          ativo: validacao.data.ativo,
          nomeVenda: validacao.data.nomeVenda,
          marca: validacao.data.marca,
          unidade: validacao.data.unidade,
          nomeCompra: validacao.data.nomeCompra,
          bloqueadoCompra: validacao.data.bloqueadoCompra,
          controlaEstoque: validacao.data.controlaEstoque,
          permiteEstoqueNegativo: validacao.data.permiteEstoqueNegativo,
          entregaNoAto: validacao.data.entregaNoAto,
          entregaARetirar: validacao.data.entregaARetirar,
          entregar: validacao.data.entregar,
          flagComissao: validacao.data.flagComissao,
          flagDevolucao: validacao.data.flagDevolucao,
          ncm: validacao.data.ncm,
          codigoOrigem: validacao.data.codigoOrigem,
          codigoBarras: validacao.data.codigoBarras,
          pesoKg: validacao.data.pesoKg,
          alturaCm: validacao.data.alturaCm,
          larguraCm: validacao.data.larguraCm,
          comprimentoCm: validacao.data.comprimentoCm,
          capacidadeEmpilhamento: validacao.data.capacidadeEmpilhamento,
          multiploVenda: validacao.data.multiploVenda,
          permiteVendaFracionada: validacao.data.permiteVendaFracionada,
          embalagensMaster: validacao.data.embalagensMaster?.length
            ? {
                create: validacao.data.embalagensMaster.map((e, i) => ({
                  quantidade: e.quantidade,
                  codigoBarras: e.codigoBarras,
                  alturaCm: e.alturaCm,
                  larguraCm: e.larguraCm,
                  comprimentoCm: e.comprimentoCm,
                  ordem: i,
                })),
              }
            : undefined,
        },
      })
      skusExistentes.add(p.sku)
      ok += 1
      linhasRelatorio.push(
        [
          csvEscape(p.sku),
          'criado',
          csvEscape(p.nomeVenda),
          csvEscape(p.marca),
          csvEscape(p.unidade),
          csvEscape(p.ncm ?? ''),
          csvEscape(validacao.data.codigoBarras ?? ''),
          csvEscape(p.avisos.map((a) => a.mensagem).join(' | ')),
          '',
          csvEscape(p.fase2.codigoOriginal ?? ''),
          csvEscape(p.fase2.undCompra ?? ''),
          p.fase2.multiploCompraUnitario ?? '',
          csvEscape(p.fase2.fabricante ?? ''),
        ].join(',')
      )
    } catch (e) {
      erro += 1
      const msg = e instanceof Error ? e.message : String(e)
      linhasRelatorio.push(
        [
          csvEscape(p.sku),
          'erro_insert',
          csvEscape(p.nomeVenda),
          csvEscape(p.marca),
          csvEscape(p.unidade),
          csvEscape(p.ncm ?? ''),
          csvEscape(p.codigoBarras ?? ''),
          csvEscape(avisosTxt),
          csvEscape(msg),
          '',
          '',
          '',
          '',
        ].join(',')
      )
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const relatorioPath = path.join(dirSaida, `relatorio-fase1-${stamp}.csv`)
  const fase2Path = path.join(dirSaida, `depara-fase2-${stamp}.csv`)
  writeFileSync(relatorioPath, linhasRelatorio.join('\n'), 'utf8')
  writeFileSync(fase2Path, fase2Linhas.join('\n'), 'utf8')

  console.log('---')
  console.log(`OK: ${ok}`)
  console.log(`Skip (SKU já existe): ${skip}`)
  console.log(`Erros: ${erro}`)
  console.log(`Avisos: ${avisosTotal}`)
  console.log(`Relatório: ${relatorioPath}`)
  console.log(`De-para Fase 2 (preencher fornecedorPessoaId): ${fase2Path}`)
  if (!args.aplicar) {
    console.log('Dry-run concluído. Rode de novo com --aplicar para gravar.')
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
