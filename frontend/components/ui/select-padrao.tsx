import { Label } from '@/components/ui/label'
import { Select, classesOption } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type OpcaoSelect = {
  readonly value: string
  readonly label: string
}

type Props = {
  rotulo: string
  valor: string
  aoMudar: (valor: string) => void
  opcoes: readonly OpcaoSelect[]
  placeholder?: string
  obrigatorio?: boolean
  mensagemDeErro?: string
  disabled?: boolean
  className?: string
  id?: string
  compacto?: boolean
}

export function SelectPadrao({
  rotulo,
  valor,
  aoMudar,
  opcoes,
  placeholder = 'Selecione',
  obrigatorio,
  mensagemDeErro,
  disabled,
  className,
  id,
  compacto,
}: Props) {
  const idDoCampo = id ?? rotulo.toLowerCase().replace(/\s/g, '-')

  return (
    <div className={cn(compacto ? 'space-y-1' : 'space-y-2')}>
      <Label
        htmlFor={idDoCampo}
        className={cn(
          compacto ? 'text-sm font-medium leading-none' : undefined
        )}
      >
        {rotulo}
        {obrigatorio && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Select
        id={idDoCampo}
        className={cn(
          compacto && 'h-8 px-2',
          mensagemDeErro && 'border-destructive',
          className
        )}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        required={obrigatorio}
        disabled={disabled}
        aria-invalid={!!mensagemDeErro}
      >
        <option value="" className={classesOption}>
          {placeholder}
        </option>
        {opcoes.map((opcao) => (
          <option key={opcao.value} value={opcao.value} className={classesOption}>
            {opcao.label}
          </option>
        ))}
      </Select>
      {mensagemDeErro && (
        <p className="text-sm text-destructive">{mensagemDeErro}</p>
      )}
    </div>
  )
}
