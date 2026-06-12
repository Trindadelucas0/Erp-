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
  children: React.ReactNode
  className?: string
}

export function CardPadrao({ titulo, descricao, children, className }: Props) {
  return (
    <Card className={cn(className)}>
      {(titulo || descricao) && (
        <CardHeader>
          {titulo && <CardTitle>{titulo}</CardTitle>}
          {descricao && <CardDescription>{descricao}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className={!titulo && !descricao ? 'pt-6' : undefined}>
        {children}
      </CardContent>
    </Card>
  )
}
