'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { clienteHttp } from '@/services/api'
import { montarAtalhosPadrao } from '@/lib/atalhos/atalhos-padrao'
import {
  deveIgnorarEmCampoDeTexto,
  elementoAceitaTexto,
  interpretarTecla,
  normalizarTecla,
  teclaDevePrevenirPadrao,
} from '@/lib/atalhos/interpretar-tecla'
import type {
  AtalhoConfigurado,
  ChaveDaAcao,
  CondicoesDeAtalhos,
  HandlersDeAtalhos,
} from '@/lib/atalhos/tipos'
import { PainelAjudaAtalhos } from '@/components/compartilhado/painel-ajuda-atalhos'

const ROTAS_SEM_ATALHOS = ['/login']

type RegistroDaPagina = {
  handlers: HandlersDeAtalhos
  quando: CondicoesDeAtalhos
}

type ContextoDeAtalhos = {
  atalhos: AtalhoConfigurado[]
  carregando: boolean
  painelAberto: boolean
  registrarPagina: (registro: RegistroDaPagina) => () => void
  recarregarAtalhos: () => Promise<void>
  teclaDaAcao: (acao: ChaveDaAcao) => string | undefined
  fecharPainel: () => void
}

const ContextoAtalhos = createContext<ContextoDeAtalhos | null>(null)

export function ProvedorDeAtalhos({ children }: { children: ReactNode }) {
  const caminho = usePathname()
  const [atalhos, setAtalhos] = useState<AtalhoConfigurado[]>(montarAtalhosPadrao())
  const [carregando, setCarregando] = useState(true)
  const [painelAberto, setPainelAberto] = useState(false)
  const registroRef = useRef<RegistroDaPagina>({ handlers: {}, quando: {} })

  const recarregarAtalhos = useCallback(async () => {
    try {
      const { data } = await clienteHttp.get<{ atalhos: AtalhoConfigurado[] }>(
        '/configuracoes/atalhos'
      )
      if (data.atalhos?.length) {
        setAtalhos(data.atalhos)
      }
    } catch {
      setAtalhos(montarAtalhosPadrao())
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (ROTAS_SEM_ATALHOS.includes(caminho)) {
      setCarregando(false)
      return
    }
    recarregarAtalhos()
  }, [caminho, recarregarAtalhos])

  const registrarPagina = useCallback((registro: RegistroDaPagina) => {
    registroRef.current = registro
    return () => {
      registroRef.current = { handlers: {}, quando: {} }
    }
  }, [])

  const mapaTeclas = useMemo(() => {
    const mapa = new Map<string, ChaveDaAcao>()
    for (const atalho of atalhos) {
      if (atalho.ativo) {
        mapa.set(normalizarTecla(atalho.tecla), atalho.acao)
      }
    }
    return mapa
  }, [atalhos])

  const teclaDaAcao = useCallback(
    (acao: ChaveDaAcao) => {
      const encontrado = atalhos.find((a) => a.acao === acao && a.ativo)
      return encontrado?.tecla
    },
    [atalhos]
  )

  const fecharPainel = useCallback(() => setPainelAberto(false), [])

  const executarAcao = useCallback(
    (acao: ChaveDaAcao) => {
      if (acao === 'ajuda') {
        setPainelAberto((aberto) => !aberto)
        return
      }

      const { handlers, quando } = registroRef.current
      const handler = handlers[acao]
      const habilitado = quando[acao] ?? Boolean(handler)

      if (habilitado && handler) {
        handler()
      }
    },
    []
  )

  useEffect(() => {
    if (ROTAS_SEM_ATALHOS.includes(caminho)) return

    function aoPressionarTecla(evento: KeyboardEvent) {
      const tecla = interpretarTecla(evento)
      const acao = mapaTeclas.get(normalizarTecla(tecla))
      if (!acao) return

      if (
        elementoAceitaTexto(evento.target) &&
        deveIgnorarEmCampoDeTexto(tecla, acao)
      ) {
        return
      }

      if (teclaDevePrevenirPadrao(tecla)) {
        evento.preventDefault()
      }

      executarAcao(acao)
    }

    document.addEventListener('keydown', aoPressionarTecla, true)
    return () => document.removeEventListener('keydown', aoPressionarTecla, true)
  }, [caminho, mapaTeclas, executarAcao])

  const valor = useMemo(
    () => ({
      atalhos,
      carregando,
      painelAberto,
      registrarPagina,
      recarregarAtalhos,
      teclaDaAcao,
      fecharPainel,
    }),
    [
      atalhos,
      carregando,
      painelAberto,
      registrarPagina,
      recarregarAtalhos,
      teclaDaAcao,
      fecharPainel,
    ]
  )

  return (
    <ContextoAtalhos.Provider value={valor}>
      {children}
      {painelAberto && (
        <PainelAjudaAtalhos
          atalhos={atalhos}
          registro={registroRef.current}
          aoFechar={fecharPainel}
        />
      )}
    </ContextoAtalhos.Provider>
  )
}

export function useAtalhos() {
  const contexto = useContext(ContextoAtalhos)
  if (!contexto) {
    throw new Error('useAtalhos deve ser usado dentro de ProvedorDeAtalhos')
  }
  return contexto
}

export function useTeclaDaAcao(acao: ChaveDaAcao): string | undefined {
  const { teclaDaAcao } = useAtalhos()
  return teclaDaAcao(acao)
}

export function tituloComAtalho(
  texto: string,
  tecla: string | undefined
): string {
  if (!tecla) return texto
  return `${texto} (${tecla.replace('Escape', 'Esc')})`
}
