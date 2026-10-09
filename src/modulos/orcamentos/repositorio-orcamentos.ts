import { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import {
  enderecoPersistido,
  fretePersistido,
  type DadosItemOrcamento,
  type DadosOrcamento,
} from './esquema-orcamentos.js'

function decimalNum(valor: unknown): number {
  if (valor == null) return 0
  if (typeof valor === 'number') return valor
  return Number(valor)
}

function dataParaDate(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`)
}

function dateParaIso(data: Date): string {
  return data.toISOString().slice(0, 10)
}

function centavosLinha(item: {
  codigo: string
  descricao: string
  quantidade: number
  precoUnitario: number
  percentualDesconto: number
}): number {
  if (!item.codigo.trim() && !item.descricao.trim()) return 0
  const preco4 = Math.round(item.precoUnitario * 10000)
  const liquido4 = Math.round((preco4 * (100 - item.percentualDesconto)) / 100)
  return Math.round((liquido4 * item.quantidade) / 100)
}

export function totalDoOrcamento(orcamento: {
  descontoTotal: number
  valorFrete: number
  outrasDespesas: number
  itens: Array<{
    codigo: string
    descricao: string
    quantidade: number
    precoUnitario: number
    percentualDesconto: number
  }>
}): number {
  const subtotalCentavos = orcamento.itens.reduce((soma, item) => soma + centavosLinha(item), 0)
  const descontoCentavos = Math.round(orcamento.descontoTotal * 100)
  const freteCentavos = Math.round(orcamento.valorFrete * 100)
  const outrasCentavos = Math.round(orcamento.outrasDespesas * 100)
  return (subtotalCentavos - descontoCentavos + freteCentavos + outrasCentavos) / 100
}

const includeOrcamento = {
  itens: { orderBy: { ordem: 'asc' as const } },
  company: { select: { name: true } },
} as const

type RegistroItem = {
  id: string
  ordem: number
  codigo: string
  descricao: string
  ncm: string
  quantidade: unknown
  unidade: string
  precoUnitario: unknown
  percentualDesconto: unknown
}

type RegistroOrcamento = {
  id: string
  companyId: string
  numero: string
  data: Date
  validade: Date | null
  status: string
  vendedorId: string
  clienteCodigo: string
  clienteNome: string
  cnpj: string
  telefone: string
  email: string
  contato: string
  condicaoPagamento: string
  prazoEntrega: string
  frete: string
  mensagem: string
  descontoTotal: unknown
  valorFrete: unknown
  outrasDespesas: unknown
  converterEmPedido: boolean
  cep: string
  logradouro: string
  numeroEndereco: string
  bairro: string
  cidade: string
  uf: string
  complementares: string
  observacoes: string
  itens?: RegistroItem[]
  company?: { name: string }
}

export type OrcamentoPersistido = ReturnType<typeof mapear>

function mapearItem(item: RegistroItem) {
  return {
    id: item.id,
    codigo: item.codigo,
    descricao: item.descricao,
    ncm: item.ncm,
    quantidade: decimalNum(item.quantidade),
    unidade: item.unidade,
    precoUnitario: decimalNum(item.precoUnitario),
    percentualDesconto: decimalNum(item.percentualDesconto),
  }
}

function mapear(registro: RegistroOrcamento) {
  const itens = (registro.itens ?? []).map(mapearItem)
  const corpo = {
    id: registro.id,
    numero: registro.numero,
    data: dateParaIso(registro.data),
    validade: registro.validade ? dateParaIso(registro.validade) : '',
    status: registro.status,
    vendedorId: registro.vendedorId,
    clienteCodigo: registro.clienteCodigo,
    clienteNome: registro.clienteNome,
    cnpj: registro.cnpj,
    telefone: registro.telefone,
    email: registro.email,
    contato: registro.contato,
    condicaoPagamento: registro.condicaoPagamento,
    prazoEntrega: registro.prazoEntrega,
    frete: registro.frete,
    mensagem: registro.mensagem,
    descontoTotal: decimalNum(registro.descontoTotal),
    valorFrete: decimalNum(registro.valorFrete),
    outrasDespesas: decimalNum(registro.outrasDespesas),
    converterEmPedido: registro.converterEmPedido,
    endereco: {
      cep: registro.cep,
      logradouro: registro.logradouro,
      numero: registro.numeroEndereco,
      bairro: registro.bairro,
      cidade: registro.cidade,
      uf: registro.uf,
    },
    complementares: registro.complementares,
    observacoes: registro.observacoes,
    itens,
  }
  return {
    ...corpo,
    nomeEmpresa: registro.company?.name ?? '',
    total: totalDoOrcamento(corpo),
  }
}

function itensPreenchidos(itens: DadosItemOrcamento[]) {
  return itens
    .filter((item) => item.codigo.trim() || item.descricao.trim())
    .map((item, ordem) => ({
      ordem,
      codigo: item.codigo,
      descricao: item.descricao,
      ncm: item.ncm,
      quantidade: item.quantidade,
      unidade: item.unidade || 'UN',
      precoUnitario: item.precoUnitario,
      percentualDesconto: item.percentualDesconto,
    }))
}

function dadosEscalares(dados: DadosOrcamento, numero: string, status: string) {
  const endereco = enderecoPersistido(dados.prazoEntrega, dados.endereco)
  const { frete, valorFrete } = fretePersistido(
    dados.prazoEntrega,
    dados.frete,
    dados.valorFrete
  )
  return {
    numero,
    data: dataParaDate(dados.data),
    validade: dados.validade ? dataParaDate(dados.validade) : null,
    status,
    vendedorId: dados.vendedorId,
    clienteCodigo: dados.clienteCodigo,
    clienteNome: dados.clienteNome,
    cnpj: dados.cnpj,
    telefone: dados.telefone,
    email: dados.email,
    contato: dados.contato,
    condicaoPagamento: dados.condicaoPagamento,
    prazoEntrega: dados.prazoEntrega,
    frete,
    mensagem: dados.mensagem,
    descontoTotal: dados.descontoTotal,
    valorFrete,
    outrasDespesas: dados.outrasDespesas,
    converterEmPedido: dados.converterEmPedido,
    cep: endereco.cep,
    logradouro: endereco.logradouro,
    numeroEndereco: endereco.numero,
    bairro: endereco.bairro,
    cidade: endereco.cidade,
    uf: endereco.uf,
    complementares: dados.complementares,
    observacoes: dados.observacoes,
  }
}

export function ehUnicidadeNumero(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002'
}

async function proximoNumero(companyId: string): Promise<string> {
  const numeros = await clientePrisma.orcamento.findMany({
    where: { companyId },
    select: { numero: true },
  })
  let maior = 0
  for (const item of numeros) {
    const encontrado = /^ORC-(\d+)$/.exec(item.numero.trim())
    if (!encontrado) continue
    maior = Math.max(maior, Number(encontrado[1]))
  }
  return `ORC-${String(maior + 1).padStart(6, '0')}`
}

async function listar(companyId: string) {
  const registros = await clientePrisma.orcamento.findMany({
    where: { companyId },
    include: includeOrcamento,
    orderBy: { updatedAt: 'desc' },
  })
  return registros.map((registro) => {
    const completo = mapear(registro)
    return {
      id: completo.id,
      numero: completo.numero,
      clienteNome: completo.clienteNome,
      data: completo.data,
      status: completo.status,
      total: completo.total,
    }
  })
}

async function buscarPorId(companyId: string, id: string) {
  const registro = await clientePrisma.orcamento.findFirst({
    where: { id, companyId },
    include: includeOrcamento,
  })
  return registro ? mapear(registro) : null
}

function soDigitosDocumento(valor: string) {
  return valor.replace(/\D/g, '')
}

async function buscarParaRecebimento(companyId: string, termo: string) {
  const trimmed = termo.trim()
  if (!trimmed) return []

  const digitos = soDigitosDocumento(trimmed)
  const registros = await clientePrisma.orcamento.findMany({
    where: {
      companyId,
      status: { in: ['enviado', 'aprovado'] },
    },
    include: includeOrcamento,
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })

  return registros
    .filter((registro) => {
      if (registro.numero.trim() === trimmed) return true
      if (digitos.length >= 11 && soDigitosDocumento(registro.cnpj) === digitos) return true
      return false
    })
    .map((registro) => mapear(registro))
}

async function listarRecebiveis(companyId: string, idsPagos: Set<string>) {
  const idsExcluir = [...idsPagos]
  const registros = await clientePrisma.orcamento.findMany({
    where: {
      companyId,
      status: { in: ['enviado', 'aprovado'] },
      ...(idsExcluir.length > 0 ? { id: { notIn: idsExcluir } } : {}),
    },
    include: includeOrcamento,
    orderBy: { updatedAt: 'desc' },
  })
  return registros.map((registro) => mapear(registro))
}

async function criar(companyId: string, dados: DadosOrcamento, numero: string, status: string) {
  const registro = await clientePrisma.orcamento.create({
    data: {
      companyId,
      ...dadosEscalares(dados, numero, status),
      itens: { create: itensPreenchidos(dados.itens) },
    },
    include: includeOrcamento,
  })
  return mapear(registro)
}

async function atualizar(
  companyId: string,
  id: string,
  dados: DadosOrcamento,
  numero: string,
  status: string
) {
  return clientePrisma.$transaction(async (tx) => {
    const existente = await tx.orcamento.findFirst({
      where: { id, companyId },
      select: { id: true },
    })
    if (!existente) return null

    await tx.orcamentoItem.deleteMany({ where: { orcamentoId: id } })
    const registro = await tx.orcamento.update({
      where: { id },
      data: {
        ...dadosEscalares(dados, numero, status),
        itens: { create: itensPreenchidos(dados.itens) },
      },
      include: includeOrcamento,
    })
    return mapear(registro)
  })
}

async function atualizarStatus(companyId: string, id: string, status: string) {
  const existente = await clientePrisma.orcamento.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!existente) return null
  const registro = await clientePrisma.orcamento.update({
    where: { id },
    data: { status },
    include: includeOrcamento,
  })
  return mapear(registro)
}

export const repositorioDeOrcamentos = {
  listar,
  buscarPorId,
  buscarParaRecebimento,
  listarRecebiveis,
  criar,
  atualizar,
  atualizarStatus,
  proximoNumero,
}
