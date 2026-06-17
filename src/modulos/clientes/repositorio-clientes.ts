/**
 * Acesso ao banco de dados para clientes.
 * Trabalha sobre a entidade Pessoa com papel = 'cliente'.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { Prisma } from '@prisma/client'
import type { DadosParaCriarCliente, DadosParaEditarCliente } from './esquema-clientes.js'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type PessoaComRelacoes = Prisma.PessoaGetPayload<{
  include: {
    papeis: { include: { dadosCliente: true } }
    contatos: true
    enderecos: true
  }
}>

export type ClienteView = ReturnType<typeof mapearParaClienteView>

export type ResultadoBuscaPorDocumento = {
  encontrado: boolean
  temPapelCliente: boolean
  papeis: string[]
  pessoa: ClienteView | null
}

// ─── Mapeador ────────────────────────────────────────────────────────────────

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
    email: emailPrincipal?.valor ?? null,
    telefone: telefonePrincipal?.valor ?? null,
    celular: celular?.valor ?? null,
    celularWhatsapp: celular?.whatsapp ?? false,
    cep: enderecoPrincipal?.cep ?? null,
    logradouro: enderecoPrincipal?.logradouro ?? null,
    numero: enderecoPrincipal?.numero ?? null,
    complemento: enderecoPrincipal?.complemento ?? null,
    bairro: enderecoPrincipal?.bairro ?? null,
    cidade: enderecoPrincipal?.cidade ?? null,
    estado: enderecoPrincipal?.estado ?? null,
    codigoIbge: enderecoPrincipal?.codigoIbge ?? null,
    aceitaNFe55: papelCliente.dadosCliente?.aceitaNFe55 ?? true,
    calculaComissao: papelCliente.dadosCliente?.calculaComissao ?? false,
    statusAprovacao: papelCliente.dadosCliente?.statusAprovacao ?? 'ativo',
    contatos: pessoa.contatos,
    enderecos: pessoa.enderecos,
    createdAt: pessoa.createdAt,
    updatedAt: pessoa.updatedAt,
  }
}

// ─── Include reutilizável ─────────────────────────────────────────────────────

const INCLUDE_COMPLETO = {
  papeis: {
    where: { papel: 'cliente' },
    include: { dadosCliente: true },
  },
  contatos: true,
  enderecos: true,
} as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function limparNumeros(v?: string | null): string | null {
  return v ? v.replace(/\D/g, '') : null
}

type ContatoItem = {
  tipo: string
  valor: string
  descricao?: string | null
  whatsapp?: boolean
  principal?: boolean
}

type EnderecoItem = {
  tipo: string
  apelido?: string | null
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  codigoIbge?: string | null
}

type CamposNormalizados = {
  tipo: string
  nome: string
  indicadorIe: string
  observacoes: string | null
  cpf: string | null
  rg: string | null
  dataNascimento: string | null
  aceitaNFe55: boolean
  cnpj: string | null
  nomeFantasia: string | null
  cnae: string | null
  dataFundacao: string | null
  ie: string | null
  im: string | null
  suframa: string | null
  simplesNacional: boolean
  observacaoNF: string | null
  // Campos achatados para compatibilidade com tabela e CSV
  email: string | null
  telefone: string | null
  celular: string | null
  celularWhatsapp: boolean
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  codigoIbge: string | null
  // Arrays dinâmicos (opcional; se ausentes, campos achatados são usados)
  contatosArray?: ContatoItem[]
  enderecosArray?: EnderecoItem[]
}

function normalizarDocumento(dados: DadosParaCriarCliente | DadosParaEditarCliente): CamposNormalizados {
  const base = {
    tipo: dados.tipo,
    nome: dados.nome,
    indicadorIe: dados.indicadorIe ?? '9',
    observacoes: dados.observacoes || null,
    aceitaNFe55: dados.aceitaNFe55 ?? true,
    email: dados.email || null,
    telefone: dados.telefone ? limparNumeros(dados.telefone) : null,
    celular: dados.celular ? limparNumeros(dados.celular) : null,
    celularWhatsapp: dados.celularWhatsapp ?? false,
    cep: dados.cep ? limparNumeros(dados.cep) : null,
    logradouro: dados.logradouro || null,
    numero: dados.numero || null,
    complemento: dados.complemento || null,
    bairro: dados.bairro || null,
    cidade: dados.cidade || null,
    estado: dados.estado || null,
    codigoIbge: dados.codigoIbge || null,
    contatosArray: dados.contatos,
    enderecosArray: dados.enderecos,
  }

  if (dados.tipo === 'PF') {
    return {
      ...base,
      cpf: limparNumeros(dados.cpf),
      rg: dados.rg || null,
      dataNascimento: dados.dataNascimento || null,
      cnpj: null,
      nomeFantasia: null,
      cnae: null,
      dataFundacao: null,
      ie: null,
      im: null,
      suframa: null,
      simplesNacional: false,
      observacaoNF: null,
    }
  }

  return {
    ...base,
    cnpj: limparNumeros(dados.cnpj),
    nomeFantasia: dados.nomeFantasia || null,
    cnae: dados.cnae || null,
    dataFundacao: dados.dataFundacao || null,
    ie: dados.ie || null,
    im: dados.im || null,
    suframa: dados.suframa || null,
    simplesNacional: dados.simplesNacional ?? false,
    observacaoNF: dados.observacaoNF || null,
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
  return pessoa ? mapearParaClienteView(pessoa) : null
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
  return pessoa ? mapearParaClienteView(pessoa) : null
}

/**
 * Busca Pessoa por CPF ou CNPJ na empresa, independente de papel.
 * Usada para verificação de duplicidade inteligente.
 */
