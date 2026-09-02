/**
 * Importa planos financeiros de dados/planos-financeiros.json para uma empresa.
 *
 * Uso (VPS — Conexão Atacadista por CNPJ):
 *   npm run migrar:planos-financeiros
 *   npm run migrar:planos-financeiros -- --aplicar
 *
 * Overrides:
 *   --arquivo caminho.json
 *   --company-id UUID
 *   --listar-empresas
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import {
  codigoCompativelComTipo,
  type TipoPlanoFinanceiro,
} from '../src/modulos/planos-financeiros/codigo-plano-financeiro.js'
import { codigoProfundidadeValido } from '../src/modulos/planos-financeiros/profundidade-plano-financeiro.js'

const prisma = new PrismaClient()

const CNPJ_CONEXAO = '34221243000171'
const ARQUIVO_PADRAO = path.join(process.cwd(), 'dados', 'planos-financeiros.json')

type PlanoJson = {
  codigo: string
  nome: string
  tipo: TipoPlanoFinanceiro
  mostrarNaDre: boolean
  permiteLancamentoManual: boolean
  exigeAnexoLancamento: boolean
  permiteUsoConsumo: boolean
}

type PacoteJson = {
  fonte?: string
  emitidoEm?: string
  total?: number
  planos: PlanoJson[]
}

type Args = {
  arquivo: string
  companyId?: string
  aplicar: boolean
  listarEmpresas: boolean
}

type AcaoPrevista =
  | { tipo: 'criar'; plano: PlanoJson; parentCodigo: string | null }
  | { tipo: 'atualizar'; codigo: string; nomeAntigo: string; nomeNovo: string }
  | { tipo: 'igual'; codigo: string }
  | { tipo: 'remover'; codigo: string; nome: string; id: string }

function lerArgs(argv: string[]): Args {
  const args: Args = {
    arquivo: ARQUIVO_PADRAO,
    aplicar: false,
    listarEmpresas: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    if (flag === '--aplicar') args.aplicar = true
    else if (flag === '--listar-empresas') args.listarEmpresas = true
    else if (flag === '--arquivo') args.arquivo = path.resolve(argv[++i] ?? '')
    else if (flag === '--company-id') args.companyId = argv[++i]
  }
  return args
}

function carregarPacote(caminho: string): PacoteJson {
  const bruto = readFileSync(caminho, 'utf8')
  const pacote = JSON.parse(bruto) as PacoteJson
  if (!Array.isArray(pacote.planos) || pacote.planos.length === 0) {
    throw new Error(`Arquivo sem planos: ${caminho}`)
  }
  return pacote
}

function profundidadeCodigo(codigo: string): number {
  return codigo.split('.').length
}

function codigoPai(codigo: string): string | null {
  const partes = codigo.split('.')
  if (partes.length <= 2) return null
  return partes.slice(0, 2).join('.')
}

function ordenarPlanos(planos: PlanoJson[]): PlanoJson[] {
  return [...planos].sort((a, b) => {
    const pa = a.codigo.split('.').map((n) => Number(n))
    const pb = b.codigo.split('.').map((n) => Number(n))
    const len = Math.max(pa.length, pb.length)
    for (let i = 0; i < len; i++) {
      const va = pa[i] ?? -1
      const vb = pb[i] ?? -1
      if (va !== vb) return va - vb
    }
    return 0
  })
}

function validarPacote(planos: PlanoJson[]): string[] {
  const erros: string[] = []
  const vistos = new Set<string>()
  const codigos = new Set(planos.map((p) => p.codigo))

  for (const plano of planos) {
    if (vistos.has(plano.codigo)) {
      erros.push(`Código duplicado no JSON: ${plano.codigo}`)
      continue
    }
    vistos.add(plano.codigo)

    const profundidade = profundidadeCodigo(plano.codigo)
    if (profundidade < 2 || profundidade > 3) {
      erros.push(`${plano.codigo}: profundidade inválida (${profundidade})`)
    }
    if (!codigoProfundidadeValido(plano.codigo)) {
      erros.push(`${plano.codigo}: excede profundidade máxima do ERP`)
    }
    if (!codigoCompativelComTipo(plano.codigo, plano.tipo)) {
      erros.push(`${plano.codigo}: código incompatível com tipo ${plano.tipo}`)
    }
    if (plano.nome.trim().length < 2) {
      erros.push(`${plano.codigo}: nome curto demais`)
    }

    const pai = codigoPai(plano.codigo)
    if (pai && !codigos.has(pai)) {
      erros.push(`${plano.codigo}: grupo pai ${pai} ausente no JSON`)
    }
  }

  return erros
}

function flagsDiferentes(
  existente: {
    mostrarNaDre: boolean
    permiteLancamentoManual: boolean
    exigeAnexoLancamento: boolean
    permiteUsoConsumo: boolean
  },
  plano: PlanoJson
): boolean {
  return (
    existente.mostrarNaDre !== plano.mostrarNaDre ||
    existente.permiteLancamentoManual !== plano.permiteLancamentoManual ||
    existente.exigeAnexoLancamento !== plano.exigeAnexoLancamento ||
    existente.permiteUsoConsumo !== plano.permiteUsoConsumo
  )
}

async function resolverEmpresa(companyId?: string) {
  if (companyId) {
    const empresa = await prisma.company.findFirst({
      where: { id: companyId, active: true },
      select: { id: true, name: true, cnpj: true },
    })
    if (!empresa) throw new Error(`Empresa não encontrada: ${companyId}`)
    return empresa
  }

  const empresa = await prisma.company.findFirst({
    where: {
      active: true,
      OR: [
        { cnpj: CNPJ_CONEXAO },
        { cnpj: '34.221.243/0001-71' },
        { name: { contains: 'conex', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, cnpj: true },
  })

  if (!empresa) {
    throw new Error(
      `Empresa Conexão Atacadista não encontrada (CNPJ ${CNPJ_CONEXAO}). Use --listar-empresas ou --company-id.`
    )
  }

  return empresa
}

async function listarEmpresas() {
  const empresas = await prisma.company.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, cnpj: true },
  })
  if (empresas.length === 0) {
    console.log('Nenhuma empresa ativa.')
    return
  }
  for (const empresa of empresas) {
    console.log(`${empresa.id}\t${empresa.cnpj}\t${empresa.name}`)
  }
}

function montarAcoes(
  planosOrdenados: PlanoJson[],
  existentesPorCodigo: Map<
    string,
    {
      id: string
      nome: string
      mostrarNaDre: boolean
      permiteLancamentoManual: boolean
      exigeAnexoLancamento: boolean
      permiteUsoConsumo: boolean
    }
  >
): AcaoPrevista[] {
  const acoes: AcaoPrevista[] = []
  const codigosJson = new Set(planosOrdenados.map((p) => p.codigo))

  const paraRemover = [...existentesPorCodigo.entries()]
    .filter(([codigo]) => !codigosJson.has(codigo))
    .map(([codigo, plano]) => ({ codigo, plano }))
    .sort((a, b) => profundidadeCodigo(b.codigo) - profundidadeCodigo(a.codigo))

  for (const { codigo, plano } of paraRemover) {
    acoes.push({ tipo: 'remover', codigo, nome: plano.nome, id: plano.id })
  }

  for (const plano of planosOrdenados) {
    const existente = existentesPorCodigo.get(plano.codigo)
    if (!existente) {
      acoes.push({ tipo: 'criar', plano, parentCodigo: codigoPai(plano.codigo) })
      continue
    }

    const nomeMudou = existente.nome !== plano.nome
    const flagsMudaram = flagsDiferentes(existente, plano)
    if (nomeMudou || flagsMudaram) {
      acoes.push({
        tipo: 'atualizar',
        codigo: plano.codigo,
        nomeAntigo: existente.nome,
        nomeNovo: plano.nome,
      })
    } else {
      acoes.push({ tipo: 'igual', codigo: plano.codigo })
    }
  }

  return acoes
}

function imprimirRelatorio(
  empresa: { name: string; cnpj: string },
  pacote: PacoteJson,
  acoes: AcaoPrevista[]
) {
  const criar = acoes.filter((a) => a.tipo === 'criar')
  const atualizar = acoes.filter((a) => a.tipo === 'atualizar')
  const iguais = acoes.filter((a) => a.tipo === 'igual')
  const remover = acoes.filter((a) => a.tipo === 'remover')

  console.log('--- Importação de planos financeiros (substituição) ---')
  console.log(`Empresa: ${empresa.name} (${empresa.cnpj})`)
  if (pacote.fonte) console.log(`Fonte JSON: ${pacote.fonte}`)
  if (pacote.emitidoEm) console.log(`Emitido em: ${pacote.emitidoEm}`)
  console.log(`Planos no JSON: ${pacote.planos.length}`)
  console.log(`Remover (fora da planilha): ${remover.length}`)
  console.log(`Criar: ${criar.length}`)
  console.log(`Atualizar: ${atualizar.length}`)
  console.log(`Já iguais: ${iguais.length}`)

  if (remover.length > 0) {
    console.log('\nA remover (amostra até 15):')
    for (const acao of remover.slice(0, 15)) {
      if (acao.tipo !== 'remover') continue
      console.log(`  - ${acao.codigo} ${acao.nome}`)
    }
    if (remover.length > 15) console.log(`  ... +${remover.length - 15}`)
  }

  if (criar.length > 0) {
    console.log('\nA criar (amostra até 15):')
    for (const acao of criar.slice(0, 15)) {
      if (acao.tipo !== 'criar') continue
      const pai = acao.parentCodigo ? ` pai ${acao.parentCodigo}` : ''
      console.log(`  + ${acao.plano.codigo} ${acao.plano.nome} (${acao.plano.tipo})${pai}`)
    }
    if (criar.length > 15) console.log(`  ... +${criar.length - 15}`)
  }

  if (atualizar.length > 0) {
    console.log('\nA atualizar (amostra até 10):')
    for (const acao of atualizar.slice(0, 10)) {
      if (acao.tipo !== 'atualizar') continue
      console.log(`  ~ ${acao.codigo}: «${acao.nomeAntigo}» → «${acao.nomeNovo}»`)
    }
    if (atualizar.length > 10) console.log(`  ... +${atualizar.length - 10}`)
  }
}

async function aplicarAcoes(
  companyId: string,
  planosOrdenados: PlanoJson[],
  acoes: AcaoPrevista[]
) {
  await prisma.$transaction(async (tx) => {
    const mapaIdPorCodigo = new Map<string, string>()

    const existentes = await tx.planoFinanceiro.findMany({
      where: { companyId },
      select: { id: true, codigo: true },
    })
    for (const plano of existentes) {
      mapaIdPorCodigo.set(plano.codigo, plano.id)
    }

    for (const acao of acoes) {
      if (acao.tipo === 'remover') {
        await tx.planoFinanceiro.delete({ where: { id: acao.id } })
        mapaIdPorCodigo.delete(acao.codigo)
        continue
      }

      if (acao.tipo === 'igual') continue

      if (acao.tipo === 'atualizar') {
        const id = mapaIdPorCodigo.get(acao.codigo)
        if (!id) continue
        const planoJson = planosOrdenados.find((p) => p.codigo === acao.codigo)
        if (!planoJson) continue
        await tx.planoFinanceiro.update({
          where: { id },
          data: {
            nome: planoJson.nome,
            mostrarNaDre: planoJson.mostrarNaDre,
            permiteLancamentoManual: planoJson.permiteLancamentoManual,
            exigeAnexoLancamento: planoJson.exigeAnexoLancamento,
            permiteUsoConsumo: planoJson.permiteUsoConsumo,
          },
        })
        continue
      }

      const { plano, parentCodigo } = acao
      let parentId: string | null = null
      if (parentCodigo) {
        parentId = mapaIdPorCodigo.get(parentCodigo) ?? null
        if (!parentId) {
          throw new Error(
            `Pai ${parentCodigo} não encontrado ao criar ${plano.codigo}. Rode novamente ou verifique a ordem.`
          )
        }
      }

      const criado = await tx.planoFinanceiro.create({
        data: {
          companyId,
          codigo: plano.codigo,
          nome: plano.nome,
          tipo: plano.tipo,
          parentId,
          mostrarNaDre: plano.mostrarNaDre,
          permiteLancamentoManual: plano.permiteLancamentoManual,
          exigeAnexoLancamento: plano.exigeAnexoLancamento,
          permiteUsoConsumo: plano.permiteUsoConsumo,
        },
        select: { id: true, codigo: true },
      })
      mapaIdPorCodigo.set(criado.codigo, criado.id)
    }
  })
}

async function main() {
  const args = lerArgs(process.argv.slice(2))

  if (args.listarEmpresas) {
    await listarEmpresas()
    return
  }

  const pacote = carregarPacote(args.arquivo)
  const erros = validarPacote(pacote.planos)
  if (erros.length > 0) {
    console.error('Validação do JSON falhou:')
    for (const erro of erros) console.error(`  - ${erro}`)
    process.exit(1)
  }

  const empresa = await resolverEmpresa(args.companyId)
  const planosOrdenados = ordenarPlanos(pacote.planos)

  const existentes = await prisma.planoFinanceiro.findMany({
    where: { companyId: empresa.id },
    select: {
      id: true,
      codigo: true,
      nome: true,
      mostrarNaDre: true,
      permiteLancamentoManual: true,
      exigeAnexoLancamento: true,
      permiteUsoConsumo: true,
    },
  })

  const existentesPorCodigo = new Map(existentes.map((p) => [p.codigo, p]))
  const acoes = montarAcoes(planosOrdenados, existentesPorCodigo)

  imprimirRelatorio(empresa, pacote, acoes)

  if (!args.aplicar) {
    console.log('\nDry-run: nada gravado. Use --aplicar para importar.')
    return
  }

  const temMudanca = acoes.some((a) => a.tipo !== 'igual')
  if (!temMudanca) {
    console.log('\nNada a gravar — cadastro já está igual à planilha.')
    return
  }

  await aplicarAcoes(empresa.id, planosOrdenados, acoes)
  console.log('\nSubstituição concluída — cadastro alinhado à planilha.')
}

main()
  .catch((erro) => {
    console.error(erro)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
