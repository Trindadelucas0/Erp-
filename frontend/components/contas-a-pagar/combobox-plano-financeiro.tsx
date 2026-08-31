'use client'

import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import { classesCampo, classesCampoAcao } from '@/components/ui/classes-campo'
import { Label } from '@/components/ui/label'
import { TextoDestaqueBusca } from '@/components/ui/texto-destaque-busca'
import {
  notificarAberturaDropdownCatalogo,
  useFecharAoSairComMouse,
  useInstanciaDropdownCatalogo,
  useOuvirFechamentoDropdownCatalogo,
} from '@/lib/dropdown-catalogo'
import { type PlanoFinanceiroOpcao } from '@/lib/contas-a-pagar'
import { textosContemTodosTermos } from '@/lib/normalizar-busca'
import { cn } from '@/lib/utils'

export type { PlanoFinanceiroOpcao }

type PosicaoDropdown = {
  top: number
  left: number
  width: number
  maxHeight: number
}

type Props = {
  rotulo: string
  planos: PlanoFinanceiroOpcao[]
  valor: string
  aoMudar: (planoId: string) => void
  aoConfirmar?: (planoId: string) => void
  disabled?: boolean
  placeholder?: string
  obrigatorio?: boolean
  permitirVazio?: boolean
  rotuloVazio?: string
}

const LIMITE = 80
const ALTURA_MAXIMA_LISTA = 240

function rotuloPlano(p: PlanoFinanceiroOpcao): string {
  return p.codigo ? `${p.codigo} ${p.nome}` : p.nome
}

function filtrarPlanos(planos: PlanoFinanceiroOpcao[], termo: string) {
  if (!termo.trim()) return planos.slice(0, LIMITE)
  return planos
    .filter((p) => textosContemTodosTermos([p.codigo ?? '', p.nome], termo))
    .slice(0, LIMITE)
}

export function ComboboxPlanoFinanceiro({
  rotulo,
  planos,
  valor,
  aoMudar,
  aoConfirmar,
  disabled,
  placeholder = 'Digite código ou nome...',
  obrigatorio = false,
  permitirVazio = false,
  rotuloVazio = 'Sem plano',
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [posicao, setPosicao] = useState<PosicaoDropdown | null>(null)
  const [montado, setMontado] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRowRef = useRef<HTMLDivElement>(null)
  const listaRef = useRef<HTMLUListElement>(null)
  const instanciaId = useInstanciaDropdownCatalogo()

  const selecionado = planos.find((p) => p.id === valor) ?? null

  const fechar = useCallback(() => {
    setAberto(false)
    setBusca('')
  }, [])

  useOuvirFechamentoDropdownCatalogo(instanciaId, fechar)
  const zonaHover = useFecharAoSairComMouse(fechar, [containerRef, listaRef])

  useEffect(() => {
    setMontado(true)
  }, [])

  const atualizarPosicao = useCallback(() => {
    const linha = inputRowRef.current
    if (!linha) return

    const rect = linha.getBoundingClientRect()
    const espacoAbaixo = window.innerHeight - rect.bottom - 8
    const maxHeight = Math.min(ALTURA_MAXIMA_LISTA, Math.max(espacoAbaixo, 120))

    setPosicao({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight,
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

  function abrir(inicializarBusca = false) {
    if (disabled) return
    if (!aberto) {
      notificarAberturaDropdownCatalogo(instanciaId)
      setAberto(true)
    }
    if (inicializarBusca && selecionado) {
      setBusca(rotuloPlano(selecionado))
    }
  }

  function aoFocarInput(e: FocusEvent<HTMLInputElement>) {
    abrir(true)
    requestAnimationFrame(() => e.target.select())
  }

  function selecionar(id: string) {
    aoMudar(id)
    aoConfirmar?.(id)
    fechar()
  }

  function limpar() {
    aoMudar('')
    aoConfirmar?.('')
    setBusca('')
  }

  const filtrados = filtrarPlanos(planos, aberto ? busca : '')
  const textoExibido = selecionado ? rotuloPlano(selecionado) : ''

  const listaDropdown = aberto && posicao && montado && (
    <ul
      ref={listaRef}
      role="listbox"
      className="fixed z-[60] overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md text-sm"
      style={{
        top: posicao.top,
        left: posicao.left,
        width: posicao.width,
        maxHeight: posicao.maxHeight,
      }}
      {...zonaHover}
    >
      {permitirVazio && (
        <li>
          <button
            type="button"
            role="option"
            aria-selected={!valor}
            className={cn(
              'flex w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground',
              !valor && 'bg-accent/60 font-medium'
            )}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => selecionar('')}
          >
            {rotuloVazio}
          </button>
        </li>
      )}
      {filtrados.length === 0 ? (
        <li className="px-3 py-2 text-muted-foreground">Nenhum resultado encontrado</li>
      ) : (
        filtrados.map((p) => {
          const texto = rotuloPlano(p)
          return (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={valor === p.id}
                className="flex w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selecionar(p.id)}
              >
                <TextoDestaqueBusca texto={texto} termo={busca} className="truncate" />
              </button>
            </li>
          )
        })
      )}
    </ul>
  )

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label>
        {rotulo}
        {obrigatorio ? ' *' : ''}
      </Label>
      <div className="relative" {...zonaHover}>
        <div ref={inputRowRef} className="relative flex gap-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={aberto ? busca : textoExibido}
            onChange={(e) => {
              const texto = e.target.value
              setBusca(texto)
              if (!aberto) abrir()
              if (valor && selecionado && texto !== rotuloPlano(selecionado)) {
                aoMudar('')
              }
            }}
            onFocus={aoFocarInput}
            disabled={disabled}
            placeholder={placeholder}
            autoComplete="off"
            className={cn(classesCampo, 'pl-9 pr-2 text-base md:text-sm')}
          />
          {valor && !disabled && (
            <button
              type="button"
              onClick={limpar}
              className={classesCampoAcao}
              aria-label={`Limpar ${rotulo.toLowerCase()}`}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {montado && listaDropdown ? createPortal(listaDropdown, document.body) : null}
    </div>
  )
}
