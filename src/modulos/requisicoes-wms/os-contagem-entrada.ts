import type { Prisma } from '@prisma/client'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { repositorioDeRequisicoesWms } from './repositorio-requisicoes-wms.js'

export const TIPO_OS_CONTAGEM_ENTRADA = 'contagem_entrada' as const

export const STATUS_OS_CONTAGEM_ABERTA = ['atribuida', 'em_execucao', 'pausada'] as const

export type ResumoOsContagemEntrada = {
  nfeRecebidaId: string
  requisicaoContagemId: string
  requisicaoContagemNumero: number
  contagemResponsavelId: string | null
  contagemResponsavelNome: string | null
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

export function observacaoOsContagemEntrada(chaveNfe: string) {
  const { serie, numero } = serieNumeroDaChave(chaveNfe)
  return `Contagem de entrada — NF ${numero ?? '—'} série ${serie ?? '—'}`
}

export function osContagemEstaAberta(status: string) {
  return (STATUS_OS_CONTAGEM_ABERTA as readonly string[]).includes(status)
}

function mapearResumo(row: {
  id: string
  numero: number
  nfeRecebidaId: string | null
  status: string
  responsavelId: string | null
  responsavel?: { id: string; name: string } | null
}): ResumoOsContagemEntrada | null {
  if (!row.nfeRecebidaId) return null
  return {
    nfeRecebidaId: row.nfeRecebidaId,
    requisicaoContagemId: row.id,
    requisicaoContagemNumero: row.numero,
    contagemResponsavelId: row.responsavelId,
    contagemResponsavelNome: row.responsavel?.name ?? null,
    status: row.status,
  }
}

export async function listarResumoOsContagemPorNfeIds(
  companyId: string,
  nfeRecebidaIds: string[]
): Promise<Map<string, ResumoOsContagemEntrada>> {
  const mapa = new Map<string, ResumoOsContagemEntrada>()
  const rows = await repositorioDeRequisicoesWms.listarPorNfeRecebidaIds(companyId, nfeRecebidaIds)
  for (const row of rows) {
    const resumo = mapearResumo(row)
    if (!resumo) continue
    const atual = mapa.get(resumo.nfeRecebidaId)
    if (!atual || (osContagemEstaAberta(resumo.status) && !osContagemEstaAberta(atual.status))) {
      mapa.set(resumo.nfeRecebidaId, resumo)
    }
  }
  return mapa
}

export async function obterResumoOsContagemDaNota(companyId: string, nfeRecebidaId: string) {
  const mapa = await listarResumoOsContagemPorNfeIds(companyId, [nfeRecebidaId])
  return mapa.get(nfeRecebidaId) ?? null
}

export async function criarOuReabrirOsContagemEntrada(params: {
  companyId: string
  nfeRecebidaId: string
  chaveNfe: string
  responsavelId: string
  usuarioId: string
  tx?: Prisma.TransactionClient
}) {
  const observacao = observacaoOsContagemEntrada(params.chaveNfe)
  const run = async (tx: Prisma.TransactionClient) => {
    const existente = await repositorioDeRequisicoesWms.buscarPorNfeRecebida(
      params.companyId,
      params.nfeRecebidaId,
      tx
    )
    if (existente) {
      return repositorioDeRequisicoesWms.atualizarNoTx(
        tx,
        params.companyId,
        existente.id,
        {
          status: 'atribuida',
          responsavelId: params.responsavelId,
          observacao,
          nfeRecebidaId: params.nfeRecebidaId,
          produtoId: null,
          origemEnderecoId: null,
          destinoEnderecoId: null,
          quantidade: null,
          iniciadoEm: null,
          pausadoEm: null,
          concluidoEm: null,
        },
        {
          usuarioId: params.usuarioId,
          acao: 'atribuir',
          deStatus: existente.status,
          paraStatus: 'atribuida',
        }
      )
    }
    const numero = await repositorioDeRequisicoesWms.proximoNumero(params.companyId, tx)
    return tx.requisicaoWms.create({
      data: {
        companyId: params.companyId,
        numero,
        tipoOperacao: TIPO_OS_CONTAGEM_ENTRADA,
        prioridade: 3,
        status: 'atribuida',
        origemEnderecoId: null,
        destinoEnderecoId: null,
        produtoId: null,
        quantidade: null,
        responsavelId: params.responsavelId,
        observacao,
        nfeRecebidaId: params.nfeRecebidaId,
        eventos: {
          create: {
            usuarioId: params.usuarioId,
            acao: 'atribuir',
            deStatus: null,
            paraStatus: 'atribuida',
          },
        },
      },
    })
  }

  if (params.tx) return run(params.tx)
  return repositorioDeRequisicoesWms.executarEmTransacao(run)
}

export async function concluirOsContagemDasNotas(params: {
  companyId: string
  nfeRecebidaIds: string[]
  usuarioId: string
}) {
  const rows = await repositorioDeRequisicoesWms.listarPorNfeRecebidaIds(
    params.companyId,
    params.nfeRecebidaIds
  )
  const agora = new Date()
  for (const row of rows) {
    if (!osContagemEstaAberta(row.status)) continue
    await repositorioDeRequisicoesWms.atualizar(
      params.companyId,
      row.id,
      { status: 'concluida', concluidoEm: agora },
      {
        usuarioId: params.usuarioId,
        acao: 'concluir',
        deStatus: row.status,
        paraStatus: 'concluida',
      }
    )
  }
}

export async function reabrirOsContagemDaNota(params: {
  companyId: string
  nfeRecebidaId: string
  usuarioId: string
}) {
  const existente = await repositorioDeRequisicoesWms.buscarPorNfeRecebida(
    params.companyId,
    params.nfeRecebidaId
  )
  if (!existente) return null
  if (existente.status === 'atribuida' && existente.responsavelId) return existente
  return repositorioDeRequisicoesWms.atualizar(
    params.companyId,
    existente.id,
    {
      status: 'atribuida',
      responsavelId: existente.responsavelId,
      iniciadoEm: null,
      pausadoEm: null,
      concluidoEm: null,
    },
    {
      usuarioId: params.usuarioId,
      acao: 'atribuir',
      deStatus: existente.status,
      paraStatus: 'atribuida',
    }
  )
}

export async function cancelarOsContagemDasNotas(params: {
  companyId: string
  nfeRecebidaIds: string[]
  usuarioId: string
  motivo: string
}) {
  const rows = await repositorioDeRequisicoesWms.listarPorNfeRecebidaIds(
    params.companyId,
    params.nfeRecebidaIds
  )
  for (const row of rows) {
    if (!osContagemEstaAberta(row.status) && row.status !== 'pendente' && row.status !== 'disponivel') {
      continue
    }
    await repositorioDeRequisicoesWms.atualizar(
      params.companyId,
      row.id,
      { status: 'cancelada', concluidoEm: new Date() },
      {
        usuarioId: params.usuarioId,
        acao: 'cancelar',
        deStatus: row.status,
        paraStatus: 'cancelada',
        motivo: params.motivo,
      }
    )
  }
}

export async function exigirResponsavelDaEmpresa(companyId: string, responsavelId: string) {
  const user = await repositorioDeRequisicoesWms.usuarioDaEmpresa(companyId, responsavelId)
  if (!user) {
    throw new ErroDaAplicacao('Responsável não pertence a esta empresa', 400)
  }
  return user
}

export async function gravarLiberacaoContagemComOs(params: {
  companyId: string
  notaId: string
  chaveNfe: string
  responsavelId: string
  usuarioId: string
  statusEntrada: string
}) {
  await exigirResponsavelDaEmpresa(params.companyId, params.responsavelId)
  return repositorioDeRequisicoesWms.executarEmTransacao(async (tx) => {
    await tx.nfeRecebida.update({
      where: { id: params.notaId },
      data: { statusEntrada: params.statusEntrada },
    })
    return criarOuReabrirOsContagemEntrada({
      companyId: params.companyId,
      nfeRecebidaId: params.notaId,
      chaveNfe: params.chaveNfe,
      responsavelId: params.responsavelId,
      usuarioId: params.usuarioId,
      tx,
    })
  })
}
