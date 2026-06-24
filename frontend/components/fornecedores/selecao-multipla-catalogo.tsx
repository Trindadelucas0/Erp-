'use client'

import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { clienteHttp } from '@/services/api'

export type ItemCatalogo = {
  id: string
  codigo: string
  descricao: string
}

type Props = {
  rotulo: string
  ajuda?: string
  endpoint: '/planos-financeiros' | '/cfops'
  tipoCfop?: string
  selecionados: ItemCatalogo[]
  aoMudar: (itens: ItemCatalogo[]) => void
  disabled?: boolean
}

export function SelecaoMultiplaCatalogo({
  rotulo,
  ajuda,
  endpoint,
  tipoCfop,
  selecionados,
  aoMudar,
  disabled,
}: Props) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<ItemCatalogo[]>([])
  const [abrindo, setAbrindo] = useState(false)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!abrindo) return
    const timer = setTimeout(async () => {
      setCarregando(true)
      try {
        const params: Record<string, string> = { q: busca }
        if (endpoint === '/cfops' && tipoCfop) params.tipo = tipoCfop
        const chave = endpoint === '/planos-financeiros' ? 'planos' : 'cfops'
        const { data } = await clienteHttp.get(endpoint, { params })
        const lista = (data[chave] ?? []) as ItemCatalogo[]
        const ids = new Set(selecionados.map((s) => s.id))
        setResultados(lista.filter((item) => !ids.has(item.id)))
      } catch {
        setResultados([])
      } finally {
        setCarregando(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [busca, abrindo, endpoint, tipoCfop, selecionados])

  function adicionar(item: ItemCatalogo) {
    aoMudar([...selecionados, item])
    setBusca('')
    setAbrindo(false)
  }

  function remover(id: string) {
    aoMudar(selecionados.filter((s) => s.id !== id))
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none">{rotulo}</label>
      <div className="relative">
        <div className="flex items-center gap-2">
          <input
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setAbrindo(true) }}
            onFocus={() => setAbrindo(true)}
            placeholder="Buscar por código ou descrição..."
            disabled={disabled}
          />
          <Search className="pointer-events-none absolute right-3 h-4 w-4 text-muted-foreground" />
        </div>
        {abrindo && !disabled && (
          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-background shadow-md">
            {carregando && (
              <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
            )}
            {!carregando && resultados.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado</p>
            )}
            {resultados.map((item) => (
              <button
                key={item.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                onClick={() => adicionar(item)}
              >
                <span className="font-mono font-medium">{item.codigo}</span>
                <span className="text-muted-foreground"> — {item.descricao}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selecionados.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selecionados.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs"
            >
              <span className="font-mono">{item.codigo}</span>
              <span className="text-muted-foreground">— {item.descricao}</span>
              {!disabled && (
                <button type="button" onClick={() => remover(item.id)} className="text-destructive">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {ajuda && (
        <p className="rounded-md bg-primary/15 px-3 py-2 text-xs text-primary">{ajuda}</p>
      )}
    </div>
  )
}
