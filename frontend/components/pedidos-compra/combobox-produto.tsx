'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  notificarAberturaDropdownCatalogo,
  useFecharAoSairComMouse,
  useInstanciaDropdownCatalogo,
  useOuvirFechamentoDropdownCatalogo,
} from '@/lib/dropdown-catalogo'
import { normalizarCodigoBarrasGtin } from '@/lib/validar-codigo-barras-gtin'
import { cn } from '@/lib/utils'

export type ProdutoOpcao = {
  id: string
  nomeVenda: string
  sku: string | null
  unidade: string
  codigoBarras?: string | null
  codigosBarrasEmbalagem?: (string | null)[]
}

type PosicaoDropdown = {
  top: number
  left: number
  width: number
  maxHeight: number
}

type Props = {
  rotulo?: string
  produtos: ProdutoOpcao[]
  valor: string
  aoMudar: (produtoId: string) => void
  disabled?: boolean
}

const LIMITE = 80
const ALTURA_MAXIMA_LISTA = 240

function rotuloProduto(p: ProdutoOpcao) {
  return p.sku ? `${p.sku} — ${p.nomeVenda}` : p.nomeVenda
}

function codigoBarrasCorresponde(codigo: string | null | undefined, termo: string): boolean {
  if (!codigo?.trim()) return false
  const termoTexto = termo.toLowerCase().trim()
  const termoDigitos = normalizarCodigoBarrasGtin(termo)
  if (termoDigitos.length >= 3) {
    const codigoDigitos = normalizarCodigoBarrasGtin(codigo)
    if (codigoDigitos.includes(termoDigitos)) return true
  }
  return codigo.toLowerCase().includes(termoTexto)
}

export function filtrarProdutos(produtos: ProdutoOpcao[], termo: string) {
  const q = termo.toLowerCase().trim()
  if (!q) return produtos.slice(0, LIMITE)
  return produtos
    .filter((p) => {
      if (p.nomeVenda.toLowerCase().includes(q)) return true
      if (p.sku?.toLowerCase().includes(q)) return true
      if (codigoBarrasCorresponde(p.codigoBarras, termo)) return true
      if (p.codigosBarrasEmbalagem?.some((codigo) => codigoBarrasCorresponde(codigo, termo))) {
        return true
      }
      return false
    })
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
  const [posicao, setPosicao] = useState<PosicaoDropdown | null>(null)
  const [montado, setMontado] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRowRef = useRef<HTMLDivElement>(null)
  const listaRef = useRef<HTMLUListElement>(null)
  const instanciaId = useInstanciaDropdownCatalogo()

  const selecionado = produtos.find((p) => p.id === valor) ?? null

  const fechar = useCallback(() => {
    setAberto(false)
    setBusca('')
  }, [])

  useOuvirFechamentoDropdownCatalogo(instanciaId, fechar)
  const zonaHover = useFecharAoSairComMouse(fechar)

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

  function abrir() {
    if (disabled) return
    notificarAberturaDropdownCatalogo(instanciaId)
    setAberto(true)
  }

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

  const listaDropdown = aberto && posicao && montado && (
    <ul
      ref={listaRef}
      role="listbox"
      {...zonaHover}
      className="fixed z-[60] overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md text-sm"
      style={{
        top: posicao.top,
        left: posicao.left,
        width: posicao.width,
        maxHeight: posicao.maxHeight,
      }}
    >
      {filtrados.length === 0 ? (
        <li className="px-3 py-2 text-muted-foreground">Nenhum produto encontrado</li>
      ) : (
        filtrados.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              role="option"
              aria-selected={valor === p.id}
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
  )

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label>{rotulo}</Label>
      <div className="relative" {...zonaHover}>
        <div ref={inputRowRef} className="relative flex gap-1">
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
            placeholder="Buscar por SKU, nome ou código de barras..."
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
      </div>

      {montado && listaDropdown ? createPortal(listaDropdown, document.body) : null}
    </div>
  )
}
