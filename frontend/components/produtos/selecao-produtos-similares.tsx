'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { Button } from '@/components/ui/button'
import { useFecharAoSairComMouse } from '@/lib/dropdown-catalogo'
import { cn } from '@/lib/utils'

export type ProdutoSimilarItem = {
  id: string
  nomeVenda: string
  sku: string | null
}

type Props = {
  selecionados: ProdutoSimilarItem[]
  aoMudar: (itens: ProdutoSimilarItem[]) => void
  excluirId?: string
  disabled?: boolean
}

export function SelecaoProdutosSimilares({ selecionados, aoMudar, excluirId, disabled }: Props) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<ProdutoSimilarItem[]>([])
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fechar = useCallback(() => setAberto(false), [])
  const zonaHover = useFecharAoSairComMouse(fechar)

  const buscar = useCallback(async () => {
    try {
      const params = new URLSearchParams({ incluirInativos: 'false' })
      if (busca.trim()) params.set('q', busca.trim())
      const { data } = await clienteHttp.get(`/produtos?${params}`)
      const lista = (data.produtos ?? [])
        .filter((p: { id: string; ativo: boolean }) => p.ativo && p.id !== excluirId)
        .map((p: { id: string; nomeVenda: string; sku: string | null }) => ({
          id: p.id,
          nomeVenda: p.nomeVenda,
          sku: p.sku,
        }))
      setResultados(lista)
    } catch {
      setResultados([])
    }
  }, [busca, excluirId])

  useEffect(() => {
    if (!aberto) return
    const t = setTimeout(buscar, 300)
    return () => clearTimeout(t)
  }, [aberto, buscar])

  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) fechar()
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto, fechar])

  function adicionar(item: ProdutoSimilarItem) {
    if (selecionados.some((s) => s.id === item.id)) return
    aoMudar([...selecionados, item])
    setAberto(false)
    setBusca('')
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Produtos similares (sugestão de compras)</p>

      {selecionados.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selecionados.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
            >
              {s.sku ? `${s.sku} — ` : ''}{s.nomeVenda}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => aoMudar(selecionados.filter((x) => x.id !== s.id))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {selecionados.length === 0 && disabled && (
        <p className="text-xs text-muted-foreground">Nenhum produto similar vinculado.</p>
      )}

      {!disabled && (
        <div ref={ref} className="relative max-w-md" {...zonaHover}>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <input
              className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-sm"
              placeholder="Buscar produto similar..."
              value={busca}
              onFocus={() => setAberto(true)}
              onChange={(e) => {
                setBusca(e.target.value)
                setAberto(true)
              }}
            />
          </div>
          {aberto && (
            <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-card shadow-md">
              {resultados
                .filter((r) => !selecionados.some((s) => s.id === r.id))
                .slice(0, 20)
                .map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={cn(
                      'block w-full px-3 py-2 text-left text-sm hover:bg-muted'
                    )}
                    onClick={() => adicionar(r)}
                  >
                    {r.sku ? `${r.sku} — ` : ''}{r.nomeVenda}
                  </button>
                ))}
              {resultados.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum produto encontrado.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
