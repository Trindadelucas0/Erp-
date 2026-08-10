'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import {
  CabecalhoOpcaoProduto,
  LinhaOpcaoProduto,
} from '@/components/produtos/linha-opcao-produto'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type ProdutoBuscaEstoque = {
  id: string
  sku: string | null
  nomeVenda: string
  unidade: string
}

type Props = {
  valor: ProdutoBuscaEstoque | null
  aoSelecionar: (produto: ProdutoBuscaEstoque | null) => void
  disabled?: boolean
}

const DEBOUNCE_MS = 300

export function BuscaProdutoEstoque({ valor, aoSelecionar, disabled }: Props) {
  const [termo, setTermo] = useState('')
  const [opcoes, setOpcoes] = useState<ProdutoBuscaEstoque[]>([])
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (valor) {
      setTermo(valor.nomeVenda)
    }
  }, [valor])

  useEffect(() => {
    function fecharFora(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fecharFora)
    return () => document.removeEventListener('mousedown', fecharFora)
  }, [])

  const buscar = useCallback(async (q: string) => {
    if (!q.trim()) {
      setOpcoes([])
      return
    }
    setCarregando(true)
    try {
      const { data } = await clienteHttp.get<{
        produtos?: Array<{
          id: string
          sku: string | null
          nomeVenda: string
          unidade: string
        }>
      }>('/produtos', {
        params: { q: q.trim(), limite: 20, pagina: 1, resumo: 'true' },
      })
      const lista = data.produtos ?? []
      setOpcoes(
        lista.map((p) => ({
          id: p.id,
          sku: p.sku,
          nomeVenda: p.nomeVenda,
          unidade: p.unidade,
        }))
      )
      setAberto(true)
    } catch {
      setOpcoes([])
    } finally {
      setCarregando(false)
    }
  }, [])

  function aoDigitar(texto: string) {
    setTermo(texto)
    if (valor) aoSelecionar(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscar(texto), DEBOUNCE_MS)
  }

  function limpar() {
    setTermo('')
    setOpcoes([])
    aoSelecionar(null)
    setAberto(false)
  }

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1 space-y-2">
      <Label htmlFor="busca-produto-estoque">Produto</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="busca-produto-estoque"
          type="text"
          disabled={disabled}
          value={termo}
          onChange={(e) => aoDigitar(e.target.value)}
          onFocus={() => opcoes.length > 0 && setAberto(true)}
          placeholder="Digite o código ou nome do produto"
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent py-1 pr-8 pl-8 text-sm shadow-xs',
            'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none',
            disabled && 'opacity-50'
          )}
        />
        {carregando && (
          <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {!carregando && termo && (
          <button
            type="button"
            aria-label="Limpar produto"
            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={limpar}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {aberto && opcoes.length > 0 && (
        <div className="absolute z-40 mt-1 max-h-60 w-full overflow-hidden rounded-md border bg-popover text-sm shadow-md">
          <CabecalhoOpcaoProduto />
          <ul className="max-h-52 overflow-auto py-1">
            {opcoes.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-baseline gap-2 px-3 py-2 text-left hover:bg-accent"
                  onClick={() => {
                    aoSelecionar(p)
                    setTermo(p.nomeVenda)
                    setAberto(false)
                  }}
                >
                  <LinhaOpcaoProduto
                    sku={p.sku}
                    nome={p.nomeVenda}
                    termoBusca={termo}
                    complemento={
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        · {p.unidade}
                      </span>
                    }
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
