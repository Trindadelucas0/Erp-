/**
 * Consulta CNPJ na BrasilAPI e normaliza para o shape usado pelo frontend.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { validarCnpj } from '../../compartilhado/validacoes/documentos.js'

const URL_BRASIL_API = 'https://brasilapi.com.br/api/cnpj/v1'
const TIMEOUT_MS = 8_000
const HEADERS_BRASIL_API = {
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

function formatarData(data?: string): string {
  if (!data) return ''
  return data.slice(0, 10)
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
  if (typeof valor === 'string') return valor.toLowerCase() === 'sim'
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
    nome: dados.razao_social ?? '',
    nomeFantasia: dados.nome_fantasia ?? '',
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

async function buscarDadosCnpj(nums: string): Promise<DadosCnpj> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const resposta = await fetch(`${URL_BRASIL_API}/${nums}`, {
      signal: controller.signal,
      headers: HEADERS_BRASIL_API,
    })

    if (resposta.status === 404) {
      throw new ErroDaAplicacao('CNPJ não encontrado na Receita Federal', 404)
    }

    if (!resposta.ok) {
      throw new ErroDaAplicacao('Não foi possível consultar a Receita Federal', 502)
    }

    const dados = (await resposta.json()) as RespostaBrasilApi
    return mapearRespostaBrasilApi(dados)
  } catch (erro) {
    if (erro instanceof ErroDaAplicacao) throw erro
    throw new ErroDaAplicacao('Não foi possível consultar a Receita Federal', 502)
  } finally {
    clearTimeout(timer)
  }
}

export const servicoBrasilApi = {
  async consultarCnpj(documento: string): Promise<DadosCnpj> {
    const nums = documento.replace(/\D/g, '')
    if (nums.length !== 14 || !validarCnpj(nums)) {
      throw new ErroDaAplicacao('CNPJ inválido', 400)
    }
    return buscarDadosCnpj(nums)
  },
}
