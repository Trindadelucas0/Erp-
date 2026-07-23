/**
 * Logs do módulo Focus NFe — prefixo [focus-nfe], sem token/XML.
 */
type Nivel = 'info' | 'warn' | 'error'

/** Linha legível do lote CT-e ↔ NF (console.table). */
export type LinhaTabelaVinculoCte = {
  etapa: string
  chaveNF: string
  http: string | number
  resultado: string
  oQueFazer: string
}

function verboseAtivo(): boolean {
  return process.env.FOCUS_NFE_LOG_VERBOSE === 'true'
}

function serializarDados(dados?: Record<string, unknown>): string {
  if (!dados || Object.keys(dados).length === 0) return ''
  return (
    ' ' +
    Object.entries(dados)
      .map(([chave, valor]) => `${chave}=${String(valor)}`)
      .join(' ')
  )
}

export function logFocus(
  nivel: Nivel,
  evento: string,
  dados?: Record<string, unknown>
): void {
  const linha = `[focus-nfe] ${evento}${serializarDados(dados)}`
  if (nivel === 'error') {
    console.error(linha)
    return
  }
  if (nivel === 'warn') {
    console.warn(linha)
    return
  }
  console.log(linha)
}

export function logFocusVerbose(
  evento: string,
  dados?: Record<string, unknown>
): void {
  if (!verboseAtivo()) return
  logFocus('info', evento, dados)
}

/**
 * Resumo legível do lote de vínculo CT-e (todas as chaves de uma vez).
 * Mantém os logs warn/info detalhados; a table é o que o operador lê no terminal.
 */
export function logTabelaVinculoCte(
  titulo: string,
  linhas: LinhaTabelaVinculoCte[],
  resumo?: Record<string, unknown>
): void {
  console.log(`[entrada-cte] ${titulo}`)
  if (linhas.length > 0) {
    console.table(linhas)
  } else {
    console.log('[entrada-cte] (nenhuma linha no lote)')
  }
  if (resumo && Object.keys(resumo).length > 0) {
    logFocus('info', 'cte_vinculos_lote_resumo', resumo)
  }
}
