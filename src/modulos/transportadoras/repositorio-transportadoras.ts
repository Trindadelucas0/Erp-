/**
 * Acesso ao banco de dados para transportadoras.
 * Trabalha sobre a entidade Pessoa com papel = 'transportadora'.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import type { Prisma } from '@prisma/client'
import type { DadosParaCriarTransportadora, DadosParaEditarTransportadora } from './esquema-transportadoras.js'
import { extrairContatosEEnderecos } from '../../compartilhado/pessoas/extrair-contatos-enderecos.js'
import { normalizarIe, resolverIndicadorIe } from '../../compartilhado/validacoes/inscricao-estadual.js'
import {
  classificarDocumento,
  normalizarCnpj,
  normalizarCpf,
  normalizarDocumento,
} from '../../compartilhado/validacoes/documentos.js'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type PessoaComRelacoes = Prisma.PessoaGetPayload<{
  include: {
    papeis: { include: { dadosTransportadora: true } }
    contatos: true
    enderecos: true
    dadosBancarios: true
  }
}>

export type TransportadoraView = ReturnType<typeof mapearParaTransportadoraView>

export type ResultadoBuscaPorDocumento = {
  encontrado: boolean
  temPapelTransportadora: boolean
  papeis: string[]
  pessoa: TransportadoraView | null
}

// ─── Mapeador ─────────────────────────────────────────────────────────────────

function mapearParaTransportadoraView(pessoa: PessoaComRelacoes) {
  const papelTransportadora = pessoa.papeis.find((p) => p.papel === 'transportadora')!
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
    papelId: papelTransportadora.id,
    tipo: pessoa.tipo,
    ativo: papelTransportadora.ativo,
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
    antt: papelTransportadora.dadosTransportadora?.antt ?? null,
    aceitaNFe55: papelTransportadora.dadosTransportadora?.aceitaNFe55 ?? true,
    contatos: pessoa.contatos,
    enderecos: pessoa.enderecos,
    dadosBancarios: pessoa.dadosBancarios,
    createdAt: pessoa.createdAt,
    updatedAt: pessoa.updatedAt,
  }
}

// ─── Include reutilizável ──────────────────────────────────────────────────────

const INCLUDE_COMPLETO = {
  papeis: {
    where: { papel: 'transportadora' },
    include: { dadosTransportadora: true },
  },
  contatos: true,
  enderecos: true,
  dadosBancarios: true,
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

type DadosBancarioItem = {
  apelido?: string | null
  banco?: string | null
  agencia?: string | null
  conta?: string | null
  tipoConta?: string | null
  pix?: string | null
  favorecido?: string | null
  documentoFavorecido?: string | null
  principal?: boolean
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
  cnae: string | null
  dataFundacao: string | null
  ie: string | null
  im: string | null
  simplesNacional: boolean
  observacaoNF: string | null
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
  antt: string | null
  aceitaNFe55: boolean
  contatosArray?: ContatoItem[]
  enderecosArray?: EnderecoItem[]
  dadosBancariosArray?: DadosBancarioItem[]
}

function normalizarDocumento(dados: DadosParaCriarTransportadora | DadosParaEditarTransportadora): CamposNormalizados {
  const ieNormalizada =
    dados.tipo === 'PJ' ? normalizarIe(dados.ie) : null

  const base = {
    tipo: dados.tipo,
    nome: dados.nome,
    indicadorIe: resolverIndicadorIe(ieNormalizada, dados.indicadorIe),
    observacoes: dados.observacoes || null,
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
    antt: dados.antt || null,
    aceitaNFe55: dados.aceitaNFe55 ?? true,
    contatosArray: dados.contatos,
    enderecosArray: dados.enderecos,
    dadosBancariosArray: dados.dadosBancarios,
  }

  if (dados.tipo === 'PF') {
    return {
      ...base,
      cpf: dados.cpf ? normalizarCpf(dados.cpf) : null,
      rg: dados.rg || null,
      dataNascimento: dados.dataNascimento || null,
      cnpj: null,
      nomeFantasia: null,
      cnae: null,
      dataFundacao: null,
      ie: null,
      im: null,
      simplesNacional: false,
      observacaoNF: null,
    }
  }

  return {
    ...base,
    cnpj: dados.cnpj ? normalizarCnpj(dados.cnpj) : null,
    nomeFantasia: dados.nomeFantasia || null,
    cnae: dados.cnae || null,
    dataFundacao: dados.dataFundacao || null,
    ie: ieNormalizada,
    im: dados.im || null,
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
      papeis: { some: { papel: 'transportadora' } },
    },
    include: INCLUDE_COMPLETO,
    orderBy: { nome: 'asc' },
  })
  return pessoas.map(mapearParaTransportadoraView)
}

async function buscarPorId(id: string) {
  const pessoa = await clientePrisma.pessoa.findUnique({
    where: { id },
    include: INCLUDE_COMPLETO,
  })
  if (!pessoa || !pessoa.papeis.length) return null
  return mapearParaTransportadoraView(pessoa)
}

async function buscarPorCpfNaEmpresa(cpf: string, companyId: string) {
  const cpfLimpo = normalizarCpf(cpf)
  const pessoa = await clientePrisma.pessoa.findFirst({
    where: {
      cpf: cpfLimpo,
      companyId,
      papeis: { some: { papel: 'transportadora' } },
    },
    include: INCLUDE_COMPLETO,
  })
  return pessoa ? mapearParaTransportadoraView(pessoa) : null
}

async function buscarPorCnpjNaEmpresa(cnpj: string, companyId: string) {
  const cnpjLimpo = normalizarCnpj(cnpj)
  const pessoa = await clientePrisma.pessoa.findFirst({
    where: {
      cnpj: cnpjLimpo,
      companyId,
      papeis: { some: { papel: 'transportadora' } },
    },
    include: INCLUDE_COMPLETO,
  })
  return pessoa ? mapearParaTransportadoraView(pessoa) : null
}

async function buscarPessoaPorDocumentoNaEmpresa(
  documento: string,
  companyId: string
): Promise<ResultadoBuscaPorDocumento> {
  const classificado = classificarDocumento(documento)
  if (!classificado) {
    return { encontrado: false, temPapelTransportadora: false, papeis: [], pessoa: null }
  }
  const ehCpf = classificado.tipo === 'CPF'
  const nums = classificado.valor

  const include = {
    papeis: { include: { dadosTransportadora: true } },
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
    return { encontrado: false, temPapelTransportadora: false, papeis: [], pessoa: null }
  }

  const papeis = pessoa.papeis.map((p) => p.papel)
  const temPapelTransportadora = papeis.includes('transportadora')

  let transportadoraView: TransportadoraView | null = null

  if (temPapelTransportadora) {
    const pessoaCompleta = await clientePrisma.pessoa.findUniqueOrThrow({
      where: { id: pessoa.id },
      include: INCLUDE_COMPLETO,
    })
    transportadoraView = mapearParaTransportadoraView(pessoaCompleta)
  }

  if (!transportadoraView) {
    const contatosEnderecos = extrairContatosEEnderecos(pessoa)
    transportadoraView = {
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
      simplesNacional: pessoa.simplesNacional,
      observacaoNF: pessoa.observacaoNF,
      indicadorIe: pessoa.indicadorIe,
      observacoes: pessoa.observacoes,
      companyId: pessoa.companyId,
      ...contatosEnderecos,
      antt: null,
      aceitaNFe55: true,
      createdAt: pessoa.createdAt,
      updatedAt: pessoa.updatedAt,
    } as TransportadoraView
  }

  return {
    encontrado: true,
    temPapelTransportadora,
    papeis,
    pessoa: transportadoraView,
  }
}

type TxCliente = Parameters<Parameters<typeof clientePrisma.$transaction>[0]>[0]

async function criarContatos(tx: TxCliente, pessoaId: string, campos: CamposNormalizados) {
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
    simplesNacional: campos.simplesNacional,
    observacaoNF: campos.observacaoNF,
    indicadorIe: campos.indicadorIe,
    observacoes: campos.observacoes,
  }
}

async function criarDadosBancarios(tx: TxCliente, pessoaId: string, campos: CamposNormalizados) {
  if (!campos.dadosBancariosArray?.length) return
  for (const db of campos.dadosBancariosArray) {
    await tx.pessoaDadosBancario.create({
      data: {
        pessoaId,
        apelido: db.apelido,
        banco: db.banco,
        agencia: db.agencia,
        conta: db.conta,
        tipoConta: db.tipoConta,
        pix: db.pix,
        favorecido: db.favorecido,
        documentoFavorecido: db.documentoFavorecido ? normalizarDocumento(db.documentoFavorecido) : null,
        principal: db.principal ?? false,
      },
    })
  }
}

async function sincronizarContatosEnderecos(
  tx: TxCliente,
  pessoaId: string,
  campos: CamposNormalizados
) {
  await tx.pessoaContato.deleteMany({ where: { pessoaId } })
  await criarContatos(tx, pessoaId, campos)

  if (campos.enderecosArray && campos.enderecosArray.length > 0) {
    await tx.pessoaEndereco.deleteMany({ where: { pessoaId } })
  } else {
    await tx.pessoaEndereco.deleteMany({ where: { pessoaId, tipo: 'principal' } })
  }
  await criarEnderecos(tx, pessoaId, campos)

  await tx.pessoaDadosBancario.deleteMany({ where: { pessoaId } })
  await criarDadosBancarios(tx, pessoaId, campos)
}

async function criar(dados: DadosParaCriarTransportadora, companyId: string) {
  const campos = normalizarDocumento(dados)
  const documento = campos.tipo === 'PF' ? campos.cpf : campos.cnpj
  const msgDuplicado =
    campos.tipo === 'PF'
      ? 'CPF já cadastrado como transportadora nesta empresa'
      : 'CNPJ já cadastrado como transportadora nesta empresa'

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
        where: { pessoaId, papel: 'transportadora' },
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
        await tx.dadosTransportadora.upsert({
          where: { papelId: papelExistente.id },
          update: {
            antt: campos.antt,
            aceitaNFe55: campos.aceitaNFe55,
          },
          create: {
            papelId: papelExistente.id,
            antt: campos.antt,
            aceitaNFe55: campos.aceitaNFe55,
          },
        })
      } else {
        const papel = await tx.pessoaPapel.create({
          data: { pessoaId, papel: 'transportadora', ativo: true },
        })
        await tx.dadosTransportadora.create({
          data: {
            papelId: papel.id,
            antt: campos.antt,
            aceitaNFe55: campos.aceitaNFe55,
          },
        })
      }

      await sincronizarContatosEnderecos(tx, pessoaId, campos)
    } else {
      const pessoa = await tx.pessoa.create({
        data: { ...dadosDaPessoaDeCampos(campos), companyId },
      })
      pessoaId = pessoa.id

      const papel = await tx.pessoaPapel.create({
        data: { pessoaId, papel: 'transportadora', ativo: true },
      })

      await tx.dadosTransportadora.create({
        data: {
          papelId: papel.id,
          antt: campos.antt,
          aceitaNFe55: campos.aceitaNFe55,
        },
      })

      await criarContatos(tx, pessoaId, campos)
      await criarEnderecos(tx, pessoaId, campos)
      await criarDadosBancarios(tx, pessoaId, campos)
    }

    const pessoaCompleta = await tx.pessoa.findUniqueOrThrow({
      where: { id: pessoaId },
      include: INCLUDE_COMPLETO,
    })

    return mapearParaTransportadoraView(pessoaCompleta)
  })
}

async function atualizar(id: string, dados: DadosParaEditarTransportadora) {
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
        simplesNacional: campos.simplesNacional,
        observacaoNF: campos.observacaoNF,
        indicadorIe: campos.indicadorIe,
        observacoes: campos.observacoes,
      },
    })

    const papelTransportadora = await tx.pessoaPapel.findFirst({
      where: { pessoaId: id, papel: 'transportadora' },
    })

    if (papelTransportadora) {
      await tx.dadosTransportadora.upsert({
        where: { papelId: papelTransportadora.id },
        update: {
          antt: campos.antt,
          aceitaNFe55: campos.aceitaNFe55,
        },
        create: {
          papelId: papelTransportadora.id,
          antt: campos.antt,
          aceitaNFe55: campos.aceitaNFe55,
        },
      })
    }

    await tx.pessoaContato.deleteMany({ where: { pessoaId: id } })
    await criarContatos(tx, id, campos)

    if (campos.enderecosArray && campos.enderecosArray.length > 0) {
      await tx.pessoaEndereco.deleteMany({ where: { pessoaId: id } })
    } else {
      await tx.pessoaEndereco.deleteMany({ where: { pessoaId: id, tipo: 'principal' } })
    }
    await criarEnderecos(tx, id, campos)

    await tx.pessoaDadosBancario.deleteMany({ where: { pessoaId: id } })
    await criarDadosBancarios(tx, id, campos)

    const pessoaCompleta = await tx.pessoa.findUniqueOrThrow({
      where: { id },
      include: INCLUDE_COMPLETO,
    })

    return mapearParaTransportadoraView(pessoaCompleta)
  })
}

async function alterarStatus(id: string, ativo: boolean) {
  await clientePrisma.pessoaPapel.updateMany({
    where: { pessoaId: id, papel: 'transportadora' },
    data: { ativo },
  })

  const pessoa = await clientePrisma.pessoa.findUniqueOrThrow({
    where: { id },
    include: INCLUDE_COMPLETO,
  })

  return mapearParaTransportadoraView(pessoa)
}

export const repositorioDeTransportadoras = {
  listarPorEmpresa,
  buscarPorId,
  buscarPorCpfNaEmpresa,
  buscarPorCnpjNaEmpresa,
  buscarPessoaPorDocumentoNaEmpresa,
  criar,
  atualizar,
  alterarStatus,
}
