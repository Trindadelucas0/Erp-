'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Search, X } from 'lucide-react'
import { classesCampo, classesCampoAcao } from '@/components/ui/classes-campo'
import { Label } from '@/components/ui/label'
import {
  CabecalhoOpcaoProduto,
  LinhaOpcaoProduto,
} from '@/components/produtos/linha-opcao-produto'
import {
  notificarAberturaDropdownCatalogo,
  useFecharAoSairComMouse,
  useInstanciaDropdownCatalogo,
  useOuvirFechamentoDropdownCatalogo,
} from '@/lib/dropdown-catalogo'
import { textoContemTermo, tokensBusca } from '@/lib/normalizar-busca'
import { resolverUrlUpload } from '@/lib/resolver-url-upload'
import { normalizarCodigoBarrasGtin } from '@/lib/validar-codigo-barras-gtin'
import { cn } from '@/lib/utils'

export type ProdutoOpcao = {
  id: string
  nomeVenda: string
  sku: string | null
  unidade: string
  codigoBarras?: string | null
  codigosBarrasEmbalagem?: (string | null)[]
  urlFotoMiniatura?: string | null
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
  /** Quando informado, Enter com produto já selecionado e lista fechada dispara esta ação (ex.: adicionar item). */
  aoEnterComProdutoSelecionado?: () => void
  /**
   * Busca no servidor (debounce). Quando presente, a lista `produtos` é tratada
   * como resultado/cache da última busca — não como catálogo completo.
   */
  aoBuscar?: (termo: string) => void | Promise<void>
  carregandoBusca?: boolean
  disabled?: boolean
}

const ALTURA_MAXIMA_LISTA = 240
const DEBOUNCE_BUSCA_MS = 300

function codigoBarrasCorresponde(codigo: string | null | undefined, termo: string): boolean {
  if (!codigo?.trim()) return false
  const termoDigitos = normalizarCodigoBarrasGtin(termo)
  if (termoDigitos.length >= 3) {
    const codigoDigitos = normalizarCodigoBarrasGtin(codigo)
    if (codigoDigitos.includes(termoDigitos)) return true
  }
  return textoContemTermo(codigo, termo)
}

export function filtrarProdutos(produtos: ProdutoOpcao[], termo: string) {
  const tokens = tokensBusca(termo)
  if (!tokens.length) return produtos
  return produtos.filter((p) =>
    tokens.every(
      (token) =>
        textoContemTermo(p.nomeVenda, token) ||
        (p.sku ? textoContemTermo(p.sku, token) : false) ||
        codigoBarrasCorresponde(p.codigoBarras, token) ||
        Boolean(
          p.codigosBarrasEmbalagem?.some((codigo) => codigoBarrasCorresponde(codigo, token))
        )
    )
  )
}

export function ComboboxProduto({
  rotulo = 'Produto',
  produtos,
  valor,
  aoMudar,
  aoEnterComProdutoSelecionado,
  aoBuscar,
  carregandoBusca = false,
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
  const zonaHover = useFecharAoSairComMouse(fechar, [containerRef, listaRef])

  useEffect(() => {
    setMontado(true)
  }, [])

  useEffect(() => {
    if (!aberto || !aoBuscar) return
    const timer = setTimeout(() => {
      void aoBuscar(busca)
    }, DEBOUNCE_BUSCA_MS)
    return () => clearTimeout(timer)
  }, [aberto, busca, aoBuscar])

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

  function abrirSeFechado() {
    if (disabled || aberto) return
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

  function aoTeclarBusca(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || e.shiftKey) return

    e.preventDefault()
    e.stopPropagation()

    if (valor && aoEnterComProdutoSelecionado) {
      fechar()
      aoEnterComProdutoSelecionado()
    }
  }

  // Com busca no servidor, a lista já veio filtrada; filtro local só afina a página atual.
  const filtrados = filtrarProdutos(produtos, aberto ? busca : '')
  const textoExibido = selecionado?.nomeVenda ?? ''

  const listaDropdown = aberto && posicao && montado && (
    <div
      className="fixed z-[60] flex flex-col overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md text-sm"
      style={{
        top: posicao.top,
        left: posicao.left,
        width: posicao.width,
        maxHeight: posicao.maxHeight,
      }}
      {...zonaHover}
    >
      {filtrados.length > 0 ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
          <div className="size-8 shrink-0" aria-hidden />
          <CabecalhoOpcaoProduto className="border-0 px-0 py-0" />
        </div>
      ) : null}
      <ul ref={listaRef} role="listbox" className="min-h-0 flex-1 overflow-auto">
        {carregandoBusca && filtrados.length === 0 ? (
          <li className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Buscando...
          </li>
        ) : filtrados.length === 0 ? (
          <li className="px-3 py-2 text-muted-foreground">Nenhum produto encontrado</li>
        ) : (
          filtrados.map((p) => {
            const urlFoto = resolverUrlUpload(p.urlFotoMiniatura)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={valor === p.id}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selecionar(p.id)}
                >
                  {urlFoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={urlFoto}
                      alt=""
                      className="size-8 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="size-8 shrink-0 rounded bg-muted" />
                  )}
                  <LinhaOpcaoProduto sku={p.sku} nome={p.nomeVenda} termoBusca={busca} />
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>
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
              abrirSeFechado()
            }}
            onFocus={() => {
              if (!valor) abrirSeFechado()
            }}
            onKeyDown={aoTeclarBusca}
            disabled={disabled}
            placeholder="Buscar por código, nome ou código de barras..."
            className={cn(classesCampo, 'pl-9 pr-2 text-base md:text-sm')}
          />
          {valor && !disabled && (
            <button
              type="button"
              onClick={limpar}
              className={classesCampoAcao}
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
