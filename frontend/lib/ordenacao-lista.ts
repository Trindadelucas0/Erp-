export type DirecaoOrdenacao = 'asc' | 'desc'

export type EstadoOrdenacao<T extends string> = {
  coluna: T
  direcao: DirecaoOrdenacao
} | null

export type ValorOrdenacao = string | number | boolean | Date | null | undefined

export function compararTextoPtBr(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
}

export function alternarEstadoOrdenacao<T extends string>(
  coluna: T,
  atual: EstadoOrdenacao<T>
): EstadoOrdenacao<T> {
  if (!atual || atual.coluna !== coluna) {
    return { coluna, direcao: 'asc' }
  }
  if (atual.direcao === 'asc') {
    return { coluna, direcao: 'desc' }
  }
  return null
}

function normalizarValor(valor: ValorOrdenacao): string | number {
  if (valor == null) return ''
  if (valor instanceof Date) return valor.getTime()
  if (typeof valor === 'boolean') return valor ? 1 : 0
  if (typeof valor === 'number') return valor
  return String(valor)
}

function compararValores(a: ValorOrdenacao, b: ValorOrdenacao): number {
  const va = normalizarValor(a)
  const vb = normalizarValor(b)
  if (typeof va === 'number' && typeof vb === 'number') {
    return va - vb
  }
  return compararTextoPtBr(String(va), String(vb))
}

export function ordenarLista<T, C extends string>(
  lista: T[],
  ordenacao: EstadoOrdenacao<C>,
  obterValor: (item: T, coluna: C) => ValorOrdenacao
): T[] {
  if (!ordenacao) return lista
  const fator = ordenacao.direcao === 'asc' ? 1 : -1
  return [...lista].sort(
    (a, b) => compararValores(obterValor(a, ordenacao.coluna), obterValor(b, ordenacao.coluna)) * fator
  )
}

export function ordenarArvore<T extends { filhos?: T[] }, C extends string>(
  nos: T[],
  ordenacao: EstadoOrdenacao<C>,
  obterValor: (item: T, coluna: C) => ValorOrdenacao
): T[] {
  if (!ordenacao) return nos
  const fator = ordenacao.direcao === 'asc' ? 1 : -1
  const ordenados = [...nos].sort(
    (a, b) => compararValores(obterValor(a, ordenacao.coluna), obterValor(b, ordenacao.coluna)) * fator
  )
  return ordenados.map((no) => ({
    ...no,
    filhos: no.filhos?.length
      ? ordenarArvore(no.filhos, ordenacao, obterValor)
      : no.filhos,
  }))
}

export function compararDocumento(a?: string | null, b?: string | null): number {
  const da = (a ?? '').replace(/\D/g, '')
  const db = (b ?? '').replace(/\D/g, '')
  return compararTextoPtBr(da, db)
}