async function buscarPessoaPorDocumentoNaEmpresa(
  documento: string,
  companyId: string
): Promise<ResultadoBuscaPorDocumento> {
  const nums = documento.replace(/\D/g, '')
  const ehCpf = nums.length === 11
  const ehCnpj = nums.length === 14

  if (!ehCpf && !ehCnpj) {
    return { encontrado: false, temPapelCliente: false, papeis: [], pessoa: null }
  }

  const include = {
    papeis: { include: { dadosCliente: true } },
    contatos: true,
    enderecos: true,
  }

  const pessoa = await clientePrisma.pessoa.findFirst({
    where: {
      companyId,
      ...(ehCpf ? { cpf: nums } : { cnpj: nums }),
    },
    include,
  })

  if (!pessoa) {
    return { encontrado: false, temPapelCliente: false, papeis: [], pessoa: null }
  }

  const papeis = pessoa.papeis.map((p) => p.papel)
  const temPapelCliente = papeis.includes('cliente')

  // Se tem papel cliente, montar a view completa
  const papelClienteObj = pessoa.papeis.find((p) => p.papel === 'cliente')
  let clienteView: ClienteView | null = null

  if (papelClienteObj) {
    const pessoaCompleta = await clientePrisma.pessoa.findUniqueOrThrow({
      where: { id: pessoa.id },
      include: INCLUDE_COMPLETO,
    })
    clienteView = mapearParaClienteView(pessoaCompleta)
  }

  return {
    encontrado: true,
    temPapelCliente,
    papeis,
    pessoa: clienteView ?? ({
      id: pessoa.id,
      papelId: '',
      tipo: pessoa.tipo,
      ativo: true,
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
      email: null,
      telefone: null,
      celular: null,
      celularWhatsapp: false,
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      estado: null,
      codigoIbge: null,
      aceitaNFe55: true,
      calculaComissao: false,
      statusAprovacao: 'ativo',
      contatos: [],
      enderecos: [],
      createdAt: pessoa.createdAt,
      updatedAt: pessoa.updatedAt,
    } as ClienteView),
  }
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
        cnae: campos.cnae,
        dataFundacao: campos.dataFundacao,
        ie: campos.ie,
        im: campos.im,
        suframa: campos.suframa,
        simplesNacional: campos.simplesNacional,
        observacaoNF: campos.observacaoNF,
        indicadorIe: campos.indicadorIe,
        observacoes: campos.observacoes,
        companyId,
      },
    })

    const papel = await tx.pessoaPapel.create({
      data: { pessoaId: pessoa.id, papel: 'cliente', ativo: true },
    })

    await tx.dadosCliente.create({
      data: {
        papelId: papel.id,
        aceitaNFe55: campos.aceitaNFe55,
        calculaComissao: false,
        statusAprovacao: 'ativo',
      },
    })

    await criarContatos(tx, pessoa.id, campos)
    await criarEnderecos(tx, pessoa.id, campos)

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
        cnae: campos.cnae,
        dataFundacao: campos.dataFundacao,
        ie: campos.ie,
        im: campos.im,
        suframa: campos.suframa,
        simplesNacional: campos.simplesNacional,
        observacaoNF: campos.observacaoNF,
        indicadorIe: campos.indicadorIe,
        observacoes: campos.observacoes,
      },
    })

    // Atualizar DadosCliente — upsert garante que exista mesmo se não foi criado antes
    const papelCliente = await tx.pessoaPapel.findFirst({
      where: { pessoaId: id, papel: 'cliente' },
    })

    if (papelCliente) {
      await tx.dadosCliente.upsert({
        where: { papelId: papelCliente.id },
        update: { aceitaNFe55: campos.aceitaNFe55 },
        create: {
          papelId: papelCliente.id,
          aceitaNFe55: campos.aceitaNFe55,
          calculaComissao: false,
          statusAprovacao: 'ativo',
        },
      })
    }

    await tx.pessoaContato.deleteMany({ where: { pessoaId: id } })
    await criarContatos(tx, id, campos)

    // Se veio array de endereços, recria tudo; caso contrário, só o principal
    if (campos.enderecosArray && campos.enderecosArray.length > 0) {
      await tx.pessoaEndereco.deleteMany({ where: { pessoaId: id } })
    } else {
      await tx.pessoaEndereco.deleteMany({ where: { pessoaId: id, tipo: 'principal' } })
    }
    await criarEnderecos(tx, id, campos)

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

