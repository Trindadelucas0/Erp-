import { cn } from '@/lib/utils'

type Props = {
  children: React.ReactNode
  className?: string
}

export function TituloSecao({ children, className }: Props) {
  return (
    <h2
      className={cn(
        'mb-4 text-base font-semibold tracking-tight text-foreground',
        className
      )}
    >
      {children}
    </h2>
  )
}
