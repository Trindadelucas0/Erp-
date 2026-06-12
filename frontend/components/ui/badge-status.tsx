import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Variante = 'ativo' | 'inativo' | 'info'

type Props = {
  variante: Variante
  children: React.ReactNode
  className?: string
}

const ESTILOS_POR_VARIANTE: Record<Variante, string> = {
  ativo: 'bg-primary/15 text-primary hover:bg-primary/15',
  inativo: 'bg-muted text-muted-foreground hover:bg-muted',
  info: 'bg-secondary text-secondary-foreground hover:bg-secondary',
}

export function BadgeStatus({ variante, children, className }: Props) {
  return (
    <Badge
      variant="secondary"
      className={cn(ESTILOS_POR_VARIANTE[variante], className)}
    >
      {children}
    </Badge>
  )
}
