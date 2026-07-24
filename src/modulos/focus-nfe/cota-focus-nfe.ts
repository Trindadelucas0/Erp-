/**
 * Cota comercial mensal de notas puxadas da Focus (por empresa).
 * Conta só NfeRecebida novas com origem=focus no mês corrente (America/Sao_Paulo).
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

export type SaldoCotaFocus = {
  habilitada: boolean
  usados: number
  cota: number
  restantes: number
  mesReferencia: string
  custoExtraCentavos: number
}

function lerBoolEnv(nome: string, padrao: boolean): boolean {
  const raw = process.env[nome]?.trim().toLowerCase()
  if (raw === undefined || raw === '') return padrao
  if (raw === 'false' || raw === '0' || raw === 'nao' || raw === 'não') return false
  if (raw === 'true' || raw === '1' || raw === 'sim') return true
  return padrao
}

function lerIntEnv(nome: string, padrao: number): number {
  const raw = process.env[nome]?.trim()
  if (!raw) return padrao
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return padrao
  return Math.floor(n)
}

/** Parâmetros do .env (sem consulta ao banco). */
export function lerConfigCotaFocus(): {
  habilitada: boolean
  cota: number
  custoExtraCentavos: number
} {
  const cota = lerIntEnv('FOCUS_NFE_COTA_MENSAL', 100)
  const habilitadaEnv = lerBoolEnv('FOCUS_NFE_COTA_HABILITADA', true)
  return {
    habilitada: habilitadaEnv && cota > 0,
    cota,
    custoExtraCentavos: lerIntEnv('FOCUS_NFE_CUSTO_EXTRA_CENTAVOS', 10),
  }
}

/** Início/fim do mês civil em America/Sao_Paulo (BRT fixo UTC-3). */
export function intervaloMesAtualSaoPaulo(agora = new Date()): {
  inicio: Date
  fim: Date
  mesReferencia: string
} {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(agora)
  const y = Number(parts.find((p) => p.type === 'year')?.value)
  const m = Number(parts.find((p) => p.type === 'month')?.value)
  if (!y || !m) {
    const fallback = new Date()
    const yy = fallback.getFullYear()
    const mm = fallback.getMonth() + 1
    const inicio = new Date(`${yy}-${String(mm).padStart(2, '0')}-01T00:00:00-03:00`)
    const proximoMes = mm === 12 ? 1 : mm + 1
    const proximoAno = mm === 12 ? yy + 1 : yy
    const fim = new Date(
      `${proximoAno}-${String(proximoMes).padStart(2, '0')}-01T00:00:00-03:00`
    )
    return { inicio, fim, mesReferencia: `${yy}-${String(mm).padStart(2, '0')}` }
  }

  const mes = String(m).padStart(2, '0')
  const inicio = new Date(`${y}-${mes}-01T00:00:00-03:00`)
  const proximoMes = m === 12 ? 1 : m + 1
  const proximoAno = m === 12 ? y + 1 : y
  const fim = new Date(
    `${proximoAno}-${String(proximoMes).padStart(2, '0')}-01T00:00:00-03:00`
  )
  return { inicio, fim, mesReferencia: `${y}-${mes}` }
}

export async function contarUsoMesFocus(companyId: string): Promise<number> {
  const { inicio, fim } = intervaloMesAtualSaoPaulo()
  return clientePrisma.nfeRecebida.count({
    where: {
      companyId,
      origem: 'focus',
      createdAt: { gte: inicio, lt: fim },
    },
  })
}

export async function saldoCotaFocus(companyId: string): Promise<SaldoCotaFocus> {
  const config = lerConfigCotaFocus()
  const { mesReferencia } = intervaloMesAtualSaoPaulo()
  if (!config.habilitada) {
    return {
      habilitada: false,
      usados: 0,
      cota: config.cota,
      restantes: Number.MAX_SAFE_INTEGER,
      mesReferencia,
      custoExtraCentavos: config.custoExtraCentavos,
    }
  }

  const usados = await contarUsoMesFocus(companyId)
  const restantes = Math.max(0, config.cota - usados)
  return {
    habilitada: true,
    usados,
    cota: config.cota,
    restantes,
    mesReferencia,
    custoExtraCentavos: config.custoExtraCentavos,
  }
}

/** True quando a cota está esgotada e o sync automático deve pausar. */
export async function cotaEsgotadaParaAgendador(companyId: string): Promise<boolean> {
  const saldo = await saldoCotaFocus(companyId)
  return saldo.habilitada && saldo.restantes <= 0
}