// ─── Helpers de relações ──────────────────────────────────────────────────────

type TxCliente = Parameters<Parameters<typeof clientePrisma.$transaction>[0]>[0]

async function criarContatos(tx: TxCliente, pessoaId: string, campos: CamposNormalizados) {
  // Se há array dinâmico de contatos, usa-o diretamente
  if (campos.contatosArray && campos.contatosArray.length > 0) {
    for (const contato of campos.contatosArray) {
      await tx.pessoaContato.create({
        data: {
          pessoaId,
          tipo: contato.tipo,
          valor: contato.valor,
          descricao: contato.descricao,
          whatsapp: contato.whatsapp ?? false,
          principal: contato.principal ?? false,
        },
      })
    }
    return
  }

  // Fallback: campos achatados legados
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
      data: {
        pessoaId,
        tipo: 'telefone',
        valor: campos.celular,
        principal: false,
        whatsapp: campos.celularWhatsapp,
      },
    })
  }
}

async function criarEnderecos(tx: TxCliente, pessoaId: string, campos: CamposNormalizados) {
  // Se há array dinâmico de endereços, usa-o diretamente
  if (campos.enderecosArray && campos.enderecosArray.length > 0) {
    for (const end of campos.enderecosArray) {
      await tx.pessoaEndereco.create({
        data: {
          pessoaId,
          tipo: end.tipo,
          apelido: end.apelido,
          cep: end.cep ? end.cep.replace(/\D/g, '') : null,
          logradouro: end.logradouro,
          numero: end.numero,
          complemento: end.complemento,
          bairro: end.bairro,
          cidade: end.cidade,
          estado: end.estado,
          codigoIbge: end.codigoIbge,
        },
      })
    }
    return
  }

  // Fallback: campos achatados legados
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

export const repositorioDeClientes = {
  listarPorEmpresa,
  buscarPorId,
  buscarPorCpfNaEmpresa,
  buscarPorCnpjNaEmpresa,
  buscarPessoaPorDocumentoNaEmpresa,
  criar,
  atualizar,
  alterarStatus,
}
