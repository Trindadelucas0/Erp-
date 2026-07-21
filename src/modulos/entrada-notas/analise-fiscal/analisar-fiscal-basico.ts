/**
 * Gate das regras fiscais de entrada.
 * Com regrasFiscaisJson.ativo=false a análise não bloqueia.
 */
export type ResultadoAnaliseFiscal = {
  status: 'ok' | 'pendente_configuracao' | 'divergente' | 'bloqueante'
  avisos: string[]
  bloqueios: string[]
}

export type RegrasFiscaisJson = {
  versaoSchema?: number
  ativo?: boolean
  checks?: string[]
  observacao?: string
}

export function analisarFiscalBasico(
  regras: RegrasFiscaisJson | null | undefined
): ResultadoAnaliseFiscal {
  if (!regras || regras.ativo !== true) {
    return {
      status: 'pendente_configuracao',
      avisos: ['Análise fiscal desligada (ativo=false).'],
      bloqueios: [],
    }
  }

  return {
    status: 'ok',
    avisos: [],
    bloqueios: [],
  }
}
