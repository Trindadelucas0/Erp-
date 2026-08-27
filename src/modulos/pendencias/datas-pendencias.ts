/**
 * Datas e urgência para pendências financeiras (testável sem banco).
 */
import type { UrgenciaPendencia } from './tipos-pendencias.js'
import { DIAS_A_VENCER } from './tipos-pendencias.js'

/** Meia-noite local do dia corrente. */
export function inicioDoDia(ref: Date = new Date()): Date {
  const d = new Date(ref)
  d.setHours(0, 0, 0, 0)
  return d
}

export function adicionarDias(base: Date, dias: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + dias)
  return d
}

/** YYYY-MM-DD local. */
export function isoDataLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

/** Competência YYYY-MM da data. */
export function competenciaDeData(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/**
 * Dias até o vencimento (0 = hoje, negativo = atrasado).
 * Compara só a data (ignora hora).
 */
export function diasAteVencimento(vencimento: Date, hoje: Date = new Date()): number {
  const v = inicioDoDia(vencimento)
  const h = inicioDoDia(hoje)
  return Math.round((v.getTime() - h.getTime()) / 86400000)
}

export function urgenciaPorVencimento(
  vencimento: Date,
  hoje: Date = new Date(),
  janelaDias = DIAS_A_VENCER
): UrgenciaPendencia | null {
  const dias = diasAteVencimento(vencimento, hoje)
  if (dias < 0) return 'vencido'
  if (dias === 0) return 'hoje'
  if (dias <= janelaDias) return 'semana'
  return null
}

export function formatarMoedaBr(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarQtd(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
}
