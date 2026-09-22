'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { classesSelect } from '@/components/ui/select'
import {
  notificarAberturaDropdownCatalogo,
  useFecharAoSairComMouse,
  useInstanciaDropdownCatalogo,
  useOuvirFechamentoDropdownCatalogo,
} from '@/lib/dropdown-catalogo'
import { BANDEIRAS_CARTAO, type CodigoBandeiraCartao } from '@/lib/bandeiras-cartao'
import { cn } from '@/lib/utils'
import { IconeBandeiraCartao } from './icone-bandeira-cartao'

type Props = {
  valor: string
  aoMudar: (valor: CodigoBandeiraCartao) => void
  obrigatorio?: boolean
  mensagemDeErro?: string
  disabled?: boolean
}

export function SelectBandeiraCartao({
  valor,
  aoMudar,
  obrigatorio,
  mensagemDeErro,
  disabled,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [montado, setMontado] = useState(false)
  const [posicao, setPosicao] = useState<{ top: number; left: number; width: number } | null>(
    null
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const instanciaId = useInstanciaDropdownCatalogo()

  const fechar = useCallback(() => setAberto(false), [])
  const zonaHover = useFecharAoSairComMouse(fechar, [containerRef, listaRef])
  useOuvirFechamentoDropdownCatalogo(instanciaId, fechar)

  useEffect(() => {
    setMontado(true)
  }, [])

  const selecionada = BANDEIRAS_CARTAO.find((b) => b.codigo === valor)

  const abrir = () => {
    if (disabled) return
    const botao = botaoRef.current
    if (botao) {
      const rect = botao.getBoundingClientRect()
      setPosicao({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    notificarAberturaDropdownCatalogo(instanciaId)
    setAberto(true)
  }

  return (
    <div className="space-y-1.5" ref={containerRef} {...zonaHover}>
      <Label>
        Bandeira {obrigatorio ? <span className="text-destructive">*</span> : null}
      </Label>
      <button
        ref={botaoRef}
        type="button"
        disabled={disabled}
        onClick={() => (aberto ? fechar() : abrir())}
        className={cn(
          classesSelect,
          'flex w-full items-center justify-between gap-2 text-left',
          mensagemDeErro && 'border-destructive'
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selecionada ? (
            <>
              <IconeBandeiraCartao bandeira={selecionada.codigo} />
              <span className="truncate">{selecionada.rotulo}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Selecionar...</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>
      {mensagemDeErro && <p className="text-xs text-destructive">{mensagemDeErro}</p>}

      {montado &&
        aberto &&
        posicao &&
        createPortal(
          <div
            ref={listaRef}
            className="z-[80] max-h-60 overflow-auto rounded-md border border-border bg-popover p-1 shadow-md"
            style={{
              position: 'fixed',
              top: posicao.top,
              left: posicao.left,
              width: posicao.width,
            }}
            {...zonaHover}
          >
            {BANDEIRAS_CARTAO.map((b) => (
              <button
                key={b.codigo}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent',
                  valor === b.codigo && 'bg-accent'
                )}
                onClick={() => {
                  aoMudar(b.codigo)
                  fechar()
                }}
              >
                <IconeBandeiraCartao bandeira={b.codigo} />
                {b.rotulo}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}
