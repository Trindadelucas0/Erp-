'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Label } from '@/components/ui/label'
import { TextoDestaqueBusca } from '@/components/ui/texto-destaque-busca'
import { useFecharAoSairComMouse } from '@/lib/dropdown-catalogo'
import { textoContemTodosTermos } from '@/lib/normalizar-busca'
import { cn } from '@/lib/utils'
import { BANCOS_BRASILEIROS } from '@/lib/bancos-brasileiros'

type Props = {
  valor: string
  aoMudar: (valor: string) => void
  disabled?: boolean
  mensagemDeErro?: string
}

const LIMITE_DROPDOWN = 80

export function ComboboxBanco({ valor, aoMudar, disabled, mensagemDeErro }: Props) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fechar = useCallback(() => {
    setAberto(false)
    setBusca('')
  }, [])

  const zonaHover = useFecharAoSairComMouse(fechar, [containerRef])

  const filtrados = busca.trim()
    ? BANCOS_BRASILEIROS.filter(
        (b) =>
          b.codigo.startsWith(busca.trim().toLowerCase()) ||
          textoContemTodosTermos(b.nome, busca)
      ).slice(0, LIMITE_DROPDOWN)
    : BANCOS_BRASILEIROS.slice(0, LIMITE_DROPDOWN)

  function selecionar(codigo: string, nome: string) {
    const novoValor = `${codigo} - ${nome}`
    aoMudar(novoValor)
    setBusca('')
    setAberto(false)
  }

  function aoClearInput() {
    aoMudar('')
    setBusca('')
    inputRef.current?.focus()
  }

  // Fechar ao clicar fora (fallback para touch)
  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        fechar()
      }
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [fechar])

  const labelExibido = valor || ''

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label htmlFor="banco-combobox">Banco</Label>
      <div className="relative" {...zonaHover}>
        {aberto ? (
          <input
            ref={inputRef}
            id="banco-combobox"
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite código ou nome..."
            disabled={disabled}
            className={cn(
              'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
              mensagemDeErro && 'border-destructive'
            )}
          />
        ) : (
          <button
            id="banco-combobox"
            type="button"
            disabled={disabled}
            onClick={() => setAberto(true)}
            className={cn(
              'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none text-left flex items-center justify-between focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
              mensagemDeErro && 'border-destructive',
              !labelExibido && 'text-muted-foreground'
            )}
          >
            <span className="truncate">{labelExibido || 'Selecione ou digite...'}</span>
            <span className="flex items-center gap-1 ml-2 shrink-0">
              {valor && (
                <span
                  role="button"
                  aria-label="Limpar banco"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && aoClearInput()}
                  onClick={(e) => { e.stopPropagation(); aoClearInput() }}
                  className="text-muted-foreground hover:text-foreground cursor-pointer text-xs px-1"
                >
                  ✕
                </span>
              )}
              <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </button>
        )}

        {aberto && (
          <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md text-sm">
            {filtrados.length === 0 ? (
              <li className="px-3 py-2 text-muted-foreground">Nenhum banco encontrado</li>
            ) : (
              filtrados.map((b) => (
                <li key={b.codigo}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex gap-2 items-baseline"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selecionar(b.codigo, b.nome)}
                  >
                    <span className="text-xs text-muted-foreground w-8 shrink-0">
                      <TextoDestaqueBusca texto={b.codigo} termo={busca} />
                    </span>
                    <TextoDestaqueBusca texto={b.nome} termo={busca} className="truncate" />
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {mensagemDeErro && (
        <p className="text-sm text-destructive">{mensagemDeErro}</p>
      )}
    </div>
  )
}
