import { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { opcoesPagamentoOrcamento, validarPagamentoOrcamento, parcelasBoletoNoFechamento, dataCivilFechamento } from './pagamento-orcamento.js'
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
  valorFrete: number
  outrasDespesas: number
  itens: Array<{
    codigo: string
    descricao: string
    quantidade: number
    precoUnitario: number
    percentualDesconto: number
    valorSt?: number
  }>
}): number {
  const liquidoCentavos = orcamento.itens.reduce((soma, item) => soma + centavosLinha(item), 0)
  const stCentavos = orcamento.itens.reduce(
    (soma, item) => soma + Math.round((item.valorSt ?? 0) * 100),
    0
  )
  const freteCentavos = Math.round(orcamento.valorFrete * 100)
  const outrasCentavos = Math.round(orcamento.outrasDespesas * 100)
  return (liquidoCentavos + stCentavos + freteCentavos + outrasCentavos) / 100
}

const includeOrcamento = {
  itens: {
    orderBy: { ordem: 'asc' as const },
    include: {
      produto: {
        select: {
          multiploVenda: true,
          permiteVendaFracionada: true,
          estoqueSaldo: true,
          fotos: { where: { tipo: 'miniatura' }, take: 1 },
        },
      },
    },
  },
  company: { select: { name: true } },
  pedidoVenda: { select: { id: true, numero: true } },
  historico: {
    orderBy: { createdAt: 'desc' as const },
    include: { usuario: { select: { id: true, name: true } } },
  },
} as const

type RegistroItem = {
  id: string
  ordem: number
  produtoId: string | null
  codigo: string
  descricao: string
  marca: string
  ncm: string
  quantidade: unknown
  unidade: string
  precoUnitario: unknown
  percentualDesconto: unknown
  valorSt: unknown
  produto?: {
    multiploVenda: unknown
    permiteVendaFracionada: boolean
    estoqueSaldo: {
      qtdFisica: unknown
      qtdReservada: unknown
      qtdBloqueada: unknown
    } | null
    fotos: Array<{ arquivo: string }>
  } | null
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
  parametroBoletoId?: string | null
  prazosBoleto?: number[]
  parcelasCredito?: number | null
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
  pedidoVenda?: { id: string; numero: string } | null
  historico?: Array<{
    id: string
    acao: string
    descricao: string
    createdAt: Date
    usuario: { id: string; name: string } | null
  }>
}

export type OrcamentoPersistido = ReturnType<typeof mapear>

function mapearItem(item: RegistroItem) {
  const saldo = item.produto?.estoqueSaldo
  const estoque = saldo
    ? decimalNum(saldo.qtdFisica) -
      decimalNum(saldo.qtdReservada) -
      decimalNum(saldo.qtdBloqueada)
    : null
  return {
    id: item.id,
    produtoId: item.produtoId,
    codigo: item.codigo,
    descricao: item.descricao,
    marca: item.marca,
    ncm: item.ncm,
    quantidade: decimalNum(item.quantidade),
    unidade: item.unidade,
    precoUnitario: decimalNum(item.precoUnitario),
    percentualDesconto: decimalNum(item.percentualDesconto),
    valorSt: decimalNum(item.valorSt),
    estoque,
    multiploVenda: decimalNum(item.produto?.multiploVenda ?? 1),
    permiteVendaFracionada: item.produto?.permiteVendaFracionada ?? true,
    miniatura: item.produto?.fotos[0]?.arquivo ?? null,
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
    parametroBoletoId: registro.parametroBoletoId ?? null,
    prazosBoleto: registro.prazosBoleto ?? [],
    parcelasCredito: registro.parcelasCredito ?? null,
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
    pedidoVenda: registro.pedidoVenda ?? null,
    historico: (registro.historico ?? []).map((evento) => ({
      ...evento,
      createdAt: evento.createdAt.toISOString(),
    })),
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
      produtoId: item.produtoId,
      codigo: item.codigo,
      descricao: item.descricao,
      marca: item.marca,
      ncm: item.ncm,
      quantidade: item.quantidade,
      unidade: item.unidade || 'UN',
      precoUnitario: item.precoUnitario,
      percentualDesconto: item.percentualDesconto,
      valorSt: calcularStItem(),
    }))
}

