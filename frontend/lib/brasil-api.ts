/**
 * Integração com BrasilAPI para busca de dados de CNPJ via Receita Federal.
 * Consulta passa pelo backend (GET /integracoes/cnpj/:documento) para
 * funcionar na VPS e aparecer nos logs da API.
 *
 * Deduplicação: se já existe uma Promise em voo para o mesmo CNPJ, reutiliza
 * a mesma em vez de abrir uma 2ª requisição.
 */
import { clienteHttp } from '@/services/api'
import { mascaraTelefone, normalizarCnpj, validarCnpj } from '@/lib/documentos'
import { paraCaixaAlta } from '@/lib/texto'

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
    nome: paraCaixaAlta(dados.nome),
    nomeFantasia: paraCaixaAlta(dados.nomeFantasia),
    complemento: dados.complemento ? paraCaixaAlta(dados.complemento) : '',
    logradouro: dados.logradouro ? paraCaixaAlta(dados.logradouro) : '',
    bairro: dados.bairro ? paraCaixaAlta(dados.bairro) : '',
    cidade: dados.cidade ? paraCaixaAlta(dados.cidade) : '',
    estado: dados.estado ? paraCaixaAlta(dados.estado) : '',
    telefone: dados.telefone ? mascaraTelefone(dados.telefone) : '',
    celular: dados.celular ? mascaraTelefone(dados.celular) : '',
  }
}

const MSG_FALHA_CONSULTA = 'Não foi possível consultar a Receita Federal'
const _consultasEmAndamento = new Map<string, Promise<DadosCnpj>>()

function erroConsultaCnpj(erro: unknown): Error {
  if (typeof erro === 'object' && erro !== null && 'response' in erro) {
    const data = (erro as { response?: { data?: { mensagem?: string } } }).response?.data
    const mensagem = data?.mensagem?.trim()
    if (mensagem) return new Error(mensagem)
  }
  return new Error(MSG_FALHA_CONSULTA)
}

export async function buscarDadosCnpj(cnpj: string): Promise<DadosCnpj | null> {
  const limpo = normalizarCnpj(cnpj)
  if (limpo.length !== 14 || !validarCnpj(limpo)) return null

  const existente = _consultasEmAndamento.get(limpo)
  if (existente) return existente

  const promessa = (async () => {
    try {
      const { data } = await clienteHttp.get<DadosCnpj>(`/integracoes/cnpj/${encodeURIComponent(limpo)}`)
      return normalizarTelefones(data)
    } catch (erro) {
      throw erroConsultaCnpj(erro)
    }
  })().finally(() => _consultasEmAndamento.delete(limpo))

  _consultasEmAndamento.set(limpo, promessa)
  return promessa
}
