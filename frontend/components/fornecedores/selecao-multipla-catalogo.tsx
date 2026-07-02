'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { MSG_PLANO_SOMENTE_DESPESA, MSG_PLANO_SOMENTE_SUBGRUPO, planoEhDespesa, planoEhSubgrupo } from '@/lib/plano-financeiro'
import {
  notificarAberturaDropdownCatalogo,
  useInstanciaDropdownCatalogo,
  useOuvirFechamentoDropdownCatalogo,
} from '@/lib/dropdown-catalogo'
import { cn } from '@/lib/utils'
export type ItemCatalogo = {
  id: string
  codigo: string
  descricao: string
  tipo?: string
}

type Props = {
  rotulo: string
  ajuda?: string
  endpoint: '/planos-financeiros' | '/cfops'
  tipoCfop?: string
  tipoPlano?: string
  somenteSubgrupo?: boolean
  selecionados: ItemCatalogo[]
  aoMudar: (itens: ItemCatalogo[]) => void
  disabled?: boolean
}

export function SelecaoMultiplaCatalogo({
  rotulo,
  ajuda,
  endpoint,
  tipoCfop,
  tipoPlano,
  somenteSubgrupo,
  selecionados,
  aoMudar,
  disabled,
}: Props) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<ItemCatalogo[]>([])
  const [abrindo, setAbrindo] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erroSelecao, setErroSelecao] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const instanciaId = useInstanciaDropdownCatalogo()

  const fechar = useCallback(() => setAbrindo(false), [])

  useOuvirFechamentoDropdownCatalogo(instanciaId, fechar)

  function abrir() {
    notificarAberturaDropdownCatalogo(instanciaId)
    setAbrindo(true)
  }

  useEffect(() => {
    if (!abrindo) return
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbrindo(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [abrindo])

  useEffect(() => {
    if (!abrindo) return
    const timer = setTimeout(async () => {
      setCarregando(true)
      try {
        const params: Record<string, string> = { q: busca }
        if (endpoint === '/cfops' && tipoCfop) params.tipo = tipoCfop
        if (endpoint === '/planos-financeiros' && tipoPlano) params.tipo = tipoPlano
        if (endpoint === '/planos-financeiros' && somenteSubgrupo) params.somenteSubgrupo = 'true'
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
  }, [busca, abrindo, endpoint, tipoCfop, tipoPlano, somenteSubgrupo, selecionados])

  function adicionar(item: ItemCatalogo) {
    if (
      endpoint === '/planos-financeiros' &&
      tipoPlano === 'despesa' &&
      !planoEhDespesa(item)
    ) {
      setErroSelecao(MSG_PLANO_SOMENTE_DESPESA)
      return
    }
    if (
      endpoint === '/planos-financeiros' &&
      somenteSubgrupo &&
      !planoEhSubgrupo(item)
    ) {
      setErroSelecao(MSG_PLANO_SOMENTE_SUBGRUPO)
      return
    }
    setErroSelecao('')
    aoMudar([...selecionados, item])
    setBusca('')
    setAbrindo(false)
  }

  function remover(id: string) {
    aoMudar(selecionados.filter((s) => s.id !== id))
  }

  return (
    <div ref={ref} className="space-y-2">
      <label className="text-sm font-medium leading-none">{rotulo}</label>
      <div className="relative">
        <div className="flex items-center gap-2">
          <input
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setErroSelecao('')
              abrir()
            }}
            onFocus={abrir}
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

      {erroSelecao && (
        <p className="text-xs text-destructive">{erroSelecao}</p>
      )}

      {selecionados.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selecionados.map((item) => {
            const invalido =
              endpoint === '/planos-financeiros' &&
              ((tipoPlano === 'despesa' && !planoEhDespesa(item)) ||
                (somenteSubgrupo && !planoEhSubgrupo(item)))
            return (
              <span
                key={item.id}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs',
                  invalido
                    ? 'border-destructive bg-destructive/10 text-destructive'
                    : 'border-border bg-muted/30'
                )}
              >
                <span className="font-mono">{item.codigo}</span>
                <span className={invalido ? '' : 'text-muted-foreground'}>
                  — {item.descricao}
                </span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => remover(item.id)}
                    className="text-destructive"
                    aria-label="Remover"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}

      {ajuda && (
        <p className="rounded-md bg-primary/15 px-3 py-2 text-xs text-primary">{ajuda}</p>
      )}
    </div>
  )
}