export function calcularStItem(): number {
  return 0
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
    parametroBoletoId: dados.condicaoPagamento === 'boleto' ? dados.parametroBoletoId : null,
    prazosBoleto: dados.condicaoPagamento === 'boleto' ? dados.prazosBoleto : [],
    parcelasCredito: dados.condicaoPagamento === 'cartao_credito' ? dados.parcelasCredito : null,
    prazoEntrega: dados.prazoEntrega,
    frete,
    mensagem: dados.mensagem,
    descontoTotal: dados.itens.reduce((soma, item) => {
      const bruto = item.quantidade * item.precoUnitario
      return soma + bruto * (item.percentualDesconto / 100)
    }, 0),
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
      status: { in: ['em_aberto', 'convertido'] },
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
      status: { in: ['em_aberto', 'convertido'] },
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
    await tx.$queryRaw`SELECT id FROM "Orcamento" WHERE id = ${id} AND "companyId" = ${companyId} FOR UPDATE`
    const existente = await tx.orcamento.findFirst({
      where: { id, companyId, status: 'em_aberto' },
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

async function expirarVencidos(companyId: string, hoje: string) {
  return clientePrisma.orcamento.updateMany({
    where: {
      companyId,
      status: 'em_aberto',
      validade: { lt: dataParaDate(hoje) },
    },
    data: { status: 'expirado' },
  })
}

async function buscarProdutosParaValidacao(companyId: string, produtoIds: string[]) {
  return clientePrisma.produto.findMany({
    where: { companyId, id: { in: produtoIds } },
    select: {
      id: true,
      multiploVenda: true,
      permiteVendaFracionada: true,
      estoqueSaldo: true,
      fotos: { where: { tipo: 'miniatura' }, take: 1 },
    },
  })
}

async function registrarHistorico(
  orcamentoId: string,
  usuarioId: string | undefined,
  acao: string,
  descricao: string,
  dadosJson?: Prisma.InputJsonValue
) {
  return clientePrisma.orcamentoHistorico.create({
    data: { orcamentoId, usuarioId, acao, descricao, dadosJson },
  })
}

async function aplicarDesconto(
  companyId: string,
  id: string,
  percentual: number,
  itemIds: string[] | null,
  usuarioId?: string
) {
  return clientePrisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Orcamento" WHERE id = ${id} AND "companyId" = ${companyId} FOR UPDATE`
    const orcamento = await tx.orcamento.findFirst({
      where: { id, companyId },
      include: { itens: true },
    })
    if (!orcamento) return null
    if (orcamento.status !== 'em_aberto') return { bloqueado: true as const }
    const alvos = itemIds == null ? orcamento.itens.map((item) => item.id) : itemIds
    await tx.orcamentoItem.updateMany({
      where: { orcamentoId: id, id: { in: alvos } },
      data: { percentualDesconto: percentual },
    })
    const itens = orcamento.itens.map((item) => ({
      ...item,
      percentualDesconto: alvos.includes(item.id)
        ? new Prisma.Decimal(percentual)
        : item.percentualDesconto,
    }))
    const descontoTotal = itens.reduce((soma, item) => {
      const bruto = decimalNum(item.quantidade) * decimalNum(item.precoUnitario)
      return soma + bruto * (decimalNum(item.percentualDesconto) / 100)
    }, 0)
    await tx.orcamento.update({ where: { id }, data: { descontoTotal } })
    await tx.orcamentoHistorico.create({
      data: {
        orcamentoId: id,
        usuarioId,
        acao: 'desconto',
        descricao: `Desconto de ${percentual}% aplicado`,
        dadosJson: { percentual, itemIds },
      },
    })
    const atualizado = await tx.orcamento.findUniqueOrThrow({
      where: { id },
      include: includeOrcamento,
    })
    return mapear(atualizado)
  })
}

async function copiarItensPedido(companyId: string, id: string, pedidoVendaId: string, usuarioId?: string) {
  return clientePrisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Orcamento" WHERE id = ${id} AND "companyId" = ${companyId} FOR UPDATE`
    const [orcamento, pedido] = await Promise.all([
      tx.orcamento.findFirst({ where: { id, companyId }, select: { id: true, status: true } }),
      tx.pedidoVenda.findFirst({
        where: { id: pedidoVendaId, companyId },
        include: { itens: { orderBy: { ordem: 'asc' } } },
      }),
    ])
    if (!orcamento || !pedido) return null
    if (orcamento.status !== 'em_aberto') return { bloqueado: true as const }
    await tx.orcamentoItem.deleteMany({ where: { orcamentoId: id } })
    await tx.orcamentoItem.createMany({
      data: pedido.itens.map((item) => ({
        orcamentoId: id,
        ordem: item.ordem,
        produtoId: item.produtoId,
        codigo: item.codigo,
        descricao: item.descricao,
        marca: item.marca,
        quantidade: item.quantidade,
        unidade: item.unidade,
        precoUnitario: item.precoUnitario,
        percentualDesconto: item.percentualDesconto,
        valorSt: 0,
      })),
    })
    const descontoTotal = pedido.itens.reduce((soma, item) => {
      const bruto = decimalNum(item.quantidade) * decimalNum(item.precoUnitario)
      return soma + bruto * (decimalNum(item.percentualDesconto) / 100)
    }, 0)
    await tx.orcamento.update({ where: { id }, data: { descontoTotal } })
    await tx.orcamentoHistorico.create({
      data: {
        orcamentoId: id,
        usuarioId,
        acao: 'copiar_pedido',
        descricao: `Itens copiados do pedido ${pedido.numero}`,
        dadosJson: { pedidoVendaId },
      },
    })
    const atualizado = await tx.orcamento.findUniqueOrThrow({
      where: { id },
      include: includeOrcamento,
    })
    return mapear(atualizado)
  })
}

