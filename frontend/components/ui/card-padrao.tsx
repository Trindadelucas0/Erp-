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
}

export function CardPadrao({
  titulo,
  descricao,
  acoes,
  children,
  className,
  permitirOverflow,
}: Props) {
  return (
    <Card className={cn(permitirOverflow && '!overflow-visible', className)}>
      {(titulo || descricao || acoes) && (
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {titulo && <CardTitle>{titulo}</CardTitle>}
              {descricao && <CardDescription>{descricao}</CardDescription>}
            </div>
            {acoes && <div className="shrink-0">{acoes}</div>}
          </div>
        </CardHeader>
      )}
      <CardContent className={!titulo && !descricao && !acoes ? 'pt-6' : undefined}>
        {children}
      </CardContent>
    </Card>
  )
}
