'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { mascaraCodigoCfop } from '@/lib/cfop'
import { cn } from '@/lib/utils'

type Props = {
  codigo: string
  nome: string
  ativo: boolean
  codigoReadonly?: boolean
  aoMudarCodigo?: (v: string) => void
  aoMudarNome: (v: string) => void
  aoMudarAtivo: (v: boolean) => void
  disabled?: boolean
  ativoSomenteLeitura?: boolean
  ocultarAtivo?: boolean
}

export function CabecalhoCadastroErp({
  codigo,
  nome,
  ativo,
  codigoReadonly = false,
  aoMudarCodigo,
  aoMudarNome,
  aoMudarAtivo,
  disabled,
  ativoSomenteLeitura = false,
  ocultarAtivo = false,
}: Props) {
  return (
    <div
      className={cn(
        'grid gap-4 sm:items-end',
        ocultarAtivo ? 'sm:grid-cols-[7rem_minmax(0,1fr)]' : 'sm:grid-cols-[7rem_minmax(0,1fr)_auto]'
      )}
    >
      <div className="space-y-2">
        <Label htmlFor="cfop-codigo">Código</Label>
        <Input
          id="cfop-codigo"
          value={codigo}
          onChange={(e) => aoMudarCodigo?.(mascaraCodigoCfop(e.target.value))}
          readOnly={codigoReadonly}
          disabled={disabled || codigoReadonly}
          inputMode={codigoReadonly ? undefined : 'numeric'}
          maxLength={codigoReadonly ? undefined : 5}
          className={cn('font-mono', codigoReadonly && 'bg-muted/50')}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cfop-nome">Nome</Label>
        <Input
          id="cfop-nome"
          value={nome}
          onChange={(e) => aoMudarNome(e.target.value)}
          disabled={disabled}
          placeholder="Nome do CFOP"
        />
      </div>
      {!ocultarAtivo && (
        <div className="flex h-9 items-center gap-2 pb-0.5 sm:pb-0">
          <Checkbox
            id="cfop-ativo"
            checked={ativo}
            onCheckedChange={(checked) => aoMudarAtivo(checked === true)}
            disabled={disabled || ativoSomenteLeitura}
          />
          <Label htmlFor="cfop-ativo" className="cursor-pointer font-medium">
            Ativo
          </Label>
        </div>
      )}
    </div>
  )
}
