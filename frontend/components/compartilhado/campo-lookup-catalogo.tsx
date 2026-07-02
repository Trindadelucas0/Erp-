'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { MSG_PLANO_SOMENTE_DESPESA, planoEhDespesa } from '@/lib/plano-financeiro'
import { cn } from '@/lib/utils'

export type ItemCatalogo = { id: string; codigo: string; descricao: string; tipo?: string }

type Props = {
  rotulo: string
  endpoint: '/planos-financeiros' | '/cfops'
  queryParams?: string
  tipoPlanoEsperado?: 'despesa'
  valor: ItemCatalogo | null
  aoSelecionar: (item: ItemCatalogo | null) => void
  disabled?: boolean
}

export function CampoLookupCatalogo({
  rotulo,
  endpoint,
  queryParams,
  tipoPlanoEsperado,
  valor,
  aoSelecionar,
  disabled,
}: Props) {
  const [busca, setBusca] = useState('')
  const [itens, setItens] = useState<ItemCatalogo[]>([])
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erroSelecao, setErroSelecao] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const valorInvalido =
    !!valor &&
    endpoint === '/planos-financeiros' &&
    tipoPlanoEsperado === 'despesa' &&
    !planoEhDespesa(valor)

  useEffect(() => {
    if (valor) {
      setBusca(`${valor.codigo} - ${valor.descricao}`)
    } else {
      setBusca('')
    }
  }, [valor])

  useEffect(() => {
    if (!aberto) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setCarregando(true)
      try {
        const q = busca.includes(' - ') ? busca.split(' - ').pop() ?? busca : busca
        const url = `${endpoint}?q=${encodeURIComponent(q.trim())}${queryParams ? `&${queryParams}` : ''}`
        const { data } = await clienteHttp.get(url)
        setItens(data.planos ?? data.cfops ?? [])
      } catch {
        setItens([])
      } finally {
        setCarregando(false)
      }
    }, 250)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [busca, aberto, endpoint, queryParams])

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [])

  function tentarSelecionar(item: ItemCatalogo) {
    if (
      endpoint === '/planos-financeiros' &&
      tipoPlanoEsperado === 'despesa' &&
      !planoEhDespesa(item)
    ) {
      setErroSelecao(MSG_PLANO_SOMENTE_DESPESA)
      return
    }
    setErroSelecao('')
    aoSelecionar(item)
    setBusca(`${item.codigo} - ${item.descricao}`)
    setAberto(false)
  }

  function limpar() {
    setErroSelecao('')
    aoSelecionar(null)
    setBusca('')
  }

  return (
    <div ref={ref} className="space-y-1">
      <label className="text-sm font-medium leading-none">{rotulo}</label>
      <div className="relative flex gap-1">
        <input
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm disabled:opacity-50',
            (valorInvalido || erroSelecao) && 'border-destructive'
          )}
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value)
            setErroSelecao('')
            if (valor) aoSelecionar(null)
          }}
          onFocus={() => setAberto(true)}
          disabled={disabled}
          placeholder="Buscar..."
        />
        {valor && !disabled && (
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-muted hover:text-destructive"
            onClick={limpar}
            aria-label="Limpar seleção"
          >
            <X className="size-4" />
          </button>
        )}
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-muted"
          onClick={() => setAberto((v) => !v)}
          disabled={disabled}
        >
          <Search className="size-4" />
        </button>
        {aberto && (
          <div className="absolute left-0 top-full z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
            {carregando && (
              <p className="px-3 py-2 text-sm text-muted-foreground">Carregando...</p>
            )}
            {!carregando && itens.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado</p>
            )}
            {itens.map((item) => (
              <button
                key={item.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => tentarSelecionar(item)}
              >
                {item.codigo} - {item.descricao}
              </button>
            ))}
          </div>
        )}
      </div>
      {(valorInvalido || erroSelecao) && (
        <p className="text-xs text-destructive">
          {erroSelecao || MSG_PLANO_SOMENTE_DESPESA}
        </p>
      )}
    </div>
  )
}
