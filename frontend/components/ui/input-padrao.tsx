import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Props = React.ComponentProps<typeof Input> & {
  rotulo: string
  obrigatorio?: boolean
  mensagemDeErro?: string
  id?: string
}

export function InputPadrao({
  rotulo,
  obrigatorio,
  mensagemDeErro,
  id,
  className,
  ...props
}: Props) {
  const idDoCampo = id ?? props.name ?? rotulo.toLowerCase().replace(/\s/g, '-')

  return (
    <div className="space-y-2">
      <Label htmlFor={idDoCampo}>
        {rotulo}
        {obrigatorio && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input
        id={idDoCampo}
        className={cn(mensagemDeErro && 'border-destructive', className)}
        aria-invalid={!!mensagemDeErro}
        aria-required={obrigatorio}
        {...props}
      />
      {mensagemDeErro && (
        <p className="text-sm text-destructive">{mensagemDeErro}</p>
      )}
    </div>
  )
}