async function finalizar(
  companyId: string,
  id: string,
  usuarioId?: string
) {
  return clientePrisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Orcamento" WHERE id = ${id} AND "companyId" = ${companyId} FOR UPDATE`
    const orcamento = await tx.orcamento.findFirst({
      where: { id, companyId },
      include: { itens: { orderBy: { ordem: 'asc' } }, pedidoVenda: true },
    })
    if (!orcamento) return null
    if (orcamento.status !== 'em_aberto') return { bloqueado: orcamento.status }
    if (!orcamento.clienteNome.trim() || orcamento.itens.length === 0) {
      return { incompleto: true as const }
    }
    if (orcamento.pedidoVenda) return { duplicado: true as const }
    const totalSt = orcamento.itens.reduce((soma, item) => soma + decimalNum(item.valorSt), 0)
    const itensParaTotal = orcamento.itens.map((item) => ({
      codigo: item.codigo,
      descricao: item.descricao,
      quantidade: decimalNum(item.quantidade),
      precoUnitario: decimalNum(item.precoUnitario),
      percentualDesconto: decimalNum(item.percentualDesconto),
      valorSt: decimalNum(item.valorSt),
    }))
    const total = totalDoOrcamento({
      valorFrete: decimalNum(orcamento.valorFrete),
      outrasDespesas: decimalNum(orcamento.outrasDespesas),
      itens: itensParaTotal,
    })
    const opcoes = await opcoesPagamentoOrcamento(companyId, tx)
    validarPagamentoOrcamento(orcamento, total, opcoes)
    const dataFechamento = dataCivilFechamento(new Date())
    const pedido = await tx.pedidoVenda.create({
      data: {
        companyId,
        orcamentoId: id,
        numero: `PV-${orcamento.numero.replace(/\D/g, '').padStart(6, '0')}`,
        data: dataFechamento,
        clienteCodigo: orcamento.clienteCodigo,
        clienteNome: orcamento.clienteNome,
        condicaoPagamento: orcamento.condicaoPagamento,
        parametroBoletoId: orcamento.condicaoPagamento === 'boleto' ? orcamento.parametroBoletoId : null,
        parametroBoletoNome: opcoes.boletos.find((b) => b.id === orcamento.parametroBoletoId)?.nome ?? null,
        prazosBoleto: orcamento.condicaoPagamento === 'boleto' ? orcamento.prazosBoleto : [],
        parcelasCredito: orcamento.condicaoPagamento === 'cartao_credito' ? orcamento.parcelasCredito : null,
        parcelasPagamento: orcamento.condicaoPagamento === 'boleto'
          ? parcelasBoletoNoFechamento(total, orcamento.prazosBoleto, dataFechamento) : Prisma.DbNull,
        descontoTotal: orcamento.descontoTotal,
        valorFrete: orcamento.valorFrete,
        outrasDespesas: orcamento.outrasDespesas,
        totalSt,
        total,
        itens: {
          create: orcamento.itens.map((item) => ({
            ordem: item.ordem,
            produtoId: item.produtoId,
            codigo: item.codigo,
            descricao: item.descricao,
            marca: item.marca,
            quantidade: item.quantidade,
            unidade: item.unidade,
            precoUnitario: item.precoUnitario,
            percentualDesconto: item.percentualDesconto,
            valorSt: item.valorSt,
            total: centavosLinha({
              codigo: item.codigo,
              descricao: item.descricao,
              quantidade: decimalNum(item.quantidade),
              precoUnitario: decimalNum(item.precoUnitario),
              percentualDesconto: decimalNum(item.percentualDesconto),
            }) / 100,
          })),
        },
      },
    })
    await tx.orcamento.update({ where: { id }, data: { status: 'convertido' } })
    await tx.orcamentoHistorico.create({
      data: {
        orcamentoId: id,
        usuarioId,
        acao: 'conversao',
        descricao: `Convertido no pedido ${pedido.numero}`,
        dadosJson: { pedidoVendaId: pedido.id },
      },
    })
    return mapear(
      await tx.orcamento.findUniqueOrThrow({ where: { id }, include: includeOrcamento })
    )
  })
}

