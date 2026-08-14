'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { classesSelect, classesSelectCompacto } from '@/components/ui/select'
import {
  notificarAberturaDropdownCatalogo,
  useFecharAoSairComMouse,
  useInstanciaDropdownCatalogo,
  useOuvirFechamentoDropdownCatalogo,
} from '@/lib/dropdown-catalogo'
import { cn } from '@/lib/utils'

export type OpcaoSelect = {
  readonly value: string
  readonly label: string
}

type PosicaoDropdown = {
  top: number
  left: number
  width: number
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
  const [aberto, setAberto] = useState(false)
  const [posicao, setPosicao] = useState<PosicaoDropdown | null>(null)
  const [montado, setMontado] = useState(false)
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

  const atualizarPosicao = useCallback(() => {
    const botao = botaoRef.current
    if (!botao) return

    const rect = botao.getBoundingClientRect()
    setPosicao({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
  }, [])

  useEffect(() => {
    if (!aberto) return

    atualizarPosicao()

    function aoScrollOuResize() {
      atualizarPosicao()
    }

    window.addEventListener('scroll', aoScrollOuResize, true)
    window.addEventListener('resize', aoScrollOuResize)
    return () => {
      window.removeEventListener('scroll', aoScrollOuResize, true)
      window.removeEventListener('resize', aoScrollOuResize)
    }
  }, [aberto, atualizarPosicao])

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

  function abrir() {
    if (disabled) return
    notificarAberturaDropdownCatalogo(instanciaId)
    setAberto(true)
  }

  function alternar() {
    if (disabled) return
    if (aberto) {
      fechar()
    } else {
      abrir()
    }
  }

  function selecionar(novoValor: string) {
    aoMudar(novoValor)
    fechar()
  }

  const opcaoSelecionada = opcoes.find((o) => o.value === valor)
  const textoExibido = opcaoSelecionada?.label ?? placeholder

  const listaDropdown = aberto && posicao && montado && (
    <div
      ref={listaRef}
      role="listbox"
      aria-labelledby={idDoCampo}
      className="fixed z-[60] max-h-48 overflow-auto rounded-md border border-border bg-card shadow-lg"
      style={{
        top: posicao.top,
        left: posicao.left,
        width: posicao.width,
      }}
      {...zonaHover}
    >
      {!obrigatorio && (
        <button
          type="button"
          role="option"
          aria-selected={!valor}
          onClick={() => selecionar('')}
          className={cn(
            'block w-full px-3 py-2 text-left text-sm hover:bg-muted',
            !valor && 'bg-muted/60 font-medium'
          )}
        >
          {placeholder}
        </button>
      )}
      {opcoes.map((opcao) => (
        <button
          key={opcao.value}
          type="button"
          role="option"
          aria-selected={valor === opcao.value}
          onClick={() => selecionar(opcao.value)}
          className={cn(
            'block w-full px-3 py-2 text-left text-sm hover:bg-muted',
            valor === opcao.value && 'bg-muted/60 font-medium'
          )}
        >
          {opcao.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className={cn(compacto ? 'space-y-1' : 'space-y-1.5')}>
      <Label
        htmlFor={idDoCampo}
        className={cn(compacto ? 'text-sm font-semibold leading-none' : undefined)}
      >
        {rotulo}
        {obrigatorio && <span className="ml-0.5 text-destructive">*</span>}
      </Label>

      <div ref={containerRef} className="relative" {...zonaHover}>
        <button
          ref={botaoRef}
          id={idDoCampo}
          type="button"
          onClick={alternar}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={aberto}
          aria-required={obrigatorio}
          aria-invalid={!!mensagemDeErro}
          className={cn(
            compacto ? classesSelectCompacto : classesSelect,
            'flex w-full items-center justify-between gap-2 text-left',
            !opcaoSelecionada && 'text-muted-foreground',
            mensagemDeErro && 'border-destructive',
            disabled && 'cursor-not-allowed opacity-50',
            className
          )}
        >
          <span className="min-w-0 truncate">{textoExibido}</span>
          <ChevronDown
            className={cn('size-4 shrink-0 opacity-50 transition-transform', aberto && 'rotate-180')}
          />
        </button>
      </div>

      {montado && listaDropdown ? createPortal(listaDropdown, document.body) : null}

      {mensagemDeErro && <p className="text-sm text-destructive">{mensagemDeErro}</p>}
    </div>
  )
}
