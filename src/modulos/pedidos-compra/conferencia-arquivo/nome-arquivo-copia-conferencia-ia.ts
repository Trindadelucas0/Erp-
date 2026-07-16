export function formatarTimestampConferenciaIa(data: Date): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(data)

  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? '00'

  return `${valor('day')}-${valor('month')}-${valor('year')} ${valor('hour')}h${valor('minute')}`
}

export function nomeArquivoCopiaConferenciaIa(nomeOriginal: string, conferidoEm: Date): string {
  const base = nomeOriginal.replace(/\.[^.]+$/, '')
  return `Conferência IA - ${base} - ${formatarTimestampConferenciaIa(conferidoEm)}.pdf`
}
