/**
 * Integração com BrasilAPI para busca de dados de CNPJ via Receita Federal.
 * Endpoint público, sem autenticação, suporta CORS.
 */

export type DadosCnpj = {
  nome: string
  nomeFantasia: string
  cnae: string
  dataFundacao: string
  ie: string
  cep: string
  logradouro: string
  numero: string
  bairro: string
  cidade: string
  estado: string
  codigoIbge: string
}

type RespostaBrasilApi = {
  razao_social: string
  nome_fantasia?: string
  cnae_fiscal?: number
  data_inicio_atividade?: string
  ddd_telefone_1?: string
  cep?: string
  logradouro?: string
  numero?: string
  bairro?: string
  municipio?: string
  uf?: string
  codigo_municipio_ibge?: number
  qsa?: Array<{ nome_socio: string }>
}

function formatarData(data?: string): string {
  if (!data) return ''
  // BrasilAPI retorna YYYY-MM-DD
  return data.slice(0, 10)
}

function limparCep(cep?: string): string {
  return (cep ?? '').replace(/\D/g, '')
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

    return {
      nome: dados.razao_social ?? '',
      nomeFantasia: dados.nome_fantasia ?? '',
      cnae: dados.cnae_fiscal ? String(dados.cnae_fiscal) : '',
      dataFundacao: formatarData(dados.data_inicio_atividade),
      ie: '',
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
