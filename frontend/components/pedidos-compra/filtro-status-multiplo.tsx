'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  notificarAberturaDropdownCatalogo,
  useInstanciaDropdownCatalogo,
  useOuvirFechamentoDropdownCatalogo,
} from '@/lib/dropdown-catalogo'
import {
  rotuloResumoStatusFiltro,
  STATUS_FILTRO_PADRAO,
  STATUS_PEDIDO_FILTRAVEL,
  TODOS_STATUS_PEDIDO_FILTRAVEL,
  type StatusPedidoFiltravel,
} from '@/lib/pedido-compra-shared'
import { cn } from '@/lib/utils'
import { classesCampoLista } from '@/components/ui/classes-campo'

type PosicaoDropdown = {
  top: number
  left: number
  width: number
}

type Props = {
  selecionados: StatusPedidoFiltravel[]
  aoMudar: (statuses: StatusPedidoFiltravel[]) => void
  disabled?: boolean
  className?: string
}

export function FiltroStatusMultiplo({ selecionados, aoMudar, disabled, className }: Props) {
  const [aberto, setAberto] = useState(false)
  const [posicao, setPosicao] = useState<PosicaoDropdown | null>(null)
  const [montado, setMontado] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const instanciaId = useInstanciaDropdownCatalogo()

  const fechar = useCallback(() => setAberto(false), [])

  useOuvirFechamentoDropdownCatalogo(instanciaId, fechar)

  useEffect(() => {
    if (!aberto) return

    function aoClicarFora(e: MouseEvent) {
      const alvo = e.target as Node
      if (containerRef.current?.contains(alvo) || listaRef.current?.contains(alvo)) return
      fechar()
    }

    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [aberto, fechar])

  useEffect(() => {
    setMontado(true)
  }, [])

  const atualizarPosicao = useCallback(() => {
    const botao = botaoRef.current
    if (!botao) return

    const rect = botao.getBoundingClientRect()
    setPosicao({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 220),
    })
  }, [])

  useEffect(() => {
    if (!aberto) return
    atualizarPosicao()
    window.addEventListener('resize', atualizarPosicao)
    window.addEventListener('scroll', atualizarPosicao, true)
    return () => {
      window.removeEventListener('resize', atualizarPosicao)
      window.removeEventListener('scroll', atualizarPosicao, true)
    }
  }, [aberto, atualizarPosicao])

  function alternar() {
    if (disabled) return
    if (aberto) {
      fechar()
      return
    }
    notificarAberturaDropdownCatalogo(instanciaId)
    setAberto(true)
  }

  function alternarStatus(status: StatusPedidoFiltravel, marcado: boolean) {
    if (marcado) {
      if (selecionados.includes(status)) return
      aoMudar([...selecionados, status])
      return
    }
    if (selecionados.length <= 1) return
    aoMudar(selecionados.filter((item) => item !== status))
  }

  const dropdown =
    aberto && posicao && montado ? (
      <div
        ref={listaRef}
        className="fixed z-[60] rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md"
        style={{
          top: posicao.top,
          left: posicao.left,
          width: posicao.width,
        }}
      >
        <div className="space-y-1">
          {STATUS_PEDIDO_FILTRAVEL.map((opcao) => {
            const id = `filtro-status-${opcao.value}`
            const marcado = selecionados.includes(opcao.value)
            const ultimoMarcado = marcado && selecionados.length === 1
            return (
              <div key={opcao.value} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
                <Checkbox
                  id={id}
                  checked={marcado}
                  disabled={disabled || ultimoMarcado}
                  onCheckedChange={(checked) => alternarStatus(opcao.value, checked === true)}
                />
                <Label htmlFor={id} className="flex-1 cursor-pointer text-sm font-normal">
                  {opcao.label}
                </Label>
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex gap-2 border-t border-border pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 flex-1 text-xs"
            disabled={disabled}
            onClick={() => aoMudar([...STATUS_FILTRO_PADRAO])}
          >
            Padrão
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 flex-1 text-xs"
            disabled={disabled}
            onClick={() => aoMudar([...TODOS_STATUS_PEDIDO_FILTRAVEL])}
          >
            Marcar todos
          </Button>
        </div>
      </div>
    ) : null

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={botaoRef}
        type="button"
        disabled={disabled}
        aria-expanded={aberto}
        aria-haspopup="listbox"
        onClick={alternar}
        className={cn(
          classesCampoLista,
          'flex items-center justify-between gap-2',
          'sm:min-w-[12rem] sm:max-w-xs'
        )}
      >
        <span className="truncate text-left">{rotuloResumoStatusFiltro(selecionados)}</span>
        <ChevronDown className="size-4 shrink-0 opacity-50" />
      </button>
      {montado && dropdown ? createPortal(dropdown, document.body) : null}
    </div>
  )
}
