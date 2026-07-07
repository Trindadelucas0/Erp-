'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  notificarAberturaDropdownCatalogo,
  useFecharAoSairComMouse,
  useInstanciaDropdownCatalogo,
  useOuvirFechamentoDropdownCatalogo,
} from '@/lib/dropdown-catalogo'
import { cn } from '@/lib/utils'

type Props = {
  rotulo?: string
  valor: string
  aoMudar: (marca: string) => void
  disabled?: boolean
  mensagemDeErro?: string
}

const LIMITE = 80

export function ComboboxMarca({
  rotulo = 'Marca *',
  valor,
  aoMudar,
  disabled,
  mensagemDeErro,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [marcas, setMarcas] = useState<string[]>([])
  const [carregando, setCarregando] = useState(false)
  const [mostrarCadastro, setMostrarCadastro] = useState(false)
  const [novaMarca, setNovaMarca] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroCadastro, setErroCadastro] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const instanciaId = useInstanciaDropdownCatalogo()

  const fechar = useCallback(() => {
    setAberto(false)
    setBusca('')
  }, [])

  useOuvirFechamentoDropdownCatalogo(instanciaId, fechar)
  const zonaHover = useFecharAoSairComMouse(fechar)

  const carregarMarcas = useCallback(async (termo?: string) => {
    setCarregando(true)
    try {
      const params = new URLSearchParams()
      if (termo) params.set('q', termo)
      const { data } = await clienteHttp.get(`/produtos/marcas?${params}`)
      setMarcas(data.marcas ?? [])
    } catch {
      setMarcas([])
    } finally {
      setCarregando(false)
    }
  }, [])

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

  useEffect(() => {
    if (!aberto) return
    const termo = busca.trim()
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void carregarMarcas(termo || undefined)
    }, 250)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [busca, aberto, carregarMarcas])

  const termoBusca = busca.toLowerCase().trim()
  let filtradas = marcas
  if (termoBusca) {
    filtradas = marcas.filter((m) => m.toLowerCase().includes(termoBusca))
  }
  filtradas = filtradas.slice(0, LIMITE)

  const opcoes = [...new Set([...(valor && !filtradas.includes(valor) ? [valor] : []), ...filtradas])]

  function selecionar(marca: string) {
    aoMudar(marca.toUpperCase())
    fechar()
  }

  function limpar() {
    aoMudar('')
    setBusca('')
  }

  async function cadastrarMarca() {
    setErroCadastro('')
    setSalvando(true)
    try {
      const nome = novaMarca.trim().toUpperCase()
      const { data } = await clienteHttp.post('/produtos/marcas', { nome })
      await carregarMarcas()
      aoMudar(data.marca.nome)
      setNovaMarca('')
      setMostrarCadastro(false)
      fechar()
    } catch (err: unknown) {
      setErroCadastro(extrairMensagemApi(err, 'Erro ao cadastrar marca'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <Label>{rotulo}</Label>
          <div className="relative" {...zonaHover}>
            <div className="relative flex gap-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={aberto ? busca : valor}
                onChange={(e) => {
                  setBusca(e.target.value)
                  abrir()
                }}
                onFocus={abrir}
                disabled={disabled}
                placeholder="Buscar marca..."
                className={cn(
                  'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent py-1 pl-9 pr-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
                  mensagemDeErro && 'border-destructive'
                )}
              />
              {valor && !disabled && (
                <button
                  type="button"
                  onClick={limpar}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground hover:text-destructive"
                  aria-label="Limpar marca"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {aberto && (
              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md text-sm">
                {carregando && (
                  <li className="px-3 py-2 text-muted-foreground">Buscando...</li>
                )}
                {!carregando && opcoes.length === 0 && (
                  <li className="px-3 py-2 text-muted-foreground">Nenhuma marca encontrada</li>
                )}
                {!carregando &&
                  opcoes.map((marca) => (
                    <li key={marca}>
                      <button
                        type="button"
                        className="flex w-full items-start px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selecionar(marca)}
                      >
                        <span className="truncate">{marca}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>

        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mb-0.5 shrink-0"
            onClick={() => setMostrarCadastro((v) => !v)}
          >
            <Plus className="mr-1 size-4" />
            Nova marca
          </Button>
        )}
      </div>

      {mostrarCadastro && !disabled && (
        <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3">
          <InputPadrao
            rotulo="Nome da marca *"
            value={novaMarca}
            onChange={(e) => setNovaMarca(e.target.value.toUpperCase())}
            placeholder="Ex.: MARCA EXEMPLO"
            maxLength={100}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMostrarCadastro(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={salvando || novaMarca.trim().length < 1}
              onClick={() => void cadastrarMarca()}
            >
              {salvando ? 'Salvando...' : 'Cadastrar'}
            </Button>
          </div>
          {erroCadastro && <p className="text-sm text-destructive">{erroCadastro}</p>}
        </div>
      )}

      {mensagemDeErro && <p className="text-sm text-destructive">{mensagemDeErro}</p>}
    </div>
  )
}
