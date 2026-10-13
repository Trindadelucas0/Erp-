'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { classesCampo } from '@/components/ui/classes-campo'
import { Label } from '@/components/ui/label'
import { TextoDestaqueBusca } from '@/components/ui/texto-destaque-busca'
import {
  notificarAberturaDropdownCatalogo,
  useFecharAoSairComMouse,
  useInstanciaDropdownCatalogo,
  useOuvirFechamentoDropdownCatalogo,
} from '@/lib/dropdown-catalogo'
import { textosContemTodosTermos } from '@/lib/normalizar-busca'
import { cn } from '@/lib/utils'
import { listarBancos, type BancoBrasilApi } from '@/lib/brasil-api'

type Props = {
  valor: string
  aoMudar: (valor: string) => void
  disabled?: boolean
  mensagemDeErro?: string
  rotulo?: string
}

const LIMITE_DROPDOWN = 80

export function ComboboxBanco({
  valor,
  aoMudar,
  disabled,
  mensagemDeErro,
  rotulo = 'Banco',
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [bancos, setBancos] = useState<BancoBrasilApi[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const instanciaId = useInstanciaDropdownCatalogo()

  const fechar = useCallback(() => {
    setAberto(false)
    setBusca('')
  }, [])

  const zonaHover = useFecharAoSairComMouse(fechar, [containerRef])
  useOuvirFechamentoDropdownCatalogo(instanciaId, fechar)

  const carregarBancos = useCallback(async () => {
    setCarregando(true)
    try {
      const lista = await listarBancos()
      setBancos(lista)
      setErro('')
    } catch {
      setErro('Não foi possível carregar os bancos')
    } finally {
      setCarregando(false)
    }
  }, [])

  const filtrados = busca.trim()
    ? bancos
        .filter((b) => textosContemTodosTermos([b.code ?? '', b.ispb, b.name, b.fullName], busca))
        .slice(0, LIMITE_DROPDOWN)
    : bancos.slice(0, LIMITE_DROPDOWN)

  function selecionar(banco: BancoBrasilApi) {
    aoMudar(banco.rotulo)
    setBusca('')
    setAberto(false)
  }

  function abrir() {
    if (disabled || carregando) return
    if (erro) {
      void carregarBancos()
      return
    }
    notificarAberturaDropdownCatalogo(instanciaId)
    setAberto(true)
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

  useEffect(() => {
    void carregarBancos()
  }, [carregarBancos])

  const labelExibido = valor || ''

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <Label htmlFor={`banco-combobox-${instanciaId}`}>{rotulo}</Label>
      <div className="relative" {...zonaHover}>
        {aberto ? (
          <input
            ref={inputRef}
            id={`banco-combobox-${instanciaId}`}
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite código ou nome..."
            disabled={disabled}
            className={cn(
              classesCampo,
              'text-base md:text-sm',
              mensagemDeErro && 'border-destructive'
            )}
          />
        ) : (
          <button
            id={`banco-combobox-${instanciaId}`}
            type="button"
            disabled={disabled || carregando}
            onClick={abrir}
            className={cn(
              classesCampo,
              'flex items-center justify-between text-left text-base md:text-sm',
              mensagemDeErro && 'border-destructive',
              !labelExibido && 'text-muted-foreground'
            )}
          >
            <span className="truncate">
              {carregando
                ? 'Carregando bancos...'
                : erro || labelExibido || 'Selecione ou digite...'}
            </span>
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
                <li key={b.ispb}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex gap-2 items-baseline"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selecionar(b)}
                  >
                    <span className="text-xs text-muted-foreground w-8 shrink-0">
                      <TextoDestaqueBusca texto={b.code ?? 'ISPB'} termo={busca} />
                    </span>
                    <TextoDestaqueBusca texto={b.name || b.fullName} termo={busca} className="truncate" />
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
      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </div>
  )
}
