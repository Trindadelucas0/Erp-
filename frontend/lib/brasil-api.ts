/**
 * Integração com BrasilAPI para busca de dados de CNPJ via Receita Federal.
 */
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
  opcao_pelo_simples?: string
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
  const nums = ddd.replace(/\D/g, '')
  if (!nums) return ''
  // BrasilAPI retorna no formato "DD NNNNNNNN" ou "DDNNNNNNNN"
  if (nums.length >= 10) return nums
  return nums
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

export async function buscarDadosCnpj(cnpj: string): Promise<DadosCnpj | null> {
  const nums = cnpj.replace(/\D/g, '')
  if (nums.length !== 14) return null

  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${nums}`, {
      signal: AbortSignal.timeout(6000),
    })

    if (!resposta.ok) return null

    const dados: RespostaBrasilApi = await resposta.json()
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
      simplesNacional: dados.opcao_pelo_simples?.toLowerCase() === 'sim',
      cep: limparCep(dados.cep),
      logradouro: dados.logradouro ?? '',
      numero: dados.numero ?? '',
      bairro: dados.bairro ?? '',
      cidade: dados.municipio ?? '',
      estado: dados.uf ?? '',
      codigoIbge: dados.codigo_municipio_ibge ? String(dados.codigo_municipio_ibge) : '',
    }
  } catch {
    return null
  }
}
