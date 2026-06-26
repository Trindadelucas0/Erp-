/**
 * Integração com BrasilAPI para busca de dados de CNPJ via Receita Federal.
 * Consulta passa pelo backend (GET /integracoes/cnpj/:documento) para
 * funcionar na VPS e aparecer nos logs da API.
 *
 * Deduplicação: se já existe uma Promise em voo para o mesmo CNPJ, reutiliza
 * a mesma em vez de abrir uma 2ª requisição.
 */
import { clienteHttp } from '@/services/api'
import { mascaraTelefone } from '@/lib/documentos'

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

function normalizarTelefones(dados: DadosCnpj): DadosCnpj {
  return {
    ...dados,
    telefone: dados.telefone ? mascaraTelefone(dados.telefone) : '',
    celular: dados.celular ? mascaraTelefone(dados.celular) : '',
  }
}

const _consultasEmAndamento = new Map<string, Promise<DadosCnpj | null>>()

export async function buscarDadosCnpj(cnpj: string): Promise<DadosCnpj | null> {
  const nums = cnpj.replace(/\D/g, '')
  if (nums.length !== 14) return null

  const existente = _consultasEmAndamento.get(nums)
  if (existente) return existente

  const promessa = (async () => {
    try {
      const { data } = await clienteHttp.get<DadosCnpj>(`/integracoes/cnpj/${nums}`)
      return normalizarTelefones(data)
    } catch {
      return null
    }
  })().finally(() => _consultasEmAndamento.delete(nums))

  _consultasEmAndamento.set(nums, promessa)
  return promessa
}
