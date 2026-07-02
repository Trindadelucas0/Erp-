'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { MSG_PLANO_SOMENTE_DESPESA, MSG_PLANO_SOMENTE_SUBGRUPO, planoEhDespesa, planoEhSubgrupo } from '@/lib/plano-financeiro'
import {
  notificarAberturaDropdownCatalogo,
  useInstanciaDropdownCatalogo,
  useOuvirFechamentoDropdownCatalogo,
} from '@/lib/dropdown-catalogo'
import { cn } from '@/lib/utils'

export type PlanoCfopPar = {
  planoFinanceiroId: string
  planoCodigo: string
  planoDescricao: string
  planoTipo?: string
  cfopId: string
  cfopCodigo: string
  cfopDescricao: string
}

type ItemCatalogo = { id: string; codigo: string; descricao: string; tipo?: string }

type Props = {
  pares: PlanoCfopPar[]
  aoMudar: (pares: PlanoCfopPar[]) => void
  disabled?: boolean
}

function ComboboxItem({
  rotulo,
  endpoint,
  queryParams,
  tipoPlanoEsperado,
  valor,
  aoSelecionar,
  aoLimpar,
  disabled,
  invalido,
}: {
  rotulo: string
  endpoint: string
  queryParams?: string
  tipoPlanoEsperado?: 'despesa'
  valor: { id: string; codigo: string; descricao: string; tipo?: string } | null
  aoSelecionar: (item: ItemCatalogo) => void
  aoLimpar: () => void
  disabled?: boolean
  invalido?: boolean
}) {
  const [busca, setBusca] = useState('')
  const [itens, setItens] = useState<ItemCatalogo[]>([])
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erroSelecao, setErroSelecao] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const instanciaId = useInstanciaDropdownCatalogo()

  const fechar = useCallback(() => setAberto(false), [])

  useOuvirFechamentoDropdownCatalogo(instanciaId, fechar)

  function abrir() {
    notificarAberturaDropdownCatalogo(instanciaId)
    setAberto(true)
  }

  useEffect(() => {
    if (!aberto) return
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [aberto])

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
    if (tipoPlanoEsperado === 'despesa' && !planoEhDespesa(item)) {
      setErroSelecao(MSG_PLANO_SOMENTE_DESPESA)
      return
    }
    if (queryParams?.includes('somenteSubgrupo=true') && !planoEhSubgrupo(item)) {
      setErroSelecao(MSG_PLANO_SOMENTE_SUBGRUPO)
      return
    }
    setErroSelecao('')
    aoSelecionar(item)
    setAberto(false)
    setBusca('')
  }

  const textoAtual = valor ? `${valor.codigo} — ${valor.descricao}` : ''

  return (
    <div ref={ref} className="relative flex-1 space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{rotulo}</label>
      <div className="flex gap-1">
        <input
          className={cn(
            'flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50',
            (invalido || erroSelecao) && 'border-destructive'
          )}
          value={aberto ? busca : textoAtual}
          placeholder="Buscar..."
          disabled={disabled}
          onChange={(e) => { setBusca(e.target.value); setErroSelecao(''); abrir() }}
          onFocus={abrir}
        />
        {valor && !disabled && (
          <button
            type="button"
            onClick={aoLimpar}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground hover:text-destructive"
            aria-label="Limpar"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {(invalido || erroSelecao) && (
        <p className="text-xs text-destructive">{erroSelecao || MSG_PLANO_SOMENTE_DESPESA}</p>
      )}
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
        ? {
            ...par,
            planoFinanceiroId: item.id,
            planoCodigo: item.codigo,
            planoDescricao: item.descricao,
            planoTipo: item.tipo,
          }
        : par
    ))
  }

  function limparPlano(idx: number) {
    aoMudar(pares.map((par, i) =>
      i === idx
        ? { ...par, planoFinanceiroId: '', planoCodigo: '', planoDescricao: '', planoTipo: undefined }
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

  function limparCfop(idx: number) {
    aoMudar(pares.map((par, i) =>
      i === idx
        ? { ...par, cfopId: '', cfopCodigo: '', cfopDescricao: '' }
        : par
    ))
  }

  return (
    <div className="space-y-3">
      {pares.map((par, idx) => {
        const planoInvalido =
          !!par.planoFinanceiroId &&
          (!planoEhDespesa({ codigo: par.planoCodigo, tipo: par.planoTipo }) ||
            !planoEhSubgrupo({ codigo: par.planoCodigo }))
        return (
          <div
            key={idx}
            className={cn(
              'flex items-end gap-2 rounded-md border p-3',
              planoInvalido ? 'border-destructive bg-destructive/5' : 'border-border'
            )}
          >
            <ComboboxItem
              rotulo="Plano Financeiro"
              endpoint="/planos-financeiros"
              queryParams="tipo=despesa&somenteSubgrupo=true"
              tipoPlanoEsperado="despesa"
              valor={par.planoFinanceiroId ? { id: par.planoFinanceiroId, codigo: par.planoCodigo, descricao: par.planoDescricao, tipo: par.planoTipo } : null}
              aoSelecionar={(item) => atualizarPlano(idx, item)}
              aoLimpar={() => limparPlano(idx)}
              disabled={disabled}
              invalido={planoInvalido}
            />
            <ComboboxItem
              rotulo="CFOP Entrada"
              endpoint="/cfops"
              queryParams="tipo=entrada"
              valor={par.cfopId ? { id: par.cfopId, codigo: par.cfopCodigo, descricao: par.cfopDescricao } : null}
              aoSelecionar={(item) => atualizarCfop(idx, item)}
              aoLimpar={() => limparCfop(idx)}
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
        )
      })}
      {!disabled && (
        <button type="button" onClick={adicionar} className="text-sm text-primary underline">
          + Adicionar par padrão
        </button>
      )}
    </div>
  )
}
