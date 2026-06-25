'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTema } from '@/components/compartilhado/provedor-de-tema'

export function AlternadorDeTema() {
  const { tema, alternarTema, carregando } = useTema()
  const escuro = tema === 'escuro'
  const [montado, setMontado] = useState(false)

  useEffect(() => setMontado(true), [])

  if (!montado) {
    return <Button type="button" variant="ghost" size="icon" disabled aria-label="Tema" />
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => void alternarTema()}
      disabled={carregando}
      aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
      title={escuro ? 'Tema claro' : 'Tema escuro'}
    >
      {escuro ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  )
}
