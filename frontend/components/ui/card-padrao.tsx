import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Props = {
  titulo?: string
  descricao?: string
  acoes?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** Permite menus/dropdowns absolutos no header sem serem cortados pelo card */
  permitirOverflow?: boolean
  /** Padding interno reduzido (spacing 4 em vez de 6) */
  compacto?: boolean
}

export function CardPadrao({
  titulo,
  descricao,
  acoes,
  children,
  className,
  permitirOverflow,
  compacto,
}: Props) {
  return (
    <Card
      size={compacto ? 'sm' : 'default'}
      className={cn(permitirOverflow && '!overflow-visible', className)}
    >
      {(titulo || descricao || acoes) && (
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              {titulo && <CardTitle>{titulo}</CardTitle>}
              {descricao && <CardDescription>{descricao}</CardDescription>}
            </div>
            {acoes && (
              <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent
        className={
          !titulo && !descricao && !acoes ? (compacto ? 'pt-4' : 'pt-6') : undefined
        }
      >
        {children}
      </CardContent>
    </Card>
  )
}
