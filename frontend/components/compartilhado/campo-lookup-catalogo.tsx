'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { MSG_PLANO_SOMENTE_DESPESA, planoEhDespesa } from '@/lib/plano-financeiro'
import {
  notificarAberturaDropdownCatalogo,
  useFecharAoSairComMouse,
  useInstanciaDropdownCatalogo,
  useOuvirFechamentoDropdownCatalogo,
} from '@/lib/dropdown-catalogo'
import { classesCampo, classesCampoAcao } from '@/components/ui/classes-campo'
import { cn } from '@/lib/utils'
import { TextoDestaqueBusca } from '@/components/ui/texto-destaque-busca'

export type ItemCatalogo = { id: string; codigo: string; descricao: string; tipo?: string }

type Props = {
  rotulo: string
  endpoint: '/planos-financeiros' | '/cfops'
  queryParams?: string
  tipoPlanoEsperado?: 'despesa'
  valor: ItemCatalogo | null
  aoSelecionar: (item: ItemCatalogo | null) => void
  disabled?: boolean
}

export function CampoLookupCatalogo({
  rotulo,
  endpoint,
  queryParams,
  tipoPlanoEsperado,
  valor,
  aoSelecionar,
  disabled,
}: Props) {
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
  const zonaHover = useFecharAoSairComMouse(fechar, [ref])

  function abrirSeFechado() {
    if (disabled || aberto) return
    notificarAberturaDropdownCatalogo(instanciaId)
    setAberto(true)
  }

  function textoSelecionadoAtual(): string {
    return valor ? `${valor.codigo} - ${valor.descricao}` : ''
  }

  const valorInvalido =
    !!valor &&
    endpoint === '/planos-financeiros' &&
    tipoPlanoEsperado === 'despesa' &&
    !planoEhDespesa(valor)

  const termoDestaque = aberto
    ? busca.includes(' - ')
      ? (busca.split(' - ').pop() ?? busca)
      : busca
    : ''

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
    if (!aberto) return
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [aberto])

  function tentarSelecionar(item: ItemCatalogo) {
    if (
      endpoint === '/planos-financeiros' &&
      tipoPlanoEsperado === 'despesa' &&
      !planoEhDespesa(item)
    ) {
      setErroSelecao(MSG_PLANO_SOMENTE_DESPESA)
      return
    }
    setErroSelecao('')
    aoSelecionar(item)
    setBusca(`${item.codigo} - ${item.descricao}`)
    setAberto(false)
  }

  function limpar() {
    setErroSelecao('')
    aoSelecionar(null)
    setBusca('')
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold leading-none">{rotulo}</label>
      <div ref={ref} className="relative" {...zonaHover}>
        <div className="flex gap-1.5">
          <input
            className={cn(
              classesCampo,
              'disabled:opacity-50',
              (valorInvalido || erroSelecao) && 'border-destructive'
            )}
            value={busca}
            onChange={(e) => {
              const texto = e.target.value
              setBusca(texto)
              setErroSelecao('')
              abrirSeFechado()
              if (valor && texto !== textoSelecionadoAtual()) {
                aoSelecionar(null)
              }
            }}
            onFocus={abrirSeFechado}
            disabled={disabled}
            placeholder="Buscar..."
          />
          {valor && !disabled && (
            <button
              type="button"
              className={classesCampoAcao}
              onClick={limpar}
              aria-label="Limpar seleção"
            >
              <X className="size-4" />
            </button>
          )}
          <button
            type="button"
            className={cn(classesCampoAcao, 'hover:text-foreground')}
            onClick={() => (aberto ? fechar() : abrirSeFechado())}
            disabled={disabled}
          >
            <Search className="size-4" />
          </button>
        </div>
        {aberto && (
          <div className="absolute left-0 right-0 top-full z-20 pt-1">
            <div className="max-h-48 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
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
                  onMouseDown={(e) => {
                    e.preventDefault()
                    tentarSelecionar(item)
                  }}
                >
                  <TextoDestaqueBusca texto={item.codigo} termo={termoDestaque} />
                  {' - '}
                  <TextoDestaqueBusca texto={item.descricao} termo={termoDestaque} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {(valorInvalido || erroSelecao) && (
        <p className="text-xs text-destructive">
          {erroSelecao || MSG_PLANO_SOMENTE_DESPESA}
        </p>
      )}
    </div>
  )
}
