import { classesCampoBase } from '@/components/ui/classes-campo'
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
    <div className="space-y-1.5">
      <Label htmlFor={idDoCampo}>{rotulo}</Label>
      <textarea
        id={idDoCampo}
        className={cn(
          classesCampoBase,
          'min-h-[120px] resize-y py-2',
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
