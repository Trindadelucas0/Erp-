import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  STATUS_BLOQUEAVEIS,
  STATUS_CANCELAVEIS,
  STATUS_FINAIS,
  type StatusRequisicao,
} from './tipos-requisicao-wms.js'

export type AcaoStatusRequisicao =
  | 'disponibilizar'
  | 'atribuir'
  | 'iniciar'
  | 'pausar'
  | 'retomar'
  | 'concluir'
  | 'cancelar'
  | 'bloquear'
  | 'desbloquear'

const DE: Record<AcaoStatusRequisicao, readonly StatusRequisicao[]> = {
  disponibilizar: ['pendente'],
  atribuir: ['pendente', 'disponivel', 'atribuida'],
  iniciar: ['disponivel', 'atribuida'],
  pausar: ['em_execucao'],
  retomar: ['pausada'],
  concluir: ['em_execucao'],
  cancelar: STATUS_CANCELAVEIS,
  bloquear: STATUS_BLOQUEAVEIS,
  desbloquear: ['bloqueada'],
}

const PARA: Record<Exclude<AcaoStatusRequisicao, 'desbloquear' | 'iniciar' | 'atribuir'>, StatusRequisicao> =
  {
    disponibilizar: 'disponivel',
    pausar: 'pausada',
    retomar: 'em_execucao',
    concluir: 'concluida',
    cancelar: 'cancelada',
    bloquear: 'bloqueada',
  }

export function acaoPermitidaNoStatus(
  acao: AcaoStatusRequisicao,
  status: string
): boolean {
  const origem = DE[acao]
  return origem.includes(status as StatusRequisicao)
}

export function exigirTransicao(acao: AcaoStatusRequisicao, status: string): void {
  if (!acaoPermitidaNoStatus(acao, status)) {
    throw new ErroDaAplicacao(
      `Não é possível ${acao} uma requisição com status ${status}.`,
      409
    )
  }
}

export function statusAposAcao(
  acao: AcaoStatusRequisicao,
  statusAtual: string,
  temResponsavel: boolean
): StatusRequisicao {
  exigirTransicao(acao, statusAtual)
  if (acao === 'atribuir') return 'atribuida'
  if (acao === 'iniciar') return 'em_execucao'
  if (acao === 'desbloquear') return temResponsavel ? 'atribuida' : 'disponivel'
  return PARA[acao]
}

export function edicaoPermitida(status: string): boolean {
  return !STATUS_FINAIS.includes(status as StatusRequisicao)
}
