'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import Link from 'next/link'
import { Label } from '@/components/ui/label'
import { classesCampo, classesCampoAcao } from '@/components/ui/classes-campo'
import { TextoDestaqueBusca } from '@/components/ui/texto-destaque-busca'
import { clienteHttp } from '@/services/api'
import {
  notificarAberturaDropdownCatalogo,
  useFecharAoSairComMouse,
  useInstanciaDropdownCatalogo,
  useOuvirFechamentoDropdownCatalogo,
} from '@/lib/dropdown-catalogo'
import { montarDetalheEnderecoWms, type DadosDetalheEnderecoWms } from '@/lib/endereco-wms'
import { cn } from '@/lib/utils'

type EnderecoOpcao = DadosDetalheEnderecoWms & {
  id: string
  codigoCompleto: string
}

type PosicaoDropdown = {
  top: number
  left: number
  width: number
  maxHeight: number
}

type Props = {
  rotulo?: string
  valor: string
  aoMudar: (codigoCompletoOuId: string) => void
  /** Padrão: grava o código completo. `id` grava o UUID do apartamento (Requisições). */
  tipoValor?: 'codigoCompleto' | 'id'
  disabled?: boolean
  mensagemDeErro?: string
}

const LIMITE = 80
const ALTURA_MAXIMA_LISTA = 280

function LinhasDetalheEndereco({ dados, className }: { dados: DadosDetalheEnderecoWms; className?: string }) {
  const detalhe = montarDetalheEnderecoWms(dados)
  if (!detalhe) return null
  return (
    <div className={className}>
      {detalhe.local ? <p>{detalhe.local}</p> : null}
      {detalhe.area ? <p>{detalhe.area}</p> : null}
      {detalhe.caminho ? <p>{detalhe.caminho}</p> : null}
      {detalhe.tipo ? <p>{detalhe.tipo}</p> : null}
    </div>
  )
}

function statusHttp(erro: unknown): number | undefined {
  if (typeof erro !== 'object' || erro === null) return undefined
  const response = (erro as { response?: { status?: number } }).response
  return response?.status
}

