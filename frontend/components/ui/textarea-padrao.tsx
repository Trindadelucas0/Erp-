import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  rotulo: string
  mensagemDeErro?: string
  id?: string
}

export function TextareaPadrao({
  rotulo,
  mensagemDeErro,
  id,
  className,
  ...props
}: Props) {
  const idDoCampo = id ?? props.name ?? rotulo.toLowerCase().replace(/\s/g, '-')

  return (
    <div className="space-y-2">
      <Label htmlFor={idDoCampo}>{rotulo}</Label>
      <textarea
        id={idDoCampo}
        className={cn(
          'min-h-[160px] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
          mensagemDeErro && 'border-destructive',
          className
        )}
        aria-invalid={!!mensagemDeErro}
        {...props}
      />
      {mensagemDeErro && (
        <p className="text-sm text-destructive">{mensagemDeErro}</p>
      )}
    </div>
  )
}
