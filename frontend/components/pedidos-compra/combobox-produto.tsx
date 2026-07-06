'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  notificarAberturaDropdownCatalogo,
  useFecharAoSairComMouse,
  useInstanciaDropdownCatalogo,
  useOuvirFechamentoDropdownCatalogo,
} from '@/lib/dropdown-catalogo'
import { cn } from '@/lib/utils'

export type ProdutoOpcao = {
  id: string
  nomeVenda: string
  sku: string | null
  unidade: string
}

type Props = {
  rotulo?: string
  produtos: ProdutoOpcao[]
  valor: string
  aoMudar: (produtoId: string) => void
  disabled?: boolean
}

const LIMITE = 80

function rotuloProduto(p: ProdutoOpcao) {
  return p.sku ? `${p.sku} — ${p.nomeVenda}` : p.nomeVenda
}

function filtrarProdutos(produtos: ProdutoOpcao[], termo: string) {
  const q = termo.toLowerCase().trim()
  if (!q) return produtos.slice(0, LIMITE)
  return produtos
    .filter(
      (p) =>
        p.nomeVenda.toLowerCase().includes(q) ||
        (p.sku?.toLowerCase().includes(q) ?? false)
    )
    .slice(0, LIMITE)
}

export function ComboboxProduto({
  rotulo = 'Produto',
  produtos,
  valor,
  aoMudar,
  disabled,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const instanciaId = useInstanciaDropdownCatalogo()

  const selecionado = produtos.find((p) => p.id === valor) ?? null

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

  function selecionar(id: string) {
    aoMudar(id)
    fechar()
  }

  function limpar() {
    aoMudar('')
    setBusca('')
  }

  const filtrados = filtrarProdutos(produtos, aberto ? busca : '')
  const textoExibido = selecionado ? rotuloProduto(selecionado) : ''

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label>{rotulo}</Label>
      <div className="relative" {...zonaHover}>
        <div className="relative flex gap-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={aberto ? busca : textoExibido}
            onChange={(e) => {
              setBusca(e.target.value)
              abrir()
            }}
            onFocus={abrir}
            disabled={disabled}
            placeholder="Buscar por SKU ou nome..."
            className={cn(
              'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent py-1 pl-9 pr-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30'
            )}
          />
          {valor && !disabled && (
            <button
              type="button"
              onClick={limpar}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground hover:text-destructive"
              aria-label="Limpar produto"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {aberto && (
          <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md text-sm">
            {filtrados.length === 0 ? (
              <li className="px-3 py-2 text-muted-foreground">Nenhum produto encontrado</li>
            ) : (
              filtrados.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selecionar(p.id)}
                  >
                    {p.sku && (
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{p.sku}</span>
                    )}
                    <span className="truncate">{p.nomeVenda}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
