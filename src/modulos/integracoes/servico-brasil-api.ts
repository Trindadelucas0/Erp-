/**
 * Consulta CNPJ na BrasilAPI (com reserva OpenCNPJ) e normaliza para o frontend.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { decodificarEntidadesXml } from '../../compartilhado/normalizacao/entidades-xml.js'
import { normalizarCnpj, validarCnpj } from '../../compartilhado/validacoes/documentos.js'

const URL_BRASIL_API = 'https://brasilapi.com.br/api/cnpj/v1'
const URL_OPEN_CNPJ = 'https://api.opencnpj.org'
const URL_VIA_CEP = 'https://viacep.com.br/ws'
const TIMEOUT_MS = 8_000
const MSG_NAO_ENCONTRADO = 'CNPJ não encontrado na Receita Federal'
const MSG_FALHA_CONSULTA = 'Não foi possível consultar a Receita Federal'
const HEADERS = {
  Accept: 'application/json',
  // Cloudflare da BrasilAPI bloqueia fetch sem User-Agent (403 Forbidden).
  'User-Agent': 'Erp/1.0',
}

export type CnaeItem = {
  codigo: string
  descricao: string
  principal: boolean
}

export type DadosCnpj = {
  nome: string
  nomeFantasia: string
  cnae: string
  cnaes: CnaeItem[]
  dataFundacao: string
  ie: string
  email: string
  telefone: string
  celular: string
  complemento: string
  simplesNacional: boolean
  cep: string
  logradouro: string
  numero: string
  bairro: string
  cidade: string
  estado: string
  codigoIbge: string
}

type CnaeSecundarioBrasilApi = {
  codigo?: number
  descricao?: string
}

type RespostaBrasilApi = {
  razao_social: string
  nome_fantasia?: string
  cnae_fiscal?: number
  cnae_fiscal_descricao?: string
  cnaes_secundarios?: CnaeSecundarioBrasilApi[]
  data_inicio_atividade?: string
  email?: string
  ddd_telefone_1?: string
  ddd_telefone_2?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  codigo_municipio_ibge?: number
  opcao_pelo_simples?: boolean | string
}

type CnaeOpenCnpj = {
  codigo?: string
  descricao?: string
  is_principal?: boolean
}

type TelefoneOpenCnpj = {
  ddd?: string
  numero?: string
}

type RespostaOpenCnpj = {
  razao_social?: string
  nome_fantasia?: string
  cnaes?: CnaeOpenCnpj[]
  data_inicio_atividade?: string
  email?: string
  telefones?: TelefoneOpenCnpj[]
  opcao_simples?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
}

function formatarData(data?: string): string {
  if (!data) return ''
  const soData = data.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(soData)) return ''
  return soData
}

function limparCep(cep?: string): string {
  return (cep ?? '').replace(/\D/g, '')
}

function formatarTelefone(ddd?: string): string {
  if (!ddd) return ''
  return ddd.replace(/\D/g, '')
}

function parseSimplesNacional(valor: unknown): boolean {
  if (typeof valor === 'boolean') return valor
  if (typeof valor === 'string') {
    const t = valor.trim().toLowerCase()
    return t === 'sim' || t === 's'
  }
  return false
}

function montarCnaes(dados: RespostaBrasilApi): CnaeItem[] {
  const lista: CnaeItem[] = []
  const codigos = new Set<string>()

  if (dados.cnae_fiscal) {
    const codigo = String(dados.cnae_fiscal)
    codigos.add(codigo)
    lista.push({
      codigo,
      descricao: dados.cnae_fiscal_descricao ?? '',
      principal: true,
    })
  }

  for (const sec of dados.cnaes_secundarios ?? []) {
    if (!sec.codigo) continue
    const codigo = String(sec.codigo)
    if (codigos.has(codigo)) continue
    codigos.add(codigo)
    lista.push({
      codigo,
      descricao: sec.descricao ?? '',
      principal: false,
    })
  }

  return lista
}

export function mapearRespostaBrasilApi(dados: RespostaBrasilApi): DadosCnpj {
  const cnaes = montarCnaes(dados)
  const cnaePrincipal = cnaes.find((c) => c.principal)?.codigo ?? ''

  return {
    nome: decodificarEntidadesXml(dados.razao_social ?? ''),
    nomeFantasia: decodificarEntidadesXml(dados.nome_fantasia ?? ''),
    cnae: cnaePrincipal,
    cnaes,
    dataFundacao: formatarData(dados.data_inicio_atividade),
    ie: '',
    email: dados.email ?? '',
    telefone: formatarTelefone(dados.ddd_telefone_1),
    celular: formatarTelefone(dados.ddd_telefone_2),
    complemento: dados.complemento ?? '',
    simplesNacional: parseSimplesNacional(dados.opcao_pelo_simples),
    cep: limparCep(dados.cep),
    logradouro: dados.logradouro ?? '',
    numero: dados.numero ?? '',
    bairro: dados.bairro ?? '',
    cidade: dados.municipio ?? '',
    estado: dados.uf ?? '',
    codigoIbge: dados.codigo_municipio_ibge ? String(dados.codigo_municipio_ibge) : '',
  }
}

export function mapearRespostaOpenCnpj(dados: RespostaOpenCnpj): DadosCnpj {
  const lista: CnaeItem[] = []
  const codigos = new Set<string>()

  for (const item of dados.cnaes ?? []) {
    if (!item.codigo) continue
    const codigo = String(item.codigo)
    if (codigos.has(codigo)) continue
    codigos.add(codigo)
    lista.push({
      codigo,
      descricao: item.descricao ?? '',
      principal: Boolean(item.is_principal),
    })
  }

  if (lista.length > 0 && !lista.some((c) => c.principal)) {
    lista[0].principal = true
  }

  const cnaePrincipal = lista.find((c) => c.principal)?.codigo ?? ''
  const tel0 = dados.telefones?.[0]
  const tel1 = dados.telefones?.[1]

  return {
    nome: decodificarEntidadesXml(dados.razao_social ?? ''),
    nomeFantasia: decodificarEntidadesXml(dados.nome_fantasia ?? ''),
    cnae: cnaePrincipal,
    cnaes: lista,
    dataFundacao: formatarData(dados.data_inicio_atividade),
    ie: '',
    email: dados.email ?? '',
    telefone: formatarTelefone(`${tel0?.ddd ?? ''}${tel0?.numero ?? ''}`),
    celular: formatarTelefone(`${tel1?.ddd ?? ''}${tel1?.numero ?? ''}`),
    complemento: dados.complemento ?? '',
    simplesNacional: parseSimplesNacional(dados.opcao_simples),
    cep: limparCep(dados.cep),
    logradouro: dados.logradouro ?? '',
    numero: dados.numero ?? '',
    bairro: dados.bairro ?? '',
    cidade: dados.municipio ?? '',
    estado: dados.uf ?? '',
    codigoIbge: '',
  }
}

async function fetchJson(url: string): Promise<{ status: number; corpo: unknown }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const resposta = await fetch(url, {
      signal: controller.signal,
      headers: HEADERS,
    })
    let corpo: unknown = null
    try {
      corpo = await resposta.json()
    } catch {
      corpo = null
    }
    return { status: resposta.status, corpo }
  } finally {
    clearTimeout(timer)
  }
}

async function completarIbgeSeVazio(dados: DadosCnpj): Promise<DadosCnpj> {
  if (dados.codigoIbge && /^\d{7}$/.test(dados.codigoIbge)) return dados
  const cep = limparCep(dados.cep)
  if (cep.length !== 8) return { ...dados, codigoIbge: '' }

  try {
    const { status, corpo } = await fetchJson(`${URL_VIA_CEP}/${cep}/json/`)
    if (status !== 200 || !corpo || typeof corpo !== 'object') {
      return { ...dados, codigoIbge: '' }
    }
    const json = corpo as { erro?: boolean; ibge?: string }
    if (json.erro) return { ...dados, codigoIbge: '' }
    const ibge = String(json.ibge ?? '').replace(/\D/g, '')
    if (ibge.length !== 7) return { ...dados, codigoIbge: '' }
    return { ...dados, codigoIbge: ibge }
  } catch {
    return { ...dados, codigoIbge: '' }
  }
}

async function buscarNaBrasilApi(nums: string): Promise<DadosCnpj> {
  const { status, corpo } = await fetchJson(`${URL_BRASIL_API}/${encodeURIComponent(nums)}`)
  if (status === 404) {
    throw new ErroDaAplicacao(MSG_NAO_ENCONTRADO, 404)
  }
  if (status !== 200 || !corpo || typeof corpo !== 'object') {
    throw new ErroDaAplicacao(MSG_FALHA_CONSULTA, 502)
  }
  return mapearRespostaBrasilApi(corpo as RespostaBrasilApi)
}

async function buscarNaOpenCnpj(nums: string): Promise<DadosCnpj> {
  const { status, corpo } = await fetchJson(`${URL_OPEN_CNPJ}/${encodeURIComponent(nums)}`)
  if (status === 404) {
    throw new ErroDaAplicacao(MSG_NAO_ENCONTRADO, 404)
  }
  if (status !== 200 || !corpo || typeof corpo !== 'object') {
    throw new ErroDaAplicacao(MSG_FALHA_CONSULTA, 502)
  }
  const mapeado = mapearRespostaOpenCnpj(corpo as RespostaOpenCnpj)
  return completarIbgeSeVazio(mapeado)
}

async function buscarDadosCnpj(nums: string): Promise<DadosCnpj> {
  try {
    return await buscarNaBrasilApi(nums)
  } catch (erroBrasil) {
    const brasil404 =
      erroBrasil instanceof ErroDaAplicacao && erroBrasil.codigoHttp === 404
    try {
      return await buscarNaOpenCnpj(nums)
    } catch (erroOpen) {
      const open404 =
        erroOpen instanceof ErroDaAplicacao && erroOpen.codigoHttp === 404
      if (brasil404 && open404) {
        throw new ErroDaAplicacao(MSG_NAO_ENCONTRADO, 404)
      }
      throw new ErroDaAplicacao(MSG_FALHA_CONSULTA, 502)
    }
  }
}

export const servicoBrasilApi = {
  async consultarCnpj(documento: string): Promise<DadosCnpj> {
    const limpo = normalizarCnpj(documento)
    if (limpo.length !== 14 || !validarCnpj(limpo)) {
      throw new ErroDaAplicacao('CNPJ inválido', 400)
    }
    return buscarDadosCnpj(limpo)
  },
}
