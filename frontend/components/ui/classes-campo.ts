import { cn } from '@/lib/utils'

/** Estilo compartilhado de campo (input, select, busca) — borda visível, sem peso extra. */
export const classesCampoBase = cn(
  'w-full min-w-0 rounded-md border border-input bg-background',
  'px-3 text-sm text-foreground',
  'shadow-none outline-none transition-[color,box-shadow,border-color]',
  'placeholder:text-muted-foreground',
  'hover:border-foreground/25',
  'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20',
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  'aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20',
  'dark:bg-input/30 dark:hover:border-foreground/35',
  'dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40'
)

export const classesCampo = cn(classesCampoBase, 'h-10 py-2')

/** Barra de lista / campo ao lado de botão — mesma borda, altura alinhada ao botão. */
export const classesCampoLista = cn(classesCampoBase, 'h-9 py-1')

export const classesCampoCompacto = cn(classesCampoBase, 'h-8 px-2 py-1')

export const classesCampoAcao = cn(
  'flex size-10 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground',
  'hover:bg-muted hover:text-destructive',
  'disabled:cursor-not-allowed disabled:opacity-50'
)
