'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usePendencias } from '@/components/pendencias/provedor-pendencias'
import { ROTULO_TIPO_PENDENCIA } from '@/lib/pendencias'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'

export function SinoPendencias() {
  const { estaAutenticado } = useSessaoDoUsuario()
  const { resumo } = usePendencias()

  if (!estaAutenticado) return null

  const total = resumo?.total ?? 0
  const porTipo = resumo?.porTipo ?? {}
  const linhas = Object.entries(porTipo)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative size-9"
          aria-label={
            total > 0 ? `Pendências: ${total}` : 'Pendências'
          }
        >
          <Bell className="size-4" />
          {total > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {total > 99 ? '99+' : total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {total === 0 ? 'Nenhuma pendência' : `${total} pendência(s)`}
        </div>
        {linhas.length > 0 && <DropdownMenuSeparator />}
        {linhas.map(([tipo, qtd]) => (
          <DropdownMenuItem key={tipo} asChild>
            <Link href="/pendencias" className="flex justify-between gap-2">
              <span className="truncate">
                {ROTULO_TIPO_PENDENCIA[tipo] ?? tipo}
              </span>
              <span className="tabular-nums text-muted-foreground">{qtd}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/pendencias" className="font-medium text-primary">
            Ver todas
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
