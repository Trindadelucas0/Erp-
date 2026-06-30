'use client'

import type { LucideIcon } from 'lucide-react'
import { Loader2, MoreHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type ItemMenuAcao = {
  rotulo: string
  icone: LucideIcon
  onClick: () => void
  destrutivo?: boolean
  desabilitado?: boolean
  oculto?: boolean
}

type Props = {
  itens: ItemMenuAcao[]
  carregando?: boolean
  ariaLabel?: string
}

export function MenuAcoesLinha({
  itens,
  carregando = false,
  ariaLabel = 'Ações',
}: Props) {
  const itensVisiveis = itens.filter((item) => !item.oculto)

  if (itensVisiveis.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={carregando}
          aria-label={ariaLabel}
        >
          {carregando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MoreHorizontal className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {itensVisiveis.map((item) => {
          const Icone = item.icone
          return (
            <DropdownMenuItem
              key={item.rotulo}
              variant={item.destrutivo ? 'destructive' : 'default'}
              disabled={item.desabilitado || carregando}
              onSelect={() => item.onClick()}
            >
              <Icone />
              {item.rotulo}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
