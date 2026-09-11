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

export function normalizarPainelEntradaListagem(
  painelRaw: string | null | undefined
): PainelEntradaListagem {
  const raw = (painelRaw ?? 'analise').toLowerCase()
  return PAINEIS_ENTRADA_LISTAGEM.includes(raw as PainelEntradaListagem)
    ? (raw as PainelEntradaListagem)
    : 'analise'
}
