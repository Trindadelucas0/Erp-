/**
 * Acesso ao banco de dados para fornecedores.
 * Trabalha sobre a entidade Pessoa com papel = 'fornecedor'.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import type { Prisma } from '@prisma/client'
import type { DadosParaCriarFornecedor, DadosParaEditarFornecedor } from './esquema-fornecedores.js'
import { extrairContatosEEnderecos } from '../../compartilhado/pessoas/extrair-contatos-enderecos.js'
import { normalizarIe, resolverIndicadorIe } from '../../compartilhado/validacoes/inscricao-estadual.js'
import {
  enriquecerFornecedoresComVinculos,
  obterFornecedoresRelacionados,
  sincronizarVinculosDiretosFornecedor,
} from './vinculos-fornecedor.js'

export { obterRedeFornecedor } from './vinculos-fornecedor.js'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type PessoaComRelacoes = Prisma.PessoaGetPayload<{
  include: typeof INCLUDE_COMPLETO
}>

export type FornecedorView = ReturnType<typeof mapearParaFornecedorView>

export type ResultadoBuscaPorDocumento = {
  encontrado: boolean
  temPapelFornecedor: boolean
  papeis: string[]
  pessoa: FornecedorView | null
}

// ─── Include reutilizável ──────────────────────────────────────────────────────

const INCLUDE_COMPLETO = {
  papeis: {
    where: { papel: 'fornecedor' },
    include: {
      dadosFornecedor: {
        include: {
          planosFinanceiros: { include: { planoFinanceiro: true } },
          cfopsEntrada: { include: { cfop: true } },
          paresPlanoCfopPadrao: {
            include: { planoFinanceiro: true, cfop: true },
            orderBy: { ordem: 'asc' as const },
          },
        },
      },
    },
  },
  contatos: true,
  enderecos: true,
  dadosBancarios: true,
  cnaes: { orderBy: { principal: 'desc' as const } },
} as const

// ─── Mapeador ─────────────────────────────────────────────────────────────────

function mapearPrazosPagamento(df: {
  prazoPagamento1: number | null
  prazoPagamento2: number | null
  prazoPagamento3: number | null
  prazoPagamento4: number | null
  prazoPagamento5: number | null
  prazoPagamento6: number | null
}) {
  return [
    df.prazoPagamento1,
    df.prazoPagamento2,
    df.prazoPagamento3,
    df.prazoPagamento4,
    df.prazoPagamento5,
    df.prazoPagamento6,
  ]
}

function mapearParaFornecedorView(pessoa: PessoaComRelacoes) {
  const papelFornecedor = pessoa.papeis.find((p) => p.papel === 'fornecedor')!
  const df = papelFornecedor.dadosFornecedor
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
    papelId: papelFornecedor.id,
    dadosFornecedorId: df?.id ?? null,
    tipo: pessoa.tipo,
    ativo: papelFornecedor.ativo,
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
    simplesNacional: pessoa.simplesNacional,
    observacoes: pessoa.observacoes,
    companyId: pessoa.companyId,
    email: emailPrincipal?.valor ?? null,
    telefone: telefonePrincipal?.valor ?? null,
    celular: celular?.valor ?? null,
    celularWhatsapp: telefonePrincipal?.whatsapp ?? celular?.whatsapp ?? false,
    cep: enderecoPrincipal?.cep ?? null,
    logradouro: enderecoPrincipal?.logradouro ?? null,
    numero: enderecoPrincipal?.numero ?? null,
    complemento: enderecoPrincipal?.complemento ?? null,
    bairro: enderecoPrincipal?.bairro ?? null,
    cidade: enderecoPrincipal?.cidade ?? null,
    estado: enderecoPrincipal?.estado ?? null,
    codigoIbge: enderecoPrincipal?.codigoIbge ?? null,
    tipoRevenda: df?.tipoRevenda ?? false,
    tipoConsumo: df?.tipoConsumo ?? false,
    tipoPrestadorServico: df?.tipoPrestadorServico ?? false,
    permitirVinculoManual: df?.permitirVinculoManual ?? false,
    exigirItensEntrada: df?.exigirItensEntrada ?? false,
    prazosPagamento: df ? mapearPrazosPagamento(df) : [null, null, null, null, null, null],
    planosFinanceiros:
      df?.planosFinanceiros.map((p) => ({
        id: p.planoFinanceiro.id,
        codigo: p.planoFinanceiro.codigo,
        descricao: p.planoFinanceiro.nome,
        tipo: p.planoFinanceiro.tipo,
      })) ?? [],
    cfopsEntrada:
      df?.cfopsEntrada.map((c) => ({
        id: c.cfop.id,
        codigo: c.cfop.codigo,
        descricao: c.cfop.nome,
      })) ?? [],
    paresPlanoCfopPadrao:
      df?.paresPlanoCfopPadrao.map((par) => ({
        id: par.id,
        planoFinanceiroId: par.planoFinanceiro.id,
        planoCodigo: par.planoFinanceiro.codigo,
        planoDescricao: par.planoFinanceiro.nome,
        planoTipo: par.planoFinanceiro.tipo,
        cfopId: par.cfop.id,
        cfopCodigo: par.cfop.codigo,
        cfopDescricao: par.cfop.nome,
      })) ?? [],
    dadosBancarios: pessoa.dadosBancarios,
    contatos: pessoa.contatos,
    enderecos: pessoa.enderecos,
    createdAt: pessoa.createdAt,
    updatedAt: pessoa.updatedAt,
  }
}

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

type CnaeItem = {
  codigo: string
  descricao?: string | null
  principal?: boolean
}

type CamposNormalizados = {
  tipo: string
  nome: string
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
  indicadorIe: string
  simplesNacional: boolean
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
  tipoRevenda: boolean
  tipoConsumo: boolean
  tipoPrestadorServico: boolean
  permitirVinculoManual: boolean
  exigirItensEntrada: boolean
  prazoPagamento1: number | null
  prazoPagamento2: number | null
  prazoPagamento3: number | null
  prazoPagamento4: number | null
  prazoPagamento5: number | null
  prazoPagamento6: number | null
  planosFinanceirosIds: string[]
  cfopsEntradaIds: string[]
  fornecedoresVinculadosIds: string[]
  paresPlanoCfopPadrao: { planoFinanceiroId: string; cfopId: string }[]
  contatosArray?: ContatoItem[]
  enderecosArray?: EnderecoItem[]
  dadosBancariosArray?: DadosBancarioItem[]
  cnaesArray?: CnaeItem[]
}

function normalizarPrazos(prazos?: (number | null)[] | null) {
  const p = prazos ?? []
  return {
    prazoPagamento1: p[0] ?? null,
    prazoPagamento2: p[1] ?? null,
    prazoPagamento3: p[2] ?? null,
    prazoPagamento4: p[3] ?? null,
    prazoPagamento5: p[4] ?? null,
    prazoPagamento6: p[5] ?? null,
  }
}

function normalizarDocumento(dados: DadosParaCriarFornecedor | DadosParaEditarFornecedor): CamposNormalizados {
  const prazos = normalizarPrazos(dados.prazosPagamento)
  const ieNormalizada =
    dados.tipo === 'PJ' ? normalizarIe(dados.ie) : null
  const cnaesArray = dados.cnaes
  const cnaePrincipal =
    cnaesArray?.find((c) => c.principal)?.codigo ??
    cnaesArray?.[0]?.codigo ??
    (dados.tipo === 'PJ' ? dados.cnae : null) ??
    null

  const base = {
    tipo: dados.tipo,
    nome: dados.nome,
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
    tipoRevenda: dados.tipoRevenda ?? false,
    tipoConsumo: dados.tipoConsumo ?? false,
    tipoPrestadorServico: dados.tipoPrestadorServico ?? false,
    permitirVinculoManual: dados.permitirVinculoManual ?? false,
    exigirItensEntrada: dados.exigirItensEntrada ?? false,
    ...prazos,
    planosFinanceirosIds: dados.planosFinanceirosIds ?? [],
    cfopsEntradaIds: dados.cfopsEntradaIds ?? [],
    fornecedoresVinculadosIds: dados.fornecedoresVinculadosIds ?? [],
    paresPlanoCfopPadrao: dados.paresPlanoCfopPadrao ?? [],
    contatosArray: dados.contatos,
    enderecosArray: dados.enderecos,
    dadosBancariosArray: dados.dadosBancarios,
    cnaesArray,
    cnae: cnaePrincipal,
  }

  if (dados.tipo === 'PF') {
    return {
      ...base,
      cpf: limparNumeros(dados.cpf),
      rg: dados.rg || null,
      dataNascimento: dados.dataNascimento || null,
      cnpj: null,
      nomeFantasia: null,
      dataFundacao: null,
      ie: null,
      im: null,
      indicadorIe: '9',
      simplesNacional: false,
    }
  }

  return {
    ...base,
    cnpj: limparNumeros(dados.cnpj),
    nomeFantasia: dados.nomeFantasia || null,
    dataFundacao: dados.dataFundacao || null,
    ie: ieNormalizada,
    im: dados.im || null,
    indicadorIe: resolverIndicadorIe(ieNormalizada),
    simplesNacional: dados.simplesNacional ?? false,
    cpf: null,
    rg: null,
    dataNascimento: null,
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

async function listarPorEmpresa(companyId: string, q?: string) {
  const termo = q?.trim()
  const nums = termo?.replace(/\D/g, '') ?? ''

  const pessoas = await clientePrisma.pessoa.findMany({
    where: {
      companyId,
      papeis: { some: { papel: 'fornecedor' } },
      ...(termo
        ? {
            OR: [
              { nome: { contains: termo, mode: 'insensitive' } },
              ...(nums.length >= 3
                ? [{ cpf: { contains: nums } }, { cnpj: { contains: nums } }]
                : []),
            ],
          }
        : {}),
    },
    include: INCLUDE_COMPLETO,
    orderBy: { nome: 'asc' },
    ...(termo ? { take: 50 } : {}),
  })

  const base = pessoas.map(mapearParaFornecedorView)

  if (termo) return base

  return enriquecerFornecedoresComVinculos(base, companyId)
}

async function buscarPorId(id: string) {
  const pessoa = await clientePrisma.pessoa.findUnique({
    where: { id },
    include: INCLUDE_COMPLETO,
  })
  if (!pessoa || !pessoa.papeis.length) return null

  const base = mapearParaFornecedorView(pessoa)
  if (!base.dadosFornecedorId) {
    return { ...base, fornecedoresVinculadosIds: [], fornecedoresRelacionados: [] }
  }

  const fornecedoresRelacionados = await obterFornecedoresRelacionados(
    base.dadosFornecedorId,
    base.companyId
  )

  return {
    ...base,
    fornecedoresVinculadosIds: fornecedoresRelacionados
      .filter((r) => r.vinculoDireto)
      .map((r) => r.dadosFornecedorId),
    fornecedoresRelacionados,
  }
}

async function buscarPorCpfNaEmpresa(cpf: string, companyId: string) {
  const cpfLimpo = cpf.replace(/\D/g, '')
  const pessoa = await clientePrisma.pessoa.findFirst({
    where: {
      cpf: cpfLimpo,
      companyId,
      papeis: { some: { papel: 'fornecedor' } },
    },
    include: INCLUDE_COMPLETO,
  })
  return pessoa ? mapearParaFornecedorView(pessoa) : null
}

async function buscarPorCnpjNaEmpresa(cnpj: string, companyId: string) {
  const cnpjLimpo = cnpj.replace(/\D/g, '')
  const pessoa = await clientePrisma.pessoa.findFirst({
    where: {
      cnpj: cnpjLimpo,
      companyId,
      papeis: { some: { papel: 'fornecedor' } },
    },
    include: INCLUDE_COMPLETO,
  })
  return pessoa ? mapearParaFornecedorView(pessoa) : null
}

async function buscarPessoaPorDocumentoNaEmpresa(
  documento: string,
  companyId: string
): Promise<ResultadoBuscaPorDocumento> {
  const nums = documento.replace(/\D/g, '')
  const ehCpf = nums.length === 11
  const ehCnpj = nums.length === 14

  if (!ehCpf && !ehCnpj) {
    return { encontrado: false, temPapelFornecedor: false, papeis: [], pessoa: null }
  }

  const pessoa = await clientePrisma.pessoa.findFirst({
    where: {
      companyId,
      ...(ehCpf ? { cpf: nums } : { cnpj: nums }),
    },
    include: {
      papeis: { include: { dadosFornecedor: true } },
      contatos: true,
      enderecos: true,
      cnaes: true,
      dadosBancarios: true,
    },
  })

  if (!pessoa) {
    return { encontrado: false, temPapelFornecedor: false, papeis: [], pessoa: null }
  }

  const papeis = pessoa.papeis.map((p) => p.papel)
  const temPapelFornecedor = papeis.includes('fornecedor')

  let fornecedorView: FornecedorView | null = null

  if (temPapelFornecedor) {
    const pessoaCompleta = await clientePrisma.pessoa.findUniqueOrThrow({
      where: { id: pessoa.id },
      include: INCLUDE_COMPLETO,
    })
    fornecedorView = mapearParaFornecedorView(pessoaCompleta)
  }

  if (!fornecedorView) {
    const contatosEnderecos = extrairContatosEEnderecos(pessoa)
    fornecedorView = {
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
      simplesNacional: pessoa.simplesNacional,
      observacoes: pessoa.observacoes,
      companyId: pessoa.companyId,
      ...contatosEnderecos,
      tipoRevenda: false,
      tipoConsumo: false,
      tipoPrestadorServico: false,
      permitirVinculoManual: false,
      exigirItensEntrada: false,
      prazosPagamento: [null, null, null, null, null, null],
      planosFinanceiros: [],
      cfopsEntrada: [],
      paresPlanoCfopPadrao: [],
      dadosFornecedorId: null,
      fornecedoresVinculadosIds: [],
      fornecedoresRelacionados: [],
      createdAt: pessoa.createdAt,
      updatedAt: pessoa.updatedAt,
    } as unknown as FornecedorView
  }

  return {
    encontrado: true,
    temPapelFornecedor,
    papeis,
    pessoa: fornecedorView,
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
      data: {
        pessoaId,
        tipo: 'telefone',
        valor: campos.telefone,
        principal: true,
        whatsapp: campos.celularWhatsapp,
      },
    })
    return
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
        documentoFavorecido: db.documentoFavorecido
          ? limparNumeros(db.documentoFavorecido)
          : null,
        principal: db.principal ?? false,
      },
    })
  }
}

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
    indicadorIe: campos.indicadorIe,
    simplesNacional: campos.simplesNacional,
    observacoes: campos.observacoes,
  }
}

function dadosFornecedorDeCampos(campos: CamposNormalizados) {
  return {
    tipoRevenda: campos.tipoRevenda,
    tipoConsumo: campos.tipoConsumo,
    tipoPrestadorServico: campos.tipoPrestadorServico,
    permitirVinculoManual: campos.permitirVinculoManual,
    exigirItensEntrada: campos.exigirItensEntrada,
    prazoPagamento1: campos.prazoPagamento1,
    prazoPagamento2: campos.prazoPagamento2,
    prazoPagamento3: campos.prazoPagamento3,
    prazoPagamento4: campos.prazoPagamento4,
    prazoPagamento5: campos.prazoPagamento5,
    prazoPagamento6: campos.prazoPagamento6,
  }
}

async function sincronizarVinculosCatalogoFornecedor(
  tx: TxCliente,
  dadosFornecedorId: string,
  campos: CamposNormalizados
) {
  await tx.fornecedorPlanoFinanceiro.deleteMany({ where: { dadosFornecedorId } })
  await tx.fornecedorCfopEntrada.deleteMany({ where: { dadosFornecedorId } })
  await tx.fornecedorParPlanoCfopPadrao.deleteMany({ where: { dadosFornecedorId } })

  for (const planoId of campos.planosFinanceirosIds) {
    await tx.fornecedorPlanoFinanceiro.create({
      data: { dadosFornecedorId, planoFinanceiroId: planoId },
    })
  }
  for (const cfopId of campos.cfopsEntradaIds) {
    await tx.fornecedorCfopEntrada.create({
      data: { dadosFornecedorId, cfopId },
    })
  }
  for (let i = 0; i < campos.paresPlanoCfopPadrao.length; i++) {
    const par = campos.paresPlanoCfopPadrao[i]
    await tx.fornecedorParPlanoCfopPadrao.create({
      data: {
        dadosFornecedorId,
        planoFinanceiroId: par.planoFinanceiroId,
        cfopId: par.cfopId,
        ordem: i,
      },
    })
  }
}

async function sincronizarRelacoesPessoa(
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

  await tx.pessoaCnae.deleteMany({ where: { pessoaId } })
  await criarCnaes(tx, pessoaId, campos)
}

async function criar(dados: DadosParaCriarFornecedor, companyId: string) {
  const campos = normalizarDocumento(dados)
  const documento = campos.tipo === 'PF' ? campos.cpf : campos.cnpj
  const msgDuplicado =
    campos.tipo === 'PF'
      ? 'CPF já cadastrado como fornecedor nesta empresa'
      : 'CNPJ já cadastrado como fornecedor nesta empresa'

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
    let dadosFornecedorId: string

    if (pessoaExistente) {
      pessoaId = pessoaExistente.id

      const papelExistente = await tx.pessoaPapel.findFirst({
        where: { pessoaId, papel: 'fornecedor' },
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
        const df = await tx.dadosFornecedor.upsert({
          where: { papelId: papelExistente.id },
          update: dadosFornecedorDeCampos(campos),
          create: { papelId: papelExistente.id, ...dadosFornecedorDeCampos(campos) },
        })
        dadosFornecedorId = df.id
      } else {
        const papel = await tx.pessoaPapel.create({
          data: { pessoaId, papel: 'fornecedor', ativo: true },
        })
        const df = await tx.dadosFornecedor.create({
          data: { papelId: papel.id, ...dadosFornecedorDeCampos(campos) },
        })
        dadosFornecedorId = df.id
      }

      await sincronizarRelacoesPessoa(tx, pessoaId, campos)
      await sincronizarVinculosCatalogoFornecedor(tx, dadosFornecedorId, campos)
      await sincronizarVinculosDiretosFornecedor(
        tx,
        dadosFornecedorId,
        campos.fornecedoresVinculadosIds,
        companyId
      )
    } else {
      const pessoa = await tx.pessoa.create({
        data: { ...dadosDaPessoaDeCampos(campos), companyId },
      })
      pessoaId = pessoa.id

      const papel = await tx.pessoaPapel.create({
        data: { pessoaId, papel: 'fornecedor', ativo: true },
      })

      const df = await tx.dadosFornecedor.create({
        data: { papelId: papel.id, ...dadosFornecedorDeCampos(campos) },
      })
      dadosFornecedorId = df.id

      await criarContatos(tx, pessoaId, campos)
      await criarEnderecos(tx, pessoaId, campos)
      await criarDadosBancarios(tx, pessoaId, campos)
      await criarCnaes(tx, pessoaId, campos)
      await sincronizarVinculosCatalogoFornecedor(tx, dadosFornecedorId, campos)
      await sincronizarVinculosDiretosFornecedor(
        tx,
        dadosFornecedorId,
        campos.fornecedoresVinculadosIds,
        companyId
      )
    }

    const pessoaCompleta = await tx.pessoa.findUniqueOrThrow({
      where: { id: pessoaId },
      include: INCLUDE_COMPLETO,
    })

    const base = mapearParaFornecedorView(pessoaCompleta)
    if (!base.dadosFornecedorId) return base

    const fornecedoresRelacionados = await obterFornecedoresRelacionados(
      base.dadosFornecedorId,
      companyId,
      tx
    )

    return {
      ...base,
      fornecedoresVinculadosIds: fornecedoresRelacionados
        .filter((r) => r.vinculoDireto)
        .map((r) => r.dadosFornecedorId),
      fornecedoresRelacionados,
    }
  })
}

async function atualizar(id: string, dados: DadosParaEditarFornecedor, companyId: string) {
  const campos = normalizarDocumento(dados)

  return clientePrisma.$transaction(async (tx) => {
    await tx.pessoa.update({
      where: { id },
      data: dadosDaPessoaDeCampos(campos),
    })

    const papelFornecedor = await tx.pessoaPapel.findFirst({
      where: { pessoaId: id, papel: 'fornecedor' },
    })

    if (papelFornecedor) {
      const df = await tx.dadosFornecedor.upsert({
        where: { papelId: papelFornecedor.id },
        update: dadosFornecedorDeCampos(campos),
        create: { papelId: papelFornecedor.id, ...dadosFornecedorDeCampos(campos) },
      })
      await sincronizarVinculosCatalogoFornecedor(tx, df.id, campos)
      await sincronizarVinculosDiretosFornecedor(
        tx,
        df.id,
        campos.fornecedoresVinculadosIds,
        companyId
      )
    }

    await sincronizarRelacoesPessoa(tx, id, campos)

    const pessoaCompleta = await tx.pessoa.findUniqueOrThrow({
      where: { id },
      include: INCLUDE_COMPLETO,
    })

    const base = mapearParaFornecedorView(pessoaCompleta)
    if (!base.dadosFornecedorId) return base

    const fornecedoresRelacionados = await obterFornecedoresRelacionados(
      base.dadosFornecedorId,
      companyId,
      tx
    )

    return {
      ...base,
      fornecedoresVinculadosIds: fornecedoresRelacionados
        .filter((r) => r.vinculoDireto)
        .map((r) => r.dadosFornecedorId),
      fornecedoresRelacionados,
    }
  })
}

async function alterarStatus(id: string, ativo: boolean) {
  await clientePrisma.pessoaPapel.updateMany({
    where: { pessoaId: id, papel: 'fornecedor' },
    data: { ativo },
  })

  const pessoa = await clientePrisma.pessoa.findUniqueOrThrow({
    where: { id },
    include: INCLUDE_COMPLETO,
  })

  return mapearParaFornecedorView(pessoa)
}

export const repositorioDeFornecedores = {
  listarPorEmpresa,
  buscarPorId,
  buscarPorCpfNaEmpresa,
  buscarPorCnpjNaEmpresa,
  buscarPessoaPorDocumentoNaEmpresa,
  criar,
  atualizar,
  alterarStatus,
}
