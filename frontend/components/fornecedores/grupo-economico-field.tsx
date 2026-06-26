'use client'

import { useEffect, useRef, useState } from 'react'
import { clienteHttp } from '@/services/api'

type GrupoItem = { id: string; nome: string }

type Props = {
  value: { id: string; nome: string }
  aoMudar: (id: string, nome: string) => void
  disabled?: boolean
}

export function GrupoEconomicoField({ value, aoMudar, disabled }: Props) {
  const [busca, setBusca] = useState('')
  const [itens, setItens] = useState<GrupoItem[]>([])
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!aberto) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setCarregando(true)
      try {
        const { data } = await clienteHttp.get(`/grupos-economicos?q=${encodeURIComponent(busca.trim())}`)
        setItens(data.grupos ?? [])
      } catch {
        setItens([])
      } finally {
        setCarregando(false)
      }
    }, 250)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [busca, aberto])

  function selecionar(item: GrupoItem) {
    aoMudar(item.id, item.nome)
    setAberto(false)
    setBusca('')
  }

  async function criarESelecionar() {
    const nome = busca.trim()
    if (!nome) return
    try {
      const { data } = await clienteHttp.post('/grupos-economicos', { nome })
      aoMudar(data.grupo.id, data.grupo.nome)
    } catch {
      // ignore
    }
    setAberto(false)
    setBusca('')
  }

  function limpar() {
    aoMudar('', '')
  }

  const textoAtual = value.nome || ''
  const mostrarCriar = busca.trim() && !itens.some((i) => i.nome.toLowerCase() === busca.trim().toLowerCase())

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium leading-none">Grupo Econômico</label>
        {value.id && (
          <button type="button" onClick={limpar} className="text-xs text-muted-foreground hover:text-destructive">
            Remover vínculo
          </button>
        )}
      </div>
      <div className="relative">
        <input
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          value={aberto ? busca : textoAtual}
          placeholder="Buscar ou criar grupo..."
          disabled={disabled}
          onChange={(e) => { setBusca(e.target.value); setAberto(true) }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 200)}
        />
        {aberto && (
          <div className="absolute z-50 mt-0.5 w-full rounded-md border border-border bg-popover shadow-md">
            {carregando && <div className="px-3 py-2 text-xs text-muted-foreground">Buscando...</div>}
            {!carregando && itens.length === 0 && !mostrarCriar && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum grupo encontrado</div>
            )}
            {itens.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(e) => { e.preventDefault(); selecionar(item) }}
              >
                {item.nome}
              </button>
            ))}
            {mostrarCriar && (
              <button
                type="button"
                className="flex w-full items-center gap-1 border-t border-border px-3 py-2 text-left text-sm text-primary hover:bg-muted"
                onMouseDown={(e) => { e.preventDefault(); criarESelecionar() }}
              >
                <span>+ Criar grupo</span>
                <span className="font-medium">"{busca.trim()}"</span>
              </button>
            )}
          </div>
        )}
      </div>
      {value.nome && (
        <p className="text-xs text-muted-foreground">Vinculado ao grupo: <span className="font-medium">{value.nome}</span></p>
      )}
    </div>
  )
}
