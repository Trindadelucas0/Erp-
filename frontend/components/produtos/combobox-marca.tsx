'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { clienteHttp } from '@/services/api'
import {
  notificarAberturaDropdownCatalogo,
  useFecharAoSairComMouse,
  useInstanciaDropdownCatalogo,
  useOuvirFechamentoDropdownCatalogo,
} from '@/lib/dropdown-catalogo'
import { cn } from '@/lib/utils'

type Props = {
  rotulo?: string
  valor: string
  aoMudar: (marca: string) => void
  disabled?: boolean
  mensagemDeErro?: string
}

const LIMITE = 80

export function ComboboxMarca({
  rotulo = 'Marca *',
  valor,
  aoMudar,
  disabled,
  mensagemDeErro,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [marcas, setMarcas] = useState<string[]>([])
  const [carregando, setCarregando] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const instanciaId = useInstanciaDropdownCatalogo()

  const fechar = useCallback(() => {
    setAberto(false)
    setBusca('')
  }, [])

  useOuvirFechamentoDropdownCatalogo(instanciaId, fechar)
  const zonaHover = useFecharAoSairComMouse(fechar)

  function abrir() {
    if (disabled) return
    notificarAberturaDropdownCatalogo(instanciaId)
    setAberto(true)
  }

  useEffect(() => {
    if (!aberto) return
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        fechar()
      }
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [aberto, fechar])

  useEffect(() => {
    if (!aberto) return
    const termo = busca.trim()
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setCarregando(true)
      try {
        const params = new URLSearchParams()
        if (termo) params.set('q', termo)
        const { data } = await clienteHttp.get(`/produtos/marcas?${params}`)
        setMarcas(data.marcas ?? [])
      } catch {
        setMarcas([])
      } finally {
        setCarregando(false)
      }
    }, 250)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [busca, aberto])

  const termoBusca = busca.toLowerCase().trim()
  let filtradas = marcas
  if (termoBusca) {
    filtradas = marcas.filter((m) => m.toLowerCase().includes(termoBusca))
  }
  filtradas = filtradas.slice(0, LIMITE)

  if (marcas.length === 0 && termoBusca.length >= 1) {
    filtradas = [busca.trim().toUpperCase()]
  }

  const opcoes = [...new Set([...(valor && !filtradas.includes(valor) ? [valor] : []), ...filtradas])]

  function selecionar(marca: string) {
    aoMudar(marca.toUpperCase())
    fechar()
  }

  function limpar() {
    aoMudar('')
    setBusca('')
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label>{rotulo}</Label>
      <div className="relative" {...zonaHover}>
        <div className="relative flex gap-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={aberto ? busca : valor}
            onChange={(e) => {
              setBusca(e.target.value)
              abrir()
            }}
            onFocus={abrir}
            disabled={disabled}
            placeholder="Buscar marca..."
            className={cn(
              'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent py-1 pl-9 pr-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
              mensagemDeErro && 'border-destructive'
            )}
          />
          {valor && !disabled && (
            <button
              type="button"
              onClick={limpar}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground hover:text-destructive"
              aria-label="Limpar marca"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {aberto && (
          <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md text-sm">
            {carregando && (
              <li className="px-3 py-2 text-muted-foreground">Buscando...</li>
            )}
            {!carregando && opcoes.length === 0 && (
              <li className="px-3 py-2 text-muted-foreground">Nenhuma marca encontrada</li>
            )}
            {!carregando &&
              opcoes.map((marca) => (
                <li key={marca}>
                  <button
                    type="button"
                    className="flex w-full items-start px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selecionar(marca)}
                  >
                    <span className="truncate">{marca}</span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
      {mensagemDeErro && <p className="text-sm text-destructive">{mensagemDeErro}</p>}
    </div>
  )
}
