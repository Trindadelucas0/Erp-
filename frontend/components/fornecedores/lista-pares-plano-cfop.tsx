'use client'

import { useEffect, useRef, useState } from 'react'
import { clienteHttp } from '@/services/api'

export type PlanoCfopPar = {
  planoFinanceiroId: string
  planoCodigo: string
  planoDescricao: string
  cfopId: string
  cfopCodigo: string
  cfopDescricao: string
}

type ItemCatalogo = { id: string; codigo: string; descricao: string }

type Props = {
  pares: PlanoCfopPar[]
  aoMudar: (pares: PlanoCfopPar[]) => void
  disabled?: boolean
}

function ComboboxItem({
  rotulo,
  endpoint,
  queryParams,
  valor,
  aoSelecionar,
  disabled,
}: {
  rotulo: string
  endpoint: string
  queryParams?: string
  valor: { id: string; codigo: string; descricao: string } | null
  aoSelecionar: (item: ItemCatalogo) => void
  disabled?: boolean
}) {
  const [busca, setBusca] = useState('')
  const [itens, setItens] = useState<ItemCatalogo[]>([])
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const refInput = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!aberto) return
    const q = busca.trim()
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setCarregando(true)
      try {
        const url = `${endpoint}?q=${encodeURIComponent(q)}${queryParams ? `&${queryParams}` : ''}`
        const { data } = await clienteHttp.get(url)
        const lista: ItemCatalogo[] = data.planos ?? data.cfops ?? []
        setItens(lista)
      } catch {
        setItens([])
      } finally {
        setCarregando(false)
      }
    }, 250)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [busca, aberto, endpoint, queryParams])

  function selecionar(item: ItemCatalogo) {
    aoSelecionar(item)
    setAberto(false)
    setBusca('')
  }

  const textoAtual = valor ? `${valor.codigo} — ${valor.descricao}` : ''

  return (
    <div className="relative space-y-1 flex-1">
      <label className="text-xs font-medium text-muted-foreground">{rotulo}</label>
      <input
        ref={refInput}
        className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        value={aberto ? busca : textoAtual}
        placeholder="Buscar..."
        disabled={disabled}
        onChange={(e) => { setBusca(e.target.value); setAberto(true) }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
      />
      {aberto && (
        <div className="absolute z-50 mt-0.5 w-full rounded-md border border-border bg-popover shadow-md">
          {carregando && <div className="px-3 py-2 text-xs text-muted-foreground">Buscando...</div>}
          {!carregando && itens.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum resultado</div>}
          {itens.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              onMouseDown={(e) => { e.preventDefault(); selecionar(item) }}
            >
              <span className="font-mono text-xs text-muted-foreground">{item.codigo}</span>
              <span className="truncate">{item.descricao}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const PAR_VAZIO: PlanoCfopPar = {
  planoFinanceiroId: '', planoCodigo: '', planoDescricao: '',
  cfopId: '', cfopCodigo: '', cfopDescricao: '',
}

export function ListaParesPlanoCfop({ pares, aoMudar, disabled }: Props) {
  function adicionar() {
    aoMudar([...pares, { ...PAR_VAZIO }])
  }

  function remover(idx: number) {
    aoMudar(pares.filter((_, i) => i !== idx))
  }

  function atualizarPlano(idx: number, item: ItemCatalogo) {
    aoMudar(pares.map((par, i) =>
      i === idx
        ? { ...par, planoFinanceiroId: item.id, planoCodigo: item.codigo, planoDescricao: item.descricao }
        : par
    ))
  }

  function atualizarCfop(idx: number, item: ItemCatalogo) {
    aoMudar(pares.map((par, i) =>
      i === idx
        ? { ...par, cfopId: item.id, cfopCodigo: item.codigo, cfopDescricao: item.descricao }
        : par
    ))
  }

  return (
    <div className="space-y-3">
      {pares.map((par, idx) => (
        <div key={idx} className="flex items-end gap-2 rounded-md border border-border p-3">
          <ComboboxItem
            rotulo="Plano Financeiro"
            endpoint="/planos-financeiros"
            valor={par.planoFinanceiroId ? { id: par.planoFinanceiroId, codigo: par.planoCodigo, descricao: par.planoDescricao } : null}
            aoSelecionar={(item) => atualizarPlano(idx, item)}
            disabled={disabled}
          />
          <ComboboxItem
            rotulo="CFOP Entrada"
            endpoint="/cfops"
            queryParams="tipo=entrada"
            valor={par.cfopId ? { id: par.cfopId, codigo: par.cfopCodigo, descricao: par.cfopDescricao } : null}
            aoSelecionar={(item) => atualizarCfop(idx, item)}
            disabled={disabled}
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => remover(idx)}
              className="mb-0.5 shrink-0 text-xs text-destructive hover:underline"
            >
              Remover
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button" onClick={adicionar} className="text-sm text-primary underline">
          + Adicionar par padrão
        </button>
      )}
    </div>
  )
}
