import { cn } from '@/lib/utils'

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

export function rotuloTipoNivel(nivel: number): 'Grupo' | 'Subgrupo' | null {
  if (nivel === 0) return 'Grupo'
  if (nivel >= 1) return 'Subgrupo'
  return null
}

export function classesBadgeTipoNivel(nivel: number): string {
  return cn(
    'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
    nivel === 0 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
  )
}

export function rotuloPosicaoDrop(posicao: 'antes' | 'depois' | 'dentro'): string {
  if (posicao === 'antes') return 'Antes'
  if (posicao === 'depois') return 'Depois'
  return 'Dentro'
}
