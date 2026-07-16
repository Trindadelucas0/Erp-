import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Variante = 'ativo' | 'inativo' | 'info' | 'pendente' | 'reprovado' | 'aguardando' | 'sucesso'

type Props = {
  variante: Variante
  children: React.ReactNode
  className?: string
  title?: string
}

const ESTILOS_POR_VARIANTE: Record<Variante, string> = {
  ativo: 'bg-primary/15 text-primary hover:bg-primary/15',
  inativo: 'bg-muted text-muted-foreground hover:bg-muted',
  info: 'bg-secondary text-secondary-foreground hover:bg-secondary',
  pendente: 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/15',
  reprovado: 'bg-destructive/15 text-destructive hover:bg-destructive/15',
  aguardando: 'bg-blue-500/15 text-blue-700 hover:bg-blue-500/15',
  sucesso: 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15',
}

export function BadgeStatus({ variante, children, className, title }: Props) {
  return (
    <Badge
      variant="secondary"
      title={title}
      className={cn(
        ESTILOS_POR_VARIANTE[variante],
        'max-w-full shrink',
        className
      )}
    >
      <span className="truncate">{children}</span>
    </Badge>
  )
}
