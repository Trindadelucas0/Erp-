'use client'

import { cn } from '@/lib/utils'
import { sanitizarIeDigitos } from '@/lib/documentos'

type Props = {
  ie: string
  ieIsento: boolean
  aoMudarIe: (v: string) => void
  aoMudarIsento: (isento: boolean) => void
  disabled?: boolean
  mensagemDeErro?: string
}

export function CampoInscricaoEstadual({
  ie,
  ieIsento,
  aoMudarIe,
  aoMudarIsento,
  disabled,
  mensagemDeErro,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <label className="text-sm font-medium leading-none">Inscrição Estadual (IE)</label>
        <input
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            mensagemDeErro && 'border-destructive'
          )}
          value={ieIsento ? 'ISENTO' : ie}
          onChange={(e) => aoMudarIe(sanitizarIeDigitos(e.target.value))}
          placeholder="Número da IE"
          maxLength={30}
          disabled={disabled || ieIsento}
          aria-invalid={!!mensagemDeErro}
        />
        {mensagemDeErro && (
          <p className="text-sm text-destructive">{mensagemDeErro}</p>
        )}
      </div>
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={ieIsento}
          onChange={(e) => aoMudarIsento(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        <span className="text-sm font-medium leading-none">Isento (não contribuinte ICMS)</span>
      </label>
    </div>
  )
}
