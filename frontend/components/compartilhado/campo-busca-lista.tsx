'use client'

import { forwardRef, type ChangeEvent } from 'react'
import { Label } from '@/components/ui/label'
import { classesCampoLista } from '@/components/ui/classes-campo'
import { cn } from '@/lib/utils'
import {
  atributosCampoBuscaLista,
  useAntiAutofillBuscaLista,
} from '@/lib/atributos-campo-busca-lista'

type Props = {
  nomeCampo: string
  value: string
  onChange: (evento: ChangeEvent<HTMLInputElement>) => void
  id?: string
  className?: string
  placeholder?: string
  rotulo?: string
}

export const CampoBuscaLista = forwardRef<HTMLInputElement, Props>(function CampoBuscaLista(
  { nomeCampo, value, onChange, id, className, placeholder, rotulo },
  ref
) {
  const antiAutofill = useAntiAutofillBuscaLista()
  const idDoCampo = id ?? nomeCampo
  const campo = (
    <input
      ref={ref}
      id={idDoCampo}
      {...atributosCampoBuscaLista(nomeCampo)}
      {...antiAutofill}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={cn(classesCampoLista, 'read-only:cursor-text read-only:bg-background', className)}
    />
  )

  if (!rotulo) return campo

  return (
    <div className="space-y-1.5">
      <Label htmlFor={idDoCampo}>{rotulo}</Label>
      {campo}
    </div>
  )
})
