/**
 * Completa campos dos produtos já migrados (não recria catálogo).
 *
 * Atualiza no produto:
 * - precoCusto (Preço Santri → sugestão de preço unitário no pedido)
 * - codigoBarras (inclui UPC-12→EAN-13 quando válido)
 * - multiploVenda, dimensões, nomeCompra, NCM, origem, embalagens master
 *
 * Com --fornecedor-id, cria/atualiza vínculo ProdutoFornecedor (necessário para
 * código original, unidade de entrada e múltiplo de compra no pedido):
 * - codigoFornecedor ← Código original Santri
 * - unidadeEntrada / multiploEntrada / multiplicadorEntrada ← regras ERP §6.8
 *
 * Uso:
 *   npm run migrar:completar-santri -- --arquivo "..." --company-id UUID
 *   npm run migrar:completar-santri -- --arquivo "..." --company-id UUID --fornecedor-id UUID --aplicar
 *   npm run migrar:completar-santri -- --arquivo "..." --company-id UUID --fornecedor-id UUID --modo-multiplo forcar-iguais --aplicar
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { parsearOdsProdutosSantri } from './migracao-santri/parser-ods-produtos.js'
import {
  nomeUnidadePorSigla,
  normalizarProdutoSantri,
  resolverMultiplicadoresVinculo,
  type ProdutoSantriNormalizado,
} from './migracao-santri/normalizar-produto-santri.js'

const prisma = new PrismaClient()

type Args = {
  arquivo?: string
  companyId?: string
  fornecedorId?: string
  aplicar: boolean
  modoMultiplo: 'auto' | 'forcar-iguais'
  limite?: number
  saida?: string
  listarFornecedores: boolean
}

function lerArgs(argv: string[]): Args {
  const args: Args = {
    aplicar: false,
    modoMultiplo: 'auto',
    listarFornecedores: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--aplicar') args.aplicar = true
    else if (a === '--listar-fornecedores') args.listarFornecedores = true
    else if (a === '--arquivo') args.arquivo = argv[++i]
    else if (a === '--company-id') args.companyId = argv[++i]
    else if (a === '--fornecedor-id') args.fornecedorId = argv[++i]
    else if (a === '--modo-multiplo') {
      const m = argv[++i]
      args.modoMultiplo = m === 'forcar-iguais' ? 'forcar-iguais' : 'auto'
    } else if (a === '--limite') args.limite = Number(argv[++i])
    else if (a === '--saida') args.saida = argv[++i]
  }
  return args
}

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

async function garantirUnidade(sigla: string, companyId: string, cache: Set<string>) {
  const s = sigla.toUpperCase()
  if (cache.has(s)) return
  const existente = await prisma.unidadeMedida.findFirst({
    where: { companyId, sigla: s },
    select: { sigla: true },
  })
  if (existente) {
    cache.add(s)
    return
  }
  await prisma.unidadeMedida.create({
    data: { companyId, sigla: s, nome: nomeUnidadePorSigla(s) },
  })
  cache.add(s)
}

function resolverVinculoCompra(
  p: ProdutoSantriNormalizado,
  modo: 'auto' | 'forcar-iguais'
) {
  const base = resolverMultiplicadoresVinculo({
    unidadeVenda: p.unidade,
    unidadeEntrada: p.fase2.undCompra || p.unidade,
    multiploCompraUnitario: p.fase2.multiploCompraUnitario,
    multiploCompraSecundario: p.fase2.multiploCompraSecundario,
  })
  if (base.ok) return base
  if (modo === 'forcar-iguais') {
    return {
      ok: true as const,
      unidadeEntrada: p.unidade,
      multiplicadorEntrada: 1,
      multiploEntrada: 1,
      avisos: [
        ...base.avisos,
        {
          campo: 'multiplicadorEntrada',
          mensagem:
            'Modo forcar-iguais: und compra inválida no ERP; vínculo com und venda e múltiplo 1',
        },
      ],
      motivoErro: undefined,
    }
  }
  return base
}

async function main() {
  const args = lerArgs(process.argv.slice(2))

  if (args.listarFornecedores) {
    if (!args.companyId) {
      console.error('Informe --company-id com --listar-fornecedores')
      process.exit(1)
    }
    const lista = await prisma.pessoa.findMany({
      where: {
        companyId: args.companyId,
        papeis: { some: { papel: 'fornecedor', ativo: true } },
      },
      select: { id: true, nome: true, cnpj: true, ativo: true },
      orderBy: { nome: 'asc' },
      take: 200,
    })
    console.log(`Fornecedores ativos (${lista.length}):`)
    for (const f of lista) {
      console.log(`  ${f.id}  ${f.ativo ? 'ok' : 'inativo'}  ${f.nome}  ${f.cnpj ?? ''}`)
    }
    return
  }

  if (!args.arquivo || !args.companyId) {
    console.error(
      'Uso: --arquivo caminho.zip --company-id UUID [--fornecedor-id UUID] [--modo-multiplo auto|forcar-iguais] [--aplicar]'
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

  let fornecedorNome: string | undefined
  if (args.fornecedorId) {
    const forn = await prisma.pessoa.findFirst({
      where: {
        id: args.fornecedorId,
        companyId: args.companyId,
        papeis: { some: { papel: 'fornecedor', ativo: true } },
      },
      select: { id: true, nome: true },
    })
    if (!forn) {
      console.error('Fornecedor inválido/inativo nesta empresa. Use --listar-fornecedores')
      process.exit(1)
    }
    fornecedorNome = forn.nome
  }

  console.log(`Empresa: ${empresa.name}`)
  console.log(`Modo: ${args.aplicar ? 'APLICAR' : 'DRY-RUN'}`)
  console.log(
    args.fornecedorId
      ? `Vínculo compra: ${fornecedorNome} (${args.fornecedorId}) | multiplo=${args.modoMultiplo}`
      : 'Vínculo compra: NÃO (só campos do produto). Passe --fornecedor-id para código original / múltiplo no pedido.'
  )

  let brutos = parsearOdsProdutosSantri(args.arquivo)
  if (args.limite && args.limite > 0) brutos = brutos.slice(0, args.limite)

  const normalizados = new Map<string, ProdutoSantriNormalizado>()
  for (const b of brutos) {
    const r = normalizarProdutoSantri(b)
    if ('erro' in r) continue
    normalizados.set(r.sku, r)
  }

  const produtos = await prisma.produto.findMany({
    where: { companyId: args.companyId, sku: { in: [...normalizados.keys()] } },
    select: {
      id: true,
      sku: true,
      nomeVenda: true,
      unidade: true,
      codigoBarras: true,
      precoCusto: true,
      multiploVenda: true,
      fornecedores: args.fornecedorId
        ? {
            where: { fornecedorPessoaId: args.fornecedorId },
            select: { id: true },
          }
        : false,
    },
  })

  const dirSaida =
    args.saida ||
    path.join(process.cwd(), 'scripts', 'migracao-santri', 'saida')
  mkdirSync(dirSaida, { recursive: true })
  const rel: string[] = [
    'sku,status,precoCusto,codigoBarras,multiploVenda,vinculo,unidadeEntrada,multiplicador,codigoOriginal,avisos,erro',
  ]

  const undCache = new Set<string>()
  let okProduto = 0
  let okVinculo = 0
  let skip = 0
  let erro = 0
  let eanRecuperado = 0

  for (const produto of produtos) {
    const sku = produto.sku!
    const p = normalizados.get(sku)
    if (!p) {
      skip += 1
      continue
    }

    const avisos = [...p.avisos.map((a) => a.mensagem)]
    if (p.avisos.some((a) => a.campo === 'codigoBarras' && a.mensagem.includes('UPC-12'))) {
      eanRecuperado += 1
    }

    const preco =
      p.fase2.precoSantriIgnorado != null && p.fase2.precoSantriIgnorado > 0
        ? p.fase2.precoSantriIgnorado
        : undefined

    // Conflito de EAN
    let codigoBarras = p.codigoBarras
    if (codigoBarras) {
      const conflito = await prisma.produto.findFirst({
        where: {
          companyId: args.companyId,
          id: { not: produto.id },
          OR: [
            { codigoBarras },
            { embalagensMaster: { some: { codigoBarras } } },
          ],
        },
        select: { sku: true },
      })
      if (conflito) {
        avisos.push(`EAN em uso no SKU ${conflito.sku}; mantido sem alterar barras`)
        codigoBarras = produto.codigoBarras ?? undefined
      }
    }

    const dataProduto: {
      precoCusto?: number
      codigoBarras?: string | null
      multiploVenda?: number
      nomeCompra?: string
      ncm?: string | null
      codigoOrigem?: string | null
      pesoKg?: number | null
      alturaCm?: number | null
      larguraCm?: number | null
      comprimentoCm?: number | null
      capacidadeEmpilhamento?: number | null
    } = {}

    if (preco != null) dataProduto.precoCusto = preco
    if (codigoBarras) dataProduto.codigoBarras = codigoBarras
    else if (!produto.codigoBarras && p.codigoBarras === undefined) {
      // sem EAN novo
    }
    if (p.multiploVenda > 0) dataProduto.multiploVenda = p.multiploVenda
    if (p.nomeCompra) dataProduto.nomeCompra = p.nomeCompra
    if (p.ncm) dataProduto.ncm = p.ncm
    if (p.codigoOrigem) dataProduto.codigoOrigem = p.codigoOrigem
    if (p.pesoKg != null) dataProduto.pesoKg = p.pesoKg
    if (p.alturaCm != null) dataProduto.alturaCm = p.alturaCm
    if (p.larguraCm != null) dataProduto.larguraCm = p.larguraCm
    if (p.comprimentoCm != null) dataProduto.comprimentoCm = p.comprimentoCm
    if (p.capacidadeEmpilhamento != null) {
      dataProduto.capacidadeEmpilhamento = p.capacidadeEmpilhamento
    }

    let vinculoStatus = 'sem_fornecedor'
    let undEnt = ''
    let mult = ''
    let codOrig = p.fase2.codigoOriginal ?? ''

    const vinculoResolvido = args.fornecedorId
      ? resolverVinculoCompra(p, args.modoMultiplo)
      : null

    if (vinculoResolvido && !vinculoResolvido.ok) {
      vinculoStatus = 'skip_multiplo_invalido'
      avisos.push(vinculoResolvido.motivoErro ?? 'múltiplo inválido')
    } else if (vinculoResolvido?.ok && args.fornecedorId) {
      undEnt = vinculoResolvido.unidadeEntrada
      mult = String(vinculoResolvido.multiplicadorEntrada)
      avisos.push(...vinculoResolvido.avisos.map((a) => a.mensagem))
    }

    if (!args.aplicar) {
      okProduto += 1
      if (vinculoResolvido?.ok) okVinculo += 1
      rel.push(
        [
          csvEscape(sku),
          'ok_dry_run',
          preco ?? '',
          codigoBarras ?? '',
          p.multiploVenda,
          vinculoStatus === 'sem_fornecedor'
            ? 'sem_fornecedor'
            : vinculoResolvido?.ok
              ? 'ok_vinculo'
              : vinculoStatus,
          undEnt,
          mult,
          csvEscape(codOrig),
          csvEscape(avisos.join(' | ')),
          '',
        ].join(',')
      )
      continue
    }

    try {
      if (undEnt) await garantirUnidade(undEnt, args.companyId, undCache)
      await garantirUnidade(p.unidade, args.companyId, undCache)

      await prisma.produto.update({
        where: { id: produto.id },
        data: dataProduto,
      })

      if (p.embalagensMaster.length) {
        const temMaster = await prisma.produtoEmbalagemMaster.count({
          where: { produtoId: produto.id },
        })
        if (temMaster === 0) {
          await prisma.produtoEmbalagemMaster.createMany({
            data: p.embalagensMaster.map((e, i) => ({
              produtoId: produto.id,
              quantidade: e.quantidade,
              alturaCm: e.alturaCm,
              larguraCm: e.larguraCm,
              comprimentoCm: e.comprimentoCm,
              ordem: i,
            })),
          })
        }
      }

      okProduto += 1

      if (vinculoResolvido?.ok && args.fornecedorId) {
        const existente = Array.isArray(produto.fornecedores)
          ? produto.fornecedores[0]
          : null
        if (existente) {
          await prisma.produtoFornecedor.update({
            where: { id: existente.id },
            data: {
              codigoFornecedor: codOrig || null,
              unidadeEntrada: vinculoResolvido.unidadeEntrada,
              multiplicadorEntrada: vinculoResolvido.multiplicadorEntrada,
              multiploEntrada: vinculoResolvido.multiploEntrada,
            },
          })
        } else {
          await prisma.produtoFornecedor.create({
            data: {
              produtoId: produto.id,
              fornecedorPessoaId: args.fornecedorId,
              codigoFornecedor: codOrig || null,
              unidadeEntrada: vinculoResolvido.unidadeEntrada,
              multiplicadorEntrada: vinculoResolvido.multiplicadorEntrada,
              multiploEntrada: vinculoResolvido.multiploEntrada,
              ordem: 0,
            },
          })
        }
        okVinculo += 1
        vinculoStatus = 'vinculo_ok'
      }

      rel.push(
        [
          csvEscape(sku),
          'atualizado',
          preco ?? '',
          codigoBarras ?? '',
          p.multiploVenda,
          vinculoStatus,
          undEnt,
          mult,
          csvEscape(codOrig),
          csvEscape(avisos.join(' | ')),
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
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          csvEscape(avisos.join(' | ')),
          csvEscape(msg),
        ].join(',')
      )
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const relPath = path.join(dirSaida, `relatorio-completar-${stamp}.csv`)
  writeFileSync(relPath, rel.join('\n'), 'utf8')

  console.log('---')
  console.log(`Produtos atualizados/ok: ${okProduto}`)
  console.log(`Vínculos compra ok: ${okVinculo}`)
  console.log(`EAN recuperados (UPC-12→13) no lote: ~${eanRecuperado}`)
  console.log(`Skip/erro: ${skip}/${erro}`)
  console.log(`Relatório: ${relPath}`)
  if (!args.fornecedorId) {
    console.log(
      'Atenção: sem --fornecedor-id o pedido NÃO preenche código original nem múltiplo de compra.'
    )
  }
  if (!args.aplicar) console.log('Dry-run ok. Rode com --aplicar para gravar.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
