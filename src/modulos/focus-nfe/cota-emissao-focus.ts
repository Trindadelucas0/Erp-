/**
 * Cota comercial mensal de emissão Focus (esqueleto).
 * Espelha cota-focus-nfe.ts; ainda não há módulo/tabela de emissão —
 * usados permanece 0 até existir emissão real.
 */
import {
  intervaloMesAtualSaoPaulo,
} from './cota-focus-nfe.js'
import { lerBoolEnvFocus, lerIntEnvFocus } from './config-rate-limit-focus-nfe.js'

export type SaldoCotaEmissaoFocus = {
  habilitada: boolean
  /** Sempre 0 enquanto não houver emissão implementada. */
  usados: number
  cota: number
  restantes: number
  mesReferencia: string
  /** Indica que o contador ainda é stub (sem ledger de emissão). */
  stub: true
}

/** Parâmetros do .env (sem consulta ao banco). */
export function lerConfigCotaEmissaoFocus(): {
  habilitada: boolean
  cota: number
} {
  const cota = lerIntEnvFocus('FOCUS_NFE_COTA_EMISSAO_MENSAL', 100)
  const habilitadaEnv = lerBoolEnvFocus('FOCUS_NFE_COTA_EMISSAO_HABILITADA', true)
  return {
    habilitada: habilitadaEnv && cota > 0,
    cota,
  }
}

/**
 * Saldo da reserva de emissão. `usados=0` até existir emissão —
 * não inventa consumo.
 */
export async function saldoCotaEmissaoFocus(
  _companyId: string
): Promise<SaldoCotaEmissaoFocus> {
  const config = lerConfigCotaEmissaoFocus()
  const { mesReferencia } = intervaloMesAtualSaoPaulo()
  if (!config.habilitada) {
    return {
      habilitada: false,
      usados: 0,
      cota: config.cota,
      restantes: Number.MAX_SAFE_INTEGER,
      mesReferencia,
      stub: true,
    }
  }
  const usados = 0
  return {
    habilitada: true,
    usados,
    cota: config.cota,
    restantes: Math.max(0, config.cota - usados),
    mesReferencia,
    stub: true,
  }
}
