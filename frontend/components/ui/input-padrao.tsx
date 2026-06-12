import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Props = React.ComponentProps<typeof Input> & {
  rotulo: string
  mensagemDeErro?: string
  id?: string
}

export function InputPadrao({
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
      <Input
        id={idDoCampo}
        className={cn(mensagemDeErro && 'border-destructive', className)}
        aria-invalid={!!mensagemDeErro}
        {...props}
      />
      {mensagemDeErro && (
        <p className="text-sm text-destructive">{mensagemDeErro}</p>
      )}
    </div>
  )
}
