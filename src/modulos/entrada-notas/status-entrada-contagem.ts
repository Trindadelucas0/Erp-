/**
 * Status do ciclo Liberar → Contagem logística → Consolidar.
 * Fonte: DOCUMENTACAO-SISTEMA.md §7 (contagem cega).
 */

export const STATUS_AGUARDANDO_CONTAGEM = 'entrada_contagem' as const
export const STATUS_CONTAGEM_OK = 'entrada_contagem_ok' as const
export const STATUS_CONTAGEM_DIVERGENTE = 'entrada_contagem_divergente' as const
export const STATUS_CONSOLIDADA = 'entrada_consolidada' as const

/**
 * Status pós-lançamento de NFe 55 com item de produto (contagem física) — retém a nota
 * antes da contagem até o operador clicar "Liberar para contagem" (§7.19 DOCUMENTACAO-SISTEMA.md).
 */
export const STATUS_AGUARDANDO_CHEGADA = 'aguardando_chegada' as const

/** Painel "Liberadas p/ contagem" — inclui OK e divergente até consolidar/corrigir. */
export const STATUS_PAINEL_CONTAGEM: readonly string[] = [
  STATUS_AGUARDANDO_CONTAGEM,
  STATUS_CONTAGEM_OK,
  STATUS_CONTAGEM_DIVERGENTE,
]

/** Nota já saiu do pipeline de análise (liberada ou além — inclui "aguardando chegada"). */
export const STATUS_POS_LIBERACAO: readonly string[] = [
  STATUS_AGUARDANDO_CHEGADA,
  ...STATUS_PAINEL_CONTAGEM,
  STATUS_CONSOLIDADA,
]

export const STATUS_SESSAO_CONTAGEM_ATIVA: readonly string[] = ['aberta', 'em_andamento']

export function notaEstaNoPainelContagem(status: string): boolean {
  return STATUS_PAINEL_CONTAGEM.includes(status)
}

export function notaJaLiberadaOuConsolidada(status: string): boolean {
  return STATUS_POS_LIBERACAO.includes(status)
}

/** Logística só inicia contagem física em NFes aguardando (não OK/divergente). */
export function podeIniciarContagemLogistica(status: string): boolean {
  return status === STATUS_AGUARDANDO_CONTAGEM
}

/** Só nota "aguardando chegada" pode ser liberada para o painel de contagem. */
export function podeLiberarParaContagem(status: string): boolean {
  return status === STATUS_AGUARDANDO_CHEGADA
}

/**
 * Consolidar estoque:
 * - NFe 55 com produtos: só após contagem logística OK.
 * - Documental (NFS-e/CT-e / sem itens de produto): pode consolidar após liberar
 *   (`entrada_contagem`) ou ainda no pipeline (gate em `lancar`); nunca se divergente.
 */
export function podeConsolidarEstoque(
  status: string,
  opcoes: { exigeContagemFisica: boolean }
): boolean {
  if (
    status === STATUS_CONSOLIDADA ||
    status === 'cancelada' ||
    status === 'com_problema' ||
    status === 'problema_resolvido'
  ) {
    return false
  }
  if (opcoes.exigeContagemFisica) {
    return status === STATUS_CONTAGEM_OK
  }
  if (status === STATUS_CONTAGEM_DIVERGENTE) return false
  return true
}

export function mensagemBloqueioConsolidar(status: string): string {
  if (status === STATUS_CONTAGEM_DIVERGENTE) {
    return 'Contagem divergente pendente de correção administrativa. Não é possível consolidar estoque.'
  }
  if (status === STATUS_AGUARDANDO_CONTAGEM) {
    return 'Finalize a contagem logística (tela Contagens de entrada) antes de consolidar estoque.'
  }
  return 'Nota não está pronta para consolidar estoque.'
}
