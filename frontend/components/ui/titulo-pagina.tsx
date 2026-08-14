import { cn } from '@/lib/utils'

type Props = {
  children: React.ReactNode
  caminho?: React.ReactNode
  subtitulo?: React.ReactNode
  aoLadoDoTitulo?: React.ReactNode
  centralizado?: boolean
  className?: string
  classNameTitulo?: string
}

export function TituloPagina({
  children,
  caminho,
  subtitulo,
  aoLadoDoTitulo,
  centralizado,
  className,
  classNameTitulo,
}: Props) {
  return (
    <div className={className}>
      {caminho ? <p className="text-sm text-muted-foreground">{caminho}</p> : null}
      <div
        className={cn(
          'flex flex-wrap items-center gap-3',
          caminho && 'mt-1',
          centralizado && 'justify-center'
        )}
      >
        <h1
          className={cn(
            'text-2xl font-bold tracking-tight text-foreground',
            classNameTitulo
          )}
        >
          {children}
        </h1>
        {aoLadoDoTitulo}
      </div>
      {subtitulo ? (
        <div className="mt-1 text-sm text-muted-foreground">{subtitulo}</div>
      ) : null}
    </div>
  )
}
