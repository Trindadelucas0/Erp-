/**
 * Acesso ao banco de dados para clientes.
 * Trabalha sobre a entidade Pessoa com papel = 'cliente'.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { Prisma } from '@prisma/client'
import type { DadosParaCriarCliente, DadosParaEditarCliente } from './esquema-clientes.js'

// ─── Tipos internos ───────────────────────────────────────────────────────────

type PessoaComRelacoes = Prisma.PessoaGetPayload<{
  include: {
    papeis: { include: { dadosCliente: true } }
    contatos: true
    enderecos: true
  }
}>

export type ClienteView = ReturnType<typeof mapearParaClienteView>

// ─── Mapeador: Pessoa → visão achatada de Cliente ────────────────────────────

function mapearParaClienteView(pessoa: PessoaComRelacoes) {
  const papelCliente = pessoa.papeis.find((p) => p.papel === 'cliente')!
  const emailPrincipal =
    pessoa.contatos.find((c) => c.tipo === 'email' && c.principal) ??
    pessoa.contatos.find((c) => c.tipo === 'email')
  const telefonePrincipal =
    pessoa.contatos.find((c) => c.tipo === 'telefone' && c.principal) ??
    pessoa.contatos.find((c) => c.tipo === 'telefone')
  const celular = pessoa.contatos.find(
    (c) => c.tipo === 'telefone' && !c.principal && c.valor !== telefonePrincipal?.valor
  )
  const enderecoPrincipal =
    pessoa.enderecos.find((e) => e.tipo === 'principal') ?? pessoa.enderecos[0]

  return {
    id: pessoa.id,
    papelId: papelCliente.id,
    tipo: pessoa.tipo,
    ativo: papelCliente.ativo,
    nome: pessoa.nome,
    cpf: pessoa.cpf,
    rg: pessoa.rg,
    dataNascimento: pessoa.dataNascimento,
    cnpj: pessoa.cnpj,
    nomeFantasia: pessoa.nomeFantasia,
    cnae: pessoa.cnae,
    dataFundacao: pessoa.dataFundacao,
    ie: pessoa.ie,
    im: pessoa.im,
    suframa: pessoa.suframa,
    simplesNacional: pessoa.simplesNacional,
    observacaoNF: pessoa.observacaoNF,
    indicadorIe: pessoa.indicadorIe,
    observacoes: pessoa.observacoes,
    companyId: pessoa.companyId,
    // Contatos achatados (compatibilidade com frontend atual)
    email: emailPrincipal?.valor ?? null,
    telefone: telefonePrincipal?.valor ?? null,
    celular: celular?.valor ?? null,
    // Endereço achatado
    cep: enderecoPrincipal?.cep ?? null,
    logradouro: enderecoPrincipal?.logradouro ?? null,
    numero: enderecoPrincipal?.numero ?? null,
    complemento: enderecoPrincipal?.complemento ?? null,
    bairro: enderecoPrincipal?.bairro ?? null,
    cidade: enderecoPrincipal?.cidade ?? null,
    estado: enderecoPrincipal?.estado ?? null,
    codigoIbge: enderecoPrincipal?.codigoIbge ?? null,
    // DadosCliente
    aceitaNFe55: papelCliente.dadosCliente?.aceitaNFe55 ?? true,
    calculaComissao: papelCliente.dadosCliente?.calculaComissao ?? false,
    statusAprovacao: papelCliente.dadosCliente?.statusAprovacao ?? 'ativo',
    // Listas completas para uso futuro
    contatos: pessoa.contatos,
    enderecos: pessoa.enderecos,
    createdAt: pessoa.createdAt,
    updatedAt: pessoa.updatedAt,
  }
}

// ─── Opções de include reutilizáveis ─────────────────────────────────────────

const INCLUDE_COMPLETO = {
  papeis: {
    where: { papel: 'cliente' },
    include: { dadosCliente: true },
  },
  contatos: true,
  enderecos: true,
} as const

// ─── Helpers de normalização ──────────────────────────────────────────────────

function limparNumeros(v?: string | null): string | null {
  return v ? v.replace(/\D/g, '') : null
}

type CamposNormalizados = {
  tipo: string
  nome: string
  indicadorIe: string
  observacoes: string | null
  cpf: string | null
  rg: string | null
  dataNascimento: string | null
  cnpj: string | null
  nomeFantasia: string | null
  ie: string | null
  im: string | null
  suframa: string | null
  email: string | null
  telefone: string | null
  celular: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  codigoIbge: string | null
}

function normalizarDocumento(dados: DadosParaCriarCliente | DadosParaEditarCliente): CamposNormalizados {
  const base = {
    tipo: dados.tipo,
    nome: dados.nome,
    indicadorIe: dados.indicadorIe ?? '9',
    observacoes: dados.observacoes || null,
    email: dados.email || null,
    telefone: dados.telefone ? limparNumeros(dados.telefone) : null,
    celular: dados.celular ? limparNumeros(dados.celular) : null,
    cep: dados.cep ? limparNumeros(dados.cep) : null,
    logradouro: dados.logradouro || null,
    numero: dados.numero || null,
    complemento: dados.complemento || null,
    bairro: dados.bairro || null,
    cidade: dados.cidade || null,
    estado: dados.estado || null,
    codigoIbge: dados.codigoIbge || null,
  }

  if (dados.tipo === 'PF') {
    return {
      ...base,
      cpf: limparNumeros(dados.cpf),
      rg: dados.rg || null,
      dataNascimento: dados.dataNascimento || null,
      cnpj: null,
      nomeFantasia: null,
      ie: null,
      im: null,
      suframa: null,
    }
  }

  return {
    ...base,
    cnpj: limparNumeros(dados.cnpj),
    nomeFantasia: dados.nomeFantasia || null,
    ie: dados.ie || null,
    im: dados.im || null,
    suframa: dados.suframa || null,
    cpf: null,
    rg: null,
    dataNascimento: null,
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

async function listarPorEmpresa(companyId: string) {
  const pessoas = await clientePrisma.pessoa.findMany({
    where: {
      companyId,
      papeis: { some: { papel: 'cliente' } },
    },
    include: INCLUDE_COMPLETO,
    orderBy: { nome: 'asc' },
  })
  return pessoas.map(mapearParaClienteView)
}

async function buscarPorId(id: string) {
  const pessoa = await clientePrisma.pessoa.findUnique({
    where: { id },
    include: INCLUDE_COMPLETO,
  })
  if (!pessoa || !pessoa.papeis.length) return null
  return mapearParaClienteView(pessoa)
}

async function buscarPorCpfNaEmpresa(cpf: string, companyId: string) {
  const cpfLimpo = cpf.replace(/\D/g, '')
  const pessoa = await clientePrisma.pessoa.findFirst({
    where: {
      cpf: cpfLimpo,
      companyId,
      papeis: { some: { papel: 'cliente' } },
    },
    include: INCLUDE_COMPLETO,
  })
  if (!pessoa) return null
  return mapearParaClienteView(pessoa)
}

async function buscarPorCnpjNaEmpresa(cnpj: string, companyId: string) {
  const cnpjLimpo = cnpj.replace(/\D/g, '')
  const pessoa = await clientePrisma.pessoa.findFirst({
    where: {
      cnpj: cnpjLimpo,
      companyId,
      papeis: { some: { papel: 'cliente' } },
    },
    include: INCLUDE_COMPLETO,
  })
  if (!pessoa) return null
  return mapearParaClienteView(pessoa)
}

async function criar(dados: DadosParaCriarCliente, companyId: string) {
  const campos = normalizarDocumento(dados)

  return clientePrisma.$transaction(async (tx) => {
    const pessoa = await tx.pessoa.create({
      data: {
        tipo: campos.tipo,
        nome: campos.nome,
        cpf: campos.cpf,
        rg: campos.rg,
        dataNascimento: campos.dataNascimento,
        cnpj: campos.cnpj,
        nomeFantasia: campos.nomeFantasia,
        ie: campos.ie,
        im: campos.im,
        suframa: campos.suframa,
        indicadorIe: campos.indicadorIe,
        observacoes: campos.observacoes,
        companyId,
      },
    })

    const papel = await tx.pessoaPapel.create({
      data: {
        pessoaId: pessoa.id,
        papel: 'cliente',
        ativo: true,
      },
    })

    await tx.dadosCliente.create({
      data: {
        papelId: papel.id,
        aceitaNFe55: true,
        calculaComissao: false,
        statusAprovacao: 'ativo',
      },
    })

    await criarContatos(tx, pessoa.id, campos)
    await criarEndereco(tx, pessoa.id, campos)

    const pessoaCompleta = await tx.pessoa.findUniqueOrThrow({
      where: { id: pessoa.id },
      include: INCLUDE_COMPLETO,
    })

    return mapearParaClienteView(pessoaCompleta)
  })
}

async function atualizar(id: string, dados: DadosParaEditarCliente) {
  const campos = normalizarDocumento(dados)

  return clientePrisma.$transaction(async (tx) => {
    await tx.pessoa.update({
      where: { id },
      data: {
        tipo: campos.tipo,
        nome: campos.nome,
        cpf: campos.cpf,
        rg: campos.rg,
        dataNascimento: campos.dataNascimento,
        cnpj: campos.cnpj,
        nomeFantasia: campos.nomeFantasia,
        ie: campos.ie,
        im: campos.im,
        suframa: campos.suframa,
        indicadorIe: campos.indicadorIe,
        observacoes: campos.observacoes,
      },
    })

    // Recriar contatos
    await tx.pessoaContato.deleteMany({ where: { pessoaId: id } })
    await criarContatos(tx, id, campos)

    // Recriar endereço principal
    await tx.pessoaEndereco.deleteMany({ where: { pessoaId: id, tipo: 'principal' } })
    await criarEndereco(tx, id, campos)

    const pessoaCompleta = await tx.pessoa.findUniqueOrThrow({
      where: { id },
      include: INCLUDE_COMPLETO,
    })

    return mapearParaClienteView(pessoaCompleta)
  })
}

async function alterarStatus(id: string, ativo: boolean) {
  await clientePrisma.pessoaPapel.updateMany({
    where: { pessoaId: id, papel: 'cliente' },
    data: { ativo },
  })

  const pessoa = await clientePrisma.pessoa.findUniqueOrThrow({
    where: { id },
    include: INCLUDE_COMPLETO,
  })

  return mapearParaClienteView(pessoa)
}

// ─── Helpers de criação de relações ──────────────────────────────────────────

type TxCliente = Parameters<Parameters<typeof clientePrisma.$transaction>[0]>[0]

async function criarContatos(tx: TxCliente, pessoaId: string, campos: CamposNormalizados) {
  if (campos.email) {
    await tx.pessoaContato.create({
      data: { pessoaId, tipo: 'email', valor: campos.email, principal: true },
    })
  }
  if (campos.telefone) {
    await tx.pessoaContato.create({
      data: { pessoaId, tipo: 'telefone', valor: campos.telefone, principal: true },
    })
  }
  if (campos.celular && campos.celular !== campos.telefone) {
    await tx.pessoaContato.create({
      data: { pessoaId, tipo: 'telefone', valor: campos.celular, principal: false, whatsapp: false },
    })
  }
}

async function criarEndereco(tx: TxCliente, pessoaId: string, campos: CamposNormalizados) {
  if (campos.cep || campos.logradouro) {
    await tx.pessoaEndereco.create({
      data: {
        pessoaId,
        tipo: 'principal',
        cep: campos.cep,
        logradouro: campos.logradouro,
        numero: campos.numero,
        complemento: campos.complemento,
        bairro: campos.bairro,
        cidade: campos.cidade,
        estado: campos.estado,
        codigoIbge: campos.codigoIbge,
      },
    })
  }
}

// ─── Exportação ───────────────────────────────────────────────────────────────

export const repositorioDeClientes = {
  listarPorEmpresa,
  buscarPorId,
  buscarPorCpfNaEmpresa,
  buscarPorCnpjNaEmpresa,
  criar,
  atualizar,
  alterarStatus,
}
