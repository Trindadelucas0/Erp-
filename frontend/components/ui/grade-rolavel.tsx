'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

function TrilhoHorizontal({
  leftPct,
  widthPct,
  onPointerDown,
  ariaLabel,
}: {
  leftPct: number
  widthPct: number
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  ariaLabel: string
}) {
  return (
    <div
      role="scrollbar"
      aria-orientation="horizontal"
      aria-label={ariaLabel}
      className="relative h-3.5 w-full shrink-0 cursor-pointer touch-none rounded-full bg-muted"
      onPointerDown={onPointerDown}
    >
      <div
        className="pointer-events-none absolute top-0 h-3.5 rounded-full bg-foreground/60"
        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      />
    </div>
  )
}

function useFaixaHorizontal() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)
  const [thumb, setThumb] = useState({ leftPct: 0, widthPct: 100 })

  const medir = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    const { scrollWidth, clientWidth, scrollLeft } = el
    const temOverflow = scrollWidth > clientWidth + 2
    const widthPct = !temOverflow || scrollWidth <= 0 ? 100 : (clientWidth / scrollWidth) * 100
    const leftPct = !temOverflow || scrollWidth <= 0 ? 0 : (scrollLeft / scrollWidth) * 100
    setOverflow((atual) => (atual === temOverflow ? atual : temOverflow))
    setThumb((atual) => {
      if (Math.abs(atual.leftPct - leftPct) < 0.05 && Math.abs(atual.widthPct - widthPct) < 0.05) {
        return atual
      }
      return { leftPct, widthPct }
    })
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    const filho = el.firstElementChild
    if (filho) ro.observe(filho)
    el.addEventListener('scroll', medir, { passive: true })
    window.addEventListener('resize', medir)
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', medir)
      window.removeEventListener('resize', medir)
    }
  }, [medir])

  useLayoutEffect(() => {
    medir()
  })

  function irPara(clientX: number, trilho: HTMLDivElement) {
    const el = viewportRef.current
    if (!el) return
    const rect = trilho.getBoundingClientRect()
    const x = Math.min(Math.max(0, clientX - rect.left), rect.width)
    const maxScroll = el.scrollWidth - el.clientWidth
    if (maxScroll <= 0) return
    el.scrollLeft = (x / rect.width) * maxScroll
  }

  function aoPressionarTrilho(e: React.PointerEvent<HTMLDivElement>) {
    const trilho = e.currentTarget
    trilho.setPointerCapture(e.pointerId)
    irPara(e.clientX, trilho)
    const mover = (ev: PointerEvent) => irPara(ev.clientX, trilho)
    const soltar = () => {
      try {
        trilho.releasePointerCapture(e.pointerId)
      } catch {
        /* já soltou */
      }
      trilho.removeEventListener('pointermove', mover)
      trilho.removeEventListener('pointerup', soltar)
    }
    trilho.addEventListener('pointermove', mover)
    trilho.addEventListener('pointerup', soltar)
  }

  return { viewportRef, overflow, thumb, aoPressionarTrilho }
}

type GradeProps = {
  children: ReactNode
  className?: string
  maxAltura?: string
}

/**
 * Grade larga da lista/dossiê: uma barra para a tabela inteira.
 */
export function GradeRolavel({ children, className, maxAltura }: GradeProps) {
  const { viewportRef, overflow, thumb, aoPressionarTrilho } = useFaixaHorizontal()
  const trilho = overflow ? (
    <TrilhoHorizontal
      leftPct={thumb.leftPct}
      widthPct={thumb.widthPct}
      onPointerDown={aoPressionarTrilho}
      ariaLabel="Deslizar colunas da tabela"
    />
  ) : null

  return (
    <div className={cn('flex min-w-0 w-full max-w-full flex-col gap-2', className)}>
      {trilho}
      <div
        ref={viewportRef}
        className="grade-rolavel-viewport"
        style={maxAltura ? { maxHeight: maxAltura } : undefined}
      >
        {children}
      </div>
      {trilho}
    </div>
  )
}

type LinhaProps = {
  children: ReactNode
  className?: string
  fixoEsquerda?: ReactNode
  ariaLabel?: string
}

/**
 * Uma faixa por item: desliza só aquela linha. Barra embaixo do produto; no hover fica mais visível.
 */
export function LinhaRolavel({
  children,
  className,
  fixoEsquerda,
  ariaLabel = 'Deslizar colunas deste item',
}: LinhaProps) {
  const { viewportRef, overflow, thumb, aoPressionarTrilho } = useFaixaHorizontal()

  return (
    <div className={cn('group/linha flex min-w-0 w-full max-w-full items-stretch', className)}>
      {fixoEsquerda ? (
        <div className="w-52 shrink-0 border-r border-border px-2 py-2">{fixoEsquerda}</div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={viewportRef} className="grade-linha-viewport">
          {children}
        </div>
        <div
          className={cn(
            'px-1 pb-1.5 pt-0.5 transition-opacity',
            overflow ? 'opacity-50 group-hover/linha:opacity-100' : 'hidden'
          )}
        >
          {overflow ? (
            <TrilhoHorizontal
              leftPct={thumb.leftPct}
              widthPct={thumb.widthPct}
              onPointerDown={aoPressionarTrilho}
              ariaLabel={ariaLabel}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