async function listarAnexos(companyId: string, orcamentoId: string) {
  return clientePrisma.orcamentoAnexo.findMany({
    where: { companyId, orcamentoId },
    include: { usuario: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

async function criarAnexo(
  companyId: string,
  orcamentoId: string,
  usuarioId: string,
  dados: { nomeArquivo: string; mimeType: string; caminhoArquivo: string; tamanhoBytes: number }
) {
  const existe = await clientePrisma.orcamento.findFirst({
    where: { id: orcamentoId, companyId },
    select: { id: true },
  })
  if (!existe) return null
  return clientePrisma.orcamentoAnexo.create({
    data: { companyId, orcamentoId, usuarioId, ...dados },
    include: { usuario: { select: { id: true, name: true } } },
  })
}

async function buscarAnexo(companyId: string, orcamentoId: string, anexoId: string) {
  return clientePrisma.orcamentoAnexo.findFirst({
    where: { id: anexoId, companyId, orcamentoId },
  })
}

async function excluirAnexo(companyId: string, orcamentoId: string, anexoId: string) {
  const anexo = await buscarAnexo(companyId, orcamentoId, anexoId)
  if (!anexo) return null
  await clientePrisma.orcamentoAnexo.delete({ where: { id: anexoId } })
  return anexo
}

export const repositorioDeOrcamentos = {
  listar,
  buscarPorId,
  buscarParaRecebimento,
  listarRecebiveis,
  criar,
  atualizar,
  atualizarStatus,
  expirarVencidos,
  buscarProdutosParaValidacao,
  registrarHistorico,
  aplicarDesconto,
  copiarItensPedido,
  finalizar,
  listarAnexos,
  criarAnexo,
  buscarAnexo,
  excluirAnexo,
  proximoNumero,
}
