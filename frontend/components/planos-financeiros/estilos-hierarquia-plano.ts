export function classesNomePorNivel(nivel: number, _temFilhos: boolean): string {
  if (nivel === 0) {
    return 'font-bold text-foreground'
  }
  if (nivel === 1) {
    return 'font-semibold text-foreground/90'
  }
  return 'font-medium text-muted-foreground'
}

export function classesLinhaPorNivel(nivel: number): string {
  if (nivel === 0) return ''
  if (nivel === 1) return 'bg-muted/25'
  return 'bg-muted/40'
}

export function rotuloPosicaoDrop(posicao: 'antes' | 'depois' | 'dentro'): string {
  if (posicao === 'antes') return 'Antes'
  if (posicao === 'depois') return 'Depois'
  return 'Dentro'
}
