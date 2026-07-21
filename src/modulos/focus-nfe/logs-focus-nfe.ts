/**
 * Logs do módulo Focus NFe — prefixo [focus-nfe], sem token/XML.
 */
type Nivel = 'info' | 'warn' | 'error'

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
