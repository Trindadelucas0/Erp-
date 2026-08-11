/**
 * Normaliza texto de prazo (datas da NF ou dias do pedido) para sequência de dias.
 * Datas: dias = vencimento − emissão (calendário, meio-dia).
 */

const MS_DIA = 1000 * 60 * 60 * 24

function chaveDiaLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDataCalendario(texto: string): Date | null {
  const t = texto.trim()
  if (!t) return null
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00`)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const br = t.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/)
  if (br) {
    const d = new Date(
      `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}T12:00:00`
    )
    return Number.isNaN(d.getTime()) ? null : d
  }
  const fallback = new Date(t)
  if (Number.isNaN(fallback.getTime())) return null
  return new Date(`${chaveDiaLocal(fallback)}T12:00:00`)
}

function diasEntre(emissao: Date, vencimento: Date): number {
  const a = new Date(`${chaveDiaLocal(emissao)}T12:00:00`)
  const b = new Date(`${chaveDiaLocal(vencimento)}T12:00:00`)
  return Math.round((b.getTime() - a.getTime()) / MS_DIA)
}

function extrairDatasDoTexto(texto: string): Date[] {
  const datas: Date[] = []
  const iso = [...texto.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)]
  for (const m of iso) {
    const d = parseDataCalendario(m[1])
    if (d) datas.push(d)
  }
  if (datas.length > 0) return datas
  const br = [...texto.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)]
  for (const m of br) {
    const d = parseDataCalendario(
      `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    )
    if (d) datas.push(d)
  }
  return datas
}

function extrairDiasDoTexto(texto: string): number[] | null {
  const lower = texto.trim().toLowerCase()
  if (!lower) return null
  if (/^à\s*vista$|^a\s*vista$|^avista$/.test(lower)) return [0]

  const numeros = [...lower.matchAll(/\d+/g)]
    .map((m) => Number(m[0]))
    .filter((n) => Number.isFinite(n) && n >= 0)
  return numeros.length > 0 ? numeros : null
}

export function formatarDiasPrazo(dias: number[]): string {
  return dias.map((d) => String(d)).join('/')
}

export function prazosIguais(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  return a.every((d, i) => d === b[i])
}

/**
 * Converte texto de prazo em dias.
 * - Com datas: exige `dataEmissao`; retorna null se emissão ausente ou dia negativo.
 * - Sem datas: extrai números (ex.: `28/42/56`, `30 dias`).
 */
export function normalizarPrazoParaDias(
  texto: string | null | undefined,
  dataEmissao?: Date | string | null
): number[] | null {
  const raw = (texto ?? '').trim()
  if (!raw) return null

  const datas = extrairDatasDoTexto(raw)
  if (datas.length > 0) {
    if (dataEmissao == null || dataEmissao === '') return null
    const emissao =
      typeof dataEmissao === 'string'
        ? parseDataCalendario(dataEmissao) ??
          (Number.isNaN(new Date(dataEmissao).getTime())
            ? null
            : new Date(`${chaveDiaLocal(new Date(dataEmissao))}T12:00:00`))
        : new Date(`${chaveDiaLocal(dataEmissao)}T12:00:00`)
    if (!emissao || Number.isNaN(emissao.getTime())) return null

    const dias: number[] = []
    for (const venc of datas) {
      const d = diasEntre(emissao, venc)
      if (d < 0) return null
      dias.push(d)
    }
    return dias
  }

  return extrairDiasDoTexto(raw)
}
