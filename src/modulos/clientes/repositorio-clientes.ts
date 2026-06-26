/**
 * Acesso ao banco de dados para clientes.
 * Trabalha sobre a entidade Pessoa com papel = 'cliente'.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import type { Prisma } from '@prisma/client'
import type { DadosParaCriarCliente, DadosParaEditarCliente, DadosParaAprovacaoDeCliente } from './esquema-clientes.js'
import { STATUS_APROVACAO } from './regras-cliente.js'
import { randomUUID } from 'node:crypto'
import { extrairContatosEEnderecos } from '../../compartilhado/pessoas/extrair-contatos-enderecos.js'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type PessoaComRelacoes = Prisma.PessoaGetPayload<{
  include: {
    papeis: { include: { dadosCliente: true } }
    contatos: true
    enderecos: true
    cnaes: true
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
    cnaes: pessoa.cnaes.map((c) => ({
      codigo: c.codigo,
      descricao: c.descricao,
      principal: c.principal,
    })),
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
    vendedorId: papelCliente.dadosCliente?.vendedorId ?? null,
    statusAprovacao: papelCliente.dadosCliente?.statusAprovacao ?? 'ativo',
    tipoCliente: papelCliente.dadosCliente?.tipoCliente ?? null,
    limiteCredito: papelCliente.dadosCliente?.limiteCredito
      ? Number(papelCliente.dadosCliente.limiteCredito)
      : null,
    condicaoPagamento: papelCliente.dadosCliente?.condicaoPagamento ?? null,
    motivoReprovacao: papelCliente.dadosCliente?.motivoReprovacao ?? null,
    aprovadoPorId: papelCliente.dadosCliente?.aprovadoPorId ?? null,
    aprovadoEm: papelCliente.dadosCliente?.aprovadoEm ?? null,
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
  cnaes: { orderBy: { principal: 'desc' as const } },
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
  cnaesArray?: { codigo: string; descricao?: string | null; principal?: boolean }[]
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
    cnaesArray: dados.cnaes,
  }

  const cnaePrincipal =
    dados.cnaes?.find((c) => c.principal)?.codigo ??
    dados.cnaes?.[0]?.codigo ??
    (dados.tipo === 'PJ' ? dados.cnae : null) ??
    null

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
    cnae: cnaePrincipal,
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
    dadosBancarios: true,
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

  if (!clienteView) {
    const contatosEnderecos = extrairContatosEEnderecos(pessoa)
    clienteView = {
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
      cnaes: [],
      dataFundacao: pessoa.dataFundacao,
      ie: pessoa.ie,
      im: pessoa.im,
      suframa: pessoa.suframa,
      simplesNacional: pessoa.simplesNacional,
      observacaoNF: pessoa.observacaoNF,
      indicadorIe: pessoa.indicadorIe,
      observacoes: pessoa.observacoes,
      companyId: pessoa.companyId,
      ...contatosEnderecos,
      aceitaNFe55: true,
      calculaComissao: false,
      vendedorId: null,
      statusAprovacao: 'ativo',
      tipoCliente: null,
      limiteCredito: null,
      condicaoPagamento: null,
      motivoReprovacao: null,
      aprovadoPorId: null,
      aprovadoEm: null,
      createdAt: pessoa.createdAt,
      updatedAt: pessoa.updatedAt,
    } as unknown as ClienteView
  }

  return {
    encontrado: true,
    temPapelCliente,
    papeis,
    pessoa: clienteView,
  }
}

function dadosDaPessoaDeCampos(campos: CamposNormalizados) {
  return {
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
  }
}

async function criar(dados: DadosParaCriarCliente, companyId: string) {
  const campos = normalizarDocumento(dados)
  const documento = campos.tipo === 'PF' ? campos.cpf : campos.cnpj
  const msgDuplicado =
    campos.tipo === 'PF'
      ? 'CPF já cadastrado como cliente nesta empresa'
      : 'CNPJ já cadastrado como cliente nesta empresa'

  return clientePrisma.$transaction(async (tx) => {
    const pessoaExistente = documento
      ? await tx.pessoa.findFirst({
          where: {
            companyId,
            ...(campos.tipo === 'PF' ? { cpf: documento } : { cnpj: documento }),
          },
        })
      : null

    let pessoaId: string

    if (pessoaExistente) {
      pessoaId = pessoaExistente.id

      const papelExistente = await tx.pessoaPapel.findFirst({
        where: { pessoaId, papel: 'cliente' },
      })

      if (papelExistente?.ativo) {
        throw new ErroDaAplicacao(msgDuplicado, 400)
      }

      await tx.pessoa.update({
        where: { id: pessoaId },
        data: dadosDaPessoaDeCampos(campos),
      })

      if (papelExistente) {
        await tx.pessoaPapel.update({
          where: { id: papelExistente.id },
          data: { ativo: true },
        })
        await tx.dadosCliente.upsert({
          where: { papelId: papelExistente.id },
          update: { aceitaNFe55: campos.aceitaNFe55, statusAprovacao: STATUS_APROVACAO.PENDENTE },
          create: {
            papelId: papelExistente.id,
            aceitaNFe55: campos.aceitaNFe55,
            calculaComissao: false,
            statusAprovacao: STATUS_APROVACAO.PENDENTE,
          },
        })
      } else {
        const papel = await tx.pessoaPapel.create({
          data: { pessoaId, papel: 'cliente', ativo: true },
        })
        await tx.dadosCliente.create({
          data: {
            papelId: papel.id,
            aceitaNFe55: campos.aceitaNFe55,
            calculaComissao: false,
            statusAprovacao: STATUS_APROVACAO.PENDENTE,
          },
        })
      }

      await tx.pessoaContato.deleteMany({ where: { pessoaId } })
      await criarContatos(tx, pessoaId, campos)

      if (campos.enderecosArray && campos.enderecosArray.length > 0) {
        await tx.pessoaEndereco.deleteMany({ where: { pessoaId } })
      } else {
        await tx.pessoaEndereco.deleteMany({ where: { pessoaId, tipo: 'principal' } })
      }
      await criarEnderecos(tx, pessoaId, campos)
      await sincronizarCnaes(tx, pessoaId, campos)
    } else {
      const pessoa = await tx.pessoa.create({
        data: { ...dadosDaPessoaDeCampos(campos), companyId },
      })
      pessoaId = pessoa.id

      const papel = await tx.pessoaPapel.create({
        data: { pessoaId, papel: 'cliente', ativo: true },
      })

      await tx.dadosCliente.create({
        data: {
          papelId: papel.id,
          aceitaNFe55: campos.aceitaNFe55,
          calculaComissao: false,
          statusAprovacao: STATUS_APROVACAO.PENDENTE,
        },
      })

      await criarContatos(tx, pessoaId, campos)
      await criarEnderecos(tx, pessoaId, campos)
      await criarCnaes(tx, pessoaId, campos)
    }

    const pessoaCompleta = await tx.pessoa.findUniqueOrThrow({
      where: { id: pessoaId },
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
      const dadosAtuais = await tx.dadosCliente.findUnique({
        where: { papelId: papelCliente.id },
      })

      await tx.dadosCliente.upsert({
        where: { papelId: papelCliente.id },
        update: {
          aceitaNFe55: campos.aceitaNFe55,
          ...(dadosAtuais?.statusAprovacao === STATUS_APROVACAO.REPROVADO
            ? {
                statusAprovacao: STATUS_APROVACAO.PENDENTE,
                motivoReprovacao: null,
              }
            : {}),
        },
        create: {
          papelId: papelCliente.id,
          aceitaNFe55: campos.aceitaNFe55,
          calculaComissao: false,
          statusAprovacao: STATUS_APROVACAO.PENDENTE,
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
    await sincronizarCnaes(tx, id, campos)

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

async function criarCnaes(tx: TxCliente, pessoaId: string, campos: CamposNormalizados) {
  if (!campos.cnaesArray?.length) return
  for (const cnae of campos.cnaesArray) {
    await tx.pessoaCnae.create({
      data: {
        pessoaId,
        codigo: cnae.codigo,
        descricao: cnae.descricao,
        principal: cnae.principal ?? false,
      },
    })
  }
}

async function sincronizarCnaes(tx: TxCliente, pessoaId: string, campos: CamposNormalizados) {
  await tx.pessoaCnae.deleteMany({ where: { pessoaId } })
  await criarCnaes(tx, pessoaId, campos)
}

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

async function listarPendentes(companyId: string) {
  const pessoas = await clientePrisma.pessoa.findMany({
    where: {
      companyId,
      papeis: {
        some: {
          papel: 'cliente',
          dadosCliente: { statusAprovacao: STATUS_APROVACAO.PENDENTE },
        },
      },
    },
    include: INCLUDE_COMPLETO,
    orderBy: { createdAt: 'asc' },
  })
  return pessoas.map(mapearParaClienteView)
}

async function listarAguardandoAssinatura(companyId: string) {
  const pessoas = await clientePrisma.pessoa.findMany({
    where: {
      companyId,
      papeis: {
        some: {
          papel: 'cliente',
          dadosCliente: { statusAprovacao: STATUS_APROVACAO.AGUARDANDO_ASSINATURA },
        },
      },
    },
    include: {
      ...INCLUDE_COMPLETO,
      papeis: {
        where: { papel: 'cliente' },
        include: {
          dadosCliente: {
            include: { assinaturas: { orderBy: { createdAt: 'desc' }, take: 1 } },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return pessoas.map((p) => {
    const papelCliente = p.papeis[0]
    const assinatura = papelCliente?.dadosCliente?.assinaturas?.[0] ?? null
    const emailPrincipal =
      p.contatos.find((c) => c.tipo === 'email' && c.principal) ??
      p.contatos.find((c) => c.tipo === 'email')

    return {
      id: p.id,
      nome: p.nome,
      tipo: p.tipo as 'PF' | 'PJ',
      cpf: p.cpf,
      cnpj: p.cnpj,
      email: emailPrincipal?.valor ?? null,
      statusAprovacao: papelCliente?.dadosCliente?.statusAprovacao ?? 'aguardando_assinatura',
      tokenAssinaturaInterno: assinatura?.token ?? null,
    }
  })
}

async function aprovar(
  id: string,
  dados: Extract<DadosParaAprovacaoDeCliente, { acao: 'aprovar' }>,
  aprovadoPorId: string
) {
  const pessoa = await clientePrisma.pessoa.findUnique({
    where: { id },
    include: INCLUDE_COMPLETO,
  })

  if (!pessoa || !pessoa.papeis.length) {
    throw new ErroDaAplicacao('Cliente não encontrado', 404)
  }

  const papelCliente = pessoa.papeis[0]
  const dadosCliente = papelCliente.dadosCliente

  if (!dadosCliente || dadosCliente.statusAprovacao !== STATUS_APROVACAO.PENDENTE) {
    throw new ErroDaAplicacao('Cliente não está pendente de aprovação', 400)
  }

  const token = randomUUID()
  const expiraEm = new Date()
  expiraEm.setDate(expiraEm.getDate() + 30)

  const emailDestino =
    pessoa.contatos.find((c) => c.tipo === 'email' && c.principal)?.valor ??
    pessoa.contatos.find((c) => c.tipo === 'email')?.valor ??
    null

  await clientePrisma.$transaction(async (tx) => {
    await tx.dadosCliente.update({
      where: { id: dadosCliente.id },
      data: {
        statusAprovacao: STATUS_APROVACAO.AGUARDANDO_ASSINATURA,
        tipoCliente: dados.tipoCliente,
        limiteCredito: dados.limiteCredito,
        condicaoPagamento: dados.condicaoPagamento,
        vendedorId: dados.vendedorId || null,
        calculaComissao: dados.calculaComissao,
        motivoReprovacao: null,
        aprovadoPorId,
        aprovadoEm: new Date(),
      },
    })

    await tx.clienteAssinatura.create({
      data: {
        dadosClienteId: dadosCliente.id,
        token,
        status: 'pendente',
        destinatario: emailDestino,
        enviadoEm: new Date(),
        expiraEm,
      },
    })
  })

  const atualizado = await buscarPorId(id)
  return { cliente: atualizado!, tokenAssinatura: token }
}

async function reprovar(
  id: string,
  motivoReprovacao: string,
  aprovadoPorId: string
) {
  const pessoa = await clientePrisma.pessoa.findUnique({
    where: { id },
    include: INCLUDE_COMPLETO,
  })

  if (!pessoa || !pessoa.papeis.length) {
    throw new ErroDaAplicacao('Cliente não encontrado', 404)
  }

  const dadosCliente = pessoa.papeis[0].dadosCliente

  if (!dadosCliente || dadosCliente.statusAprovacao !== STATUS_APROVACAO.PENDENTE) {
    throw new ErroDaAplicacao('Cliente não está pendente de aprovação', 400)
  }

  await clientePrisma.dadosCliente.update({
    where: { id: dadosCliente.id },
    data: {
      statusAprovacao: STATUS_APROVACAO.REPROVADO,
      motivoReprovacao,
      aprovadoPorId,
      aprovadoEm: new Date(),
    },
  })

  return buscarPorId(id)
}

async function buscarAssinaturaPorToken(token: string) {
  const assinatura = await clientePrisma.clienteAssinatura.findUnique({
    where: { token },
    include: {
      dadosCliente: {
        include: {
          papel: {
            include: {
              pessoa: {
                include: {
                  contatos: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!assinatura) return null

  if (assinatura.expiraEm && assinatura.expiraEm < new Date() && assinatura.status !== 'assinado') {
    await clientePrisma.clienteAssinatura.update({
      where: { id: assinatura.id },
      data: { status: 'expirado' },
    })
    return { ...assinatura, status: 'expirado' }
  }

  if (assinatura.status === 'pendente' && !assinatura.visualizadoEm) {
    await clientePrisma.clienteAssinatura.update({
      where: { id: assinatura.id },
      data: { visualizadoEm: new Date(), status: 'visualizado' },
    })
  }

  const pessoa = assinatura.dadosCliente.papel.pessoa

  return {
    token: assinatura.token,
    status: assinatura.status,
    expiraEm: assinatura.expiraEm,
    assinadoEm: assinatura.assinadoEm,
    cliente: {
      nome: pessoa.nome,
      tipo: pessoa.tipo,
      cpf: pessoa.cpf,
      cnpj: pessoa.cnpj,
    },
  }
}

async function confirmarAssinatura(
  token: string,
  nomeAssinante: string,
  ipAssinante?: string
) {
  const assinatura = await clientePrisma.clienteAssinatura.findUnique({
    where: { token },
    include: { dadosCliente: true },
  })

  if (!assinatura) {
    throw new ErroDaAplicacao('Link de assinatura inválido', 404)
  }

  if (assinatura.status === 'assinado') {
    throw new ErroDaAplicacao('Este cadastro já foi assinado', 400)
  }

  if (assinatura.expiraEm && assinatura.expiraEm < new Date()) {
    throw new ErroDaAplicacao('Link de assinatura expirado', 400)
  }

  if (assinatura.dadosCliente.statusAprovacao !== STATUS_APROVACAO.AGUARDANDO_ASSINATURA) {
    throw new ErroDaAplicacao('Cadastro não está aguardando assinatura', 400)
  }

  await clientePrisma.$transaction(async (tx) => {
    await tx.clienteAssinatura.update({
      where: { id: assinatura.id },
      data: {
        status: 'assinado',
        assinadoEm: new Date(),
        nomeAssinante,
        ipAssinante: ipAssinante ?? null,
      },
    })

    await tx.dadosCliente.update({
      where: { id: assinatura.dadosClienteId },
      data: { statusAprovacao: STATUS_APROVACAO.ATIVO },
    })
  })

  return buscarAssinaturaPorToken(token)
}

export const repositorioDeClientes = {
  listarPorEmpresa,
  listarPendentes,
  listarAguardandoAssinatura,
  buscarPorId,
  buscarPorCpfNaEmpresa,
  buscarPorCnpjNaEmpresa,
  buscarPessoaPorDocumentoNaEmpresa,
  criar,
  atualizar,
  alterarStatus,
  aprovar,
  reprovar,
  buscarAssinaturaPorToken,
  confirmarAssinatura,
}
