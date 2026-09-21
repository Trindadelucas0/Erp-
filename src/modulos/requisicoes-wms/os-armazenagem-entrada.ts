import type { Prisma } from '@prisma/client'
import { arredondarQtd } from '../estoque/tipos-estoque.js'
import { enderecoConfere } from './efeito-estoque-requisicao.js'
import { repositorioDeRequisicoesWms } from './repositorio-requisicoes-wms.js'

export const TIPO_OS_ARMAZENAGEM = 'armazenagem' as const

export type LinhaArmazenagemEntrada = {
  produtoId: string
  quantidadeEstoque: number
}

export type CadastroEnderecoProduto = {
  endereco: string
  ordem: number
}

export type EnderecoWmsOperacional = {
  id: string
  codigoCompleto: string
  ativo: boolean
  status: string
}

function serieNumeroDaChave(chave: string): { serie: string | null; numero: string | null } {
  const digitos = chave.replace(/\D/g, '')
  if (digitos.length !== 44) return { serie: null, numero: null }
  return {
    serie: String(Number(digitos.slice(22, 25))),
    numero: String(Number(digitos.slice(25, 34))),
  }
}

export function observacaoOsArmazenagem(chaveNfe: string) {
  const { serie, numero } = serieNumeroDaChave(chaveNfe)
  return `Guardar mercadorias — NF ${numero ?? '—'} série ${serie ?? '—'}`
}

export function agruparLinhasArmazenagem(
  linhas: LinhaArmazenagemEntrada[]
): Array<{ produtoId: string; quantidade: number }> {
  const mapa = new Map<string, number>()
  for (const linha of linhas) {
    if (!linha.produtoId) continue
    const qtd = arredondarQtd(Number(linha.quantidadeEstoque))
    if (!Number.isFinite(qtd) || qtd <= 0) continue
    mapa.set(linha.produtoId, arredondarQtd((mapa.get(linha.produtoId) ?? 0) + qtd))
  }
  return [...mapa.entries()].map(([produtoId, quantidade]) => ({ produtoId, quantidade }))
}

/** 1º endereço de cadastro (ordem) que casa com AP ativo da empresa. Não inventa AP. */
export function resolverDestinoArmazenagem(
  cadastros: CadastroEnderecoProduto[],
  enderecosWms: EnderecoWmsOperacional[]
): string | null {
  const ordenados = [...cadastros].sort((a, b) => a.ordem - b.ordem)
  for (const cad of ordenados) {
    const match = enderecosWms.find(
      (end) =>
        end.ativo &&
        end.status === 'ativo' &&
        enderecoConfere(end.codigoCompleto, cad.endereco)
    )
    if (match) return match.id
  }
  return null
}

export async function gerarOsArmazenagemAposConsolidar(params: {
  companyId: string
  nfeRecebidaId: string
  chaveNfe: string
  usuarioId: string
  linhas: LinhaArmazenagemEntrada[]
  tx?: Prisma.TransactionClient
}) {
  const agrupadas = agruparLinhasArmazenagem(params.linhas)
  if (agrupadas.length === 0) return []

  const observacao = observacaoOsArmazenagem(params.chaveNfe)

  const run = async (tx: Prisma.TransactionClient) => {
    const criadas: Array<{ id: string; produtoId: string }> = []
    const enderecosWms = await repositorioDeRequisicoesWms.listarEnderecosWmsOperacionais(
      params.companyId,
      tx
    )
    for (const linha of agrupadas) {
      const existente = await repositorioDeRequisicoesWms.buscarArmazenagemPorNfeProduto(
        params.companyId,
        params.nfeRecebidaId,
        linha.produtoId,
        tx
      )
      if (existente) continue

      const cadastros = await repositorioDeRequisicoesWms.listarEnderecosCadastroProduto(
        linha.produtoId,
        tx
      )
      const destinoEnderecoId = resolverDestinoArmazenagem(cadastros, enderecosWms)
      const numero = await repositorioDeRequisicoesWms.proximoNumero(params.companyId, tx)
      const row = await tx.requisicaoWms.create({
        data: {
          companyId: params.companyId,
          numero,
          tipoOperacao: TIPO_OS_ARMAZENAGEM,
          prioridade: 3,
          status: 'disponivel',
          origemEnderecoId: null,
          destinoEnderecoId,
          produtoId: linha.produtoId,
          quantidade: linha.quantidade,
          responsavelId: null,
          observacao,
          nfeRecebidaId: params.nfeRecebidaId,
          eventos: {
            create: {
              usuarioId: params.usuarioId,
              acao: 'criar',
              deStatus: null,
              paraStatus: 'disponivel',
            },
          },
        },
      })
      criadas.push({ id: row.id, produtoId: linha.produtoId })
    }
    return criadas
  }

  if (params.tx) return run(params.tx)
  return repositorioDeRequisicoesWms.executarEmTransacao(run)
}