export function ComboboxEnderecoWms({
  rotulo = 'Endereço *',
  valor,
  aoMudar,
  tipoValor = 'codigoCompleto',
  disabled,
  mensagemDeErro,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [opcoes, setOpcoes] = useState<EnderecoOpcao[]>([])
  const [carregando, setCarregando] = useState(false)
  const [semPermissao, setSemPermissao] = useState(false)
  const [erroRede, setErroRede] = useState(false)
  const [escolhido, setEscolhido] = useState<EnderecoOpcao | null>(null)
  const [posicao, setPosicao] = useState<PosicaoDropdown | null>(null)
  const [montado, setMontado] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRowRef = useRef<HTMLDivElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const instanciaId = useInstanciaDropdownCatalogo()

  const fechar = useCallback(() => {
    setAberto(false)
    setBusca('')
  }, [])

  useOuvirFechamentoDropdownCatalogo(instanciaId, fechar)
  const zonaHover = useFecharAoSairComMouse(fechar, [containerRef, listaRef])

  useEffect(() => {
    setMontado(true)
  }, [])

  const atualizarPosicao = useCallback(() => {
    const linha = inputRowRef.current
    if (!linha) return

    const rect = linha.getBoundingClientRect()
    const espacoAbaixo = window.innerHeight - rect.bottom - 8
    setPosicao({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 320),
      maxHeight: Math.min(ALTURA_MAXIMA_LISTA, Math.max(espacoAbaixo, 160)),
    })
  }, [])

  const trazerCampoParaVista = useCallback(() => {
    inputRowRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    requestAnimationFrame(() => atualizarPosicao())
  }, [atualizarPosicao])

  const carregar = useCallback(async (termo: string) => {
    if (!termo.trim()) {
      setOpcoes([])
      setCarregando(false)
      setErroRede(false)
      requestAnimationFrame(() => atualizarPosicao())
      return
    }
    setCarregando(true)
    setErroRede(false)
    try {
      const params = new URLSearchParams()
      params.set('q', termo.trim())
      params.set('take', String(LIMITE))
      const { data } = await clienteHttp.get(`/enderecos-wms?${params}`)
      setOpcoes((data.enderecos ?? []).slice(0, LIMITE) as EnderecoOpcao[])
      setSemPermissao(false)
    } catch (erro: unknown) {
      setOpcoes([])
      if (statusHttp(erro) === 403) setSemPermissao(true)
      else setErroRede(true)
    } finally {
      setCarregando(false)
      requestAnimationFrame(() => atualizarPosicao())
    }
  }, [atualizarPosicao])

  function abrirSeFechado() {
    if (disabled || aberto) return
    notificarAberturaDropdownCatalogo(instanciaId)
    setAberto(true)
  }

  useEffect(() => {
    if (!aberto) return
    trazerCampoParaVista()
    function aoScrollOuResize() {
      atualizarPosicao()
    }
    window.addEventListener('scroll', aoScrollOuResize, true)
    window.addEventListener('resize', aoScrollOuResize)
    return () => {
      window.removeEventListener('scroll', aoScrollOuResize, true)
      window.removeEventListener('resize', aoScrollOuResize)
    }
  }, [aberto, atualizarPosicao, trazerCampoParaVista])

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

  useEffect(() => {
    if (!aberto) return
    const termo = busca.trim()
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void carregar(termo)
    }, 250)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [busca, aberto, carregar])

  function selecionar(item: EnderecoOpcao) {
    setEscolhido(item)
    aoMudar(tipoValor === 'id' ? item.id : item.codigoCompleto)
    fechar()
  }

  function limpar() {
    setEscolhido(null)
    aoMudar('')
    setBusca('')
  }

  useEffect(() => {
    if (!valor.trim()) {
      setEscolhido(null)
      return
    }
    if (tipoValor === 'id' && escolhido?.id === valor) return
    if (tipoValor !== 'id' && escolhido?.codigoCompleto === valor) return
    const daLista = opcoes.find((o) => (tipoValor === 'id' ? o.id === valor : o.codigoCompleto === valor))
    if (daLista) {
      setEscolhido(daLista)
      return
    }
    let cancelado = false
    void (async () => {
      try {
        if (tipoValor === 'id') {
          const { data } = await clienteHttp.get(`/enderecos-wms/${valor}`)
          const hit = data.endereco as EnderecoOpcao | undefined
          if (!cancelado && hit) setEscolhido(hit)
          return
        }
        const params = new URLSearchParams()
        params.set('q', valor.trim())
        params.set('take', '5')
        const { data } = await clienteHttp.get(`/enderecos-wms?${params}`)
        const hit = (data.enderecos as EnderecoOpcao[] | undefined)?.find((e) => e.codigoCompleto === valor)
        if (!cancelado && hit) setEscolhido(hit)
      } catch {
        /* detalhe fica só pelo código */
      }
    })()
    return () => {
      cancelado = true
    }
  }, [valor, opcoes, escolhido?.codigoCompleto, escolhido?.id, tipoValor])

  const listaDropdown = aberto && posicao && montado && (
    <div
      ref={listaRef}
      className="fixed z-[80] flex flex-col overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md text-sm"
      style={{
        top: posicao.top,
        left: posicao.left,
        width: posicao.width,
        maxHeight: posicao.maxHeight,
      }}
      {...zonaHover}
    >
      <ul className="min-h-0 flex-1 overflow-auto">
        {carregando && <li className="px-3 py-2 text-muted-foreground">Buscando...</li>}
        {!carregando && semPermissao && (
          <li className="px-3 py-2 text-muted-foreground">
            Sem permissão para ver Endereços WMS. Cadastre o apartamento em Logística → Endereços WMS
            ou peça acesso a essa tela.
          </li>
        )}
        {!carregando && erroRede && !semPermissao && (
          <li className="px-3 py-2 text-muted-foreground">Não foi possível buscar endereços.</li>
        )}
        {!carregando && !semPermissao && !erroRede && !busca.trim() && (
          <li className="px-3 py-2 text-muted-foreground">
            Digite o código do apartamento (ex.: A-RC-20-01-2-05) ou trechos (RC 20 05). Local e área da
            árvore não aparecem aqui.
          </li>
        )}
        {!carregando && !semPermissao && !erroRede && busca.trim() && opcoes.length === 0 && (
          <li className="px-3 py-2 text-muted-foreground">
            Nenhum apartamento encontrado. Na tela Endereços WMS abra até o andar e cadastre o
            apartamento (folha da árvore). RC, Expedição e o prédio sozinhos não são endereço de produto.
          </li>
        )}
        {!carregando &&
          opcoes.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selecionar(item)}
              >
                <TextoDestaqueBusca texto={item.codigoCompleto} termo={busca} className="font-medium" />
                <LinhasDetalheEndereco dados={item} className="mt-1 space-y-0.5 text-xs text-muted-foreground" />
              </button>
            </li>
          ))}
      </ul>
      <div className="shrink-0 border-t border-border px-3 py-2">
        <Link
          href="/enderecos-wms"
          className="text-xs text-primary underline-offset-2 hover:underline"
          onMouseDown={(e) => e.preventDefault()}
        >
          Cadastrar apartamento em Endereços WMS
        </Link>
      </div>
    </div>
  )

  return (
    <div className="space-y-1" ref={containerRef}>
      <Label>{rotulo}</Label>
      <div className="relative" {...zonaHover}>
        <div className="relative flex gap-1" ref={inputRowRef}>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={aberto ? busca : tipoValor === 'id' ? escolhido?.codigoCompleto ?? '' : valor}
            onChange={(e) => {
              setBusca(e.target.value)
              abrirSeFechado()
            }}
            onFocus={abrirSeFechado}
            disabled={disabled}
            placeholder="Buscar apartamento (ex.: A-RC-20-01-2-05)"
            autoComplete="off"
            className={cn(
              classesCampo,
              'pl-9 pr-2 text-base md:text-sm',
              mensagemDeErro && 'border-destructive'
            )}
          />
          {valor && !disabled && (
            <button type="button" onClick={limpar} className={classesCampoAcao} aria-label="Limpar endereço">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      {montado && listaDropdown ? createPortal(listaDropdown, document.body) : null}
      {!aberto && valor.trim() ? (
        <LinhasDetalheEndereco
          dados={
            escolhido
              ? escolhido
              : tipoValor === 'id'
                ? { codigoCompleto: '' }
                : { codigoCompleto: valor }
          }
          className="space-y-0.5 text-xs text-muted-foreground"
        />
      ) : null}
      {mensagemDeErro && <p className="text-sm text-destructive">{mensagemDeErro}</p>}
    </div>
  )
}
