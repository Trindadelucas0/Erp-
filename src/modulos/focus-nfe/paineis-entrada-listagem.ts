import {
  STATUS_AGUARDANDO_CHEGADA,
  STATUS_PAINEL_CONTAGEM,
  STATUS_PAINEL_PRONTA_CONSOLIDAR,
} from '../entrada-notas/status-entrada-contagem.js'

/** Painéis da lista `/entrada-notas` aceitos em GET /focus-nfe/nfe-recebidas?painel= */
export const PAINEIS_ENTRADA_LISTAGEM = [
  'analise',
  'aguardando_chegada',
  'contagem',
  'pronta_consolidar',
  'consolidada',
  'problemas',
  'cancelada',
] as const

export type PainelEntradaListagem = (typeof PAINEIS_ENTRADA_LISTAGEM)[number]

export const PAINEIS_ENTRADA_ADMINISTRATIVO = [
  'aguardando_chegada',
  'contagem',
  'problemas',
] as const satisfies readonly PainelEntradaListagem[]

export const STATUS_ENTRADA_POR_PAINEL_LISTAGEM: Record<
  PainelEntradaListagem,
  readonly string[]
> = {
  analise: ['pendente', 'em_analise', 'stand_by'],
  aguardando_chegada: [STATUS_AGUARDANDO_CHEGADA],
  contagem: [...STATUS_PAINEL_CONTAGEM],
  pronta_consolidar: [...STATUS_PAINEL_PRONTA_CONSOLIDAR],
  consolidada: ['entrada_consolidada'],
  problemas: ['com_problema', 'problema_resolvido'],
  cancelada: ['cancelada'],
}

export function parsePainelEntradaListagem(
  painelRaw: string | null | undefined
): PainelEntradaListagem | null {
  const raw = (painelRaw ?? '').trim().toLowerCase()
  if (!raw) return null
  return PAINEIS_ENTRADA_LISTAGEM.includes(raw as PainelEntradaListagem)
    ? (raw as PainelEntradaListagem)
    : null
}

export function normalizarPainelEntradaListagem(
  painelRaw: string | null | undefined
): PainelEntradaListagem {
  return parsePainelEntradaListagem(painelRaw) ?? 'analise'
}

export function painelDaListagemPorStatusEntrada(
  statusEntrada: string
): PainelEntradaListagem | null {
  for (const painel of PAINEIS_ENTRADA_LISTAGEM) {
    if (STATUS_ENTRADA_POR_PAINEL_LISTAGEM[painel].includes(statusEntrada)) {
      return painel
    }
  }
  return null
}

export function painelEntradaAdministrativoPermitido(
  painel: PainelEntradaListagem
): boolean {
  return (PAINEIS_ENTRADA_ADMINISTRATIVO as readonly string[]).includes(painel)
}
