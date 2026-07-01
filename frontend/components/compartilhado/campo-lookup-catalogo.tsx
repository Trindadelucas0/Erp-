'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { clienteHttp } from '@/services/api'

export type ItemCatalogo = { id: string; codigo: string; descricao: string }

type Props = {
  rotulo: string
  endpoint: '/planos-financeiros' | '/cfops'
  queryParams?: string
  valor: ItemCatalogo | null
  aoSelecionar: (item: ItemCatalogo | null) => void
  disabled?: boolean
}

export function CampoLookupCatalogo({
  rotulo,
  endpoint,
  queryParams,
  valor,
  aoSelecionar,
  disabled,
}: Props) {
  const [busca, setBusca] = useState('')
  const [itens, setItens] = useState<ItemCatalogo[]>([])
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  return (
    <div ref={ref} className="space-y-1">
      <label className="text-sm font-medium leading-none">{rotulo}</label>
      <div className="relative flex gap-1">
        <input
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm disabled:opacity-50"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value)
            if (valor) aoSelecionar(null)
          }}
          onFocus={() => setAberto(true)}
          disabled={disabled}
          placeholder="Buscar..."
        />
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
                onClick={() => {
                  aoSelecionar(item)
                  setBusca(`${item.codigo} - ${item.descricao}`)
                  setAberto(false)
                }}
              >
                {item.codigo} - {item.descricao}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
