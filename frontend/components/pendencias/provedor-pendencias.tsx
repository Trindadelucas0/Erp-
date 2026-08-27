'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { usePathname } from 'next/navigation'
import { clienteHttp } from '@/services/api'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { DockPendencias } from '@/components/pendencias/dock-pendencias'
import {
  rotaSemDockPendencias,
  type ItemPendencia,
  type ListaPendencias,
  type ResumoPendencias,
} from '@/lib/pendencias'

type ContextoPendencias = {
  resumo: ResumoPendencias | null
  recarregarResumo: () => Promise<void>
}

const Ctx = createContext<ContextoPendencias>({
  resumo: null,
  recarregarResumo: async () => undefined,
})

export function usePendencias() {
  return useContext(Ctx)
}

type Props = {
  children: React.ReactNode
}

export function ProvedorPendencias({ children }: Props) {
  const pathname = usePathname()
  const { estaAutenticado, carregando } = useSessaoDoUsuario()
  const [resumo, setResumo] = useState<ResumoPendencias | null>(null)
  const [itensDock, setItensDock] = useState<ItemPendencia[]>([])
  const [totalDock, setTotalDock] = useState(0)
  const [ocultosPorTela, setOcultosPorTela] = useState<Record<string, string[]>>(
    {}
  )

  const semDock = rotaSemDockPendencias(pathname)
  const telaKey = (pathname ?? '/').split('?')[0]

  const recarregarResumo = useCallback(async () => {
    if (!estaAutenticado) {
      setResumo(null)
      return
    }
    try {
      const { data } = await clienteHttp.get<ResumoPendencias>('/pendencias/resumo')
      setResumo(data)
    } catch {
      setResumo(null)
    }
  }, [estaAutenticado])

  useEffect(() => {
    if (carregando || !estaAutenticado) return
    void recarregarResumo()
    const t = setInterval(() => void recarregarResumo(), 60_000)
    return () => clearInterval(t)
  }, [carregando, estaAutenticado, recarregarResumo])

  useEffect(() => {
    if (carregando || !estaAutenticado || semDock || !pathname) {
      setItensDock([])
      setTotalDock(0)
      return
    }
    let cancelado = false
    ;(async () => {
      try {
        const { data } = await clienteHttp.get<ListaPendencias>('/pendencias', {
          params: { tela: pathname, limite: 3 },
        })
        if (cancelado) return
        setItensDock(data.itens)
        setTotalDock(data.total)
      } catch {
        if (!cancelado) {
          setItensDock([])
          setTotalDock(0)
        }
      }
    })()
    return () => {
      cancelado = true
    }
  }, [carregando, estaAutenticado, pathname, semDock])

  const ocultos = useMemo(
    () => new Set(ocultosPorTela[telaKey] ?? []),
    [ocultosPorTela, telaKey]
  )

  const aoFechar = useCallback(
    (id: string) => {
      setOcultosPorTela((prev) => {
        const atuais = prev[telaKey] ?? []
        if (atuais.includes(id)) return prev
        return { ...prev, [telaKey]: [...atuais, id] }
      })
    },
    [telaKey]
  )

  const valor = useMemo(
    () => ({ resumo, recarregarResumo }),
    [resumo, recarregarResumo]
  )

  return (
    <Ctx.Provider value={valor}>
      {children}
      {!semDock && estaAutenticado && (
        <DockPendencias
          itens={itensDock}
          total={totalDock}
          tela={pathname ?? '/inicio'}
          ocultos={ocultos}
          aoFechar={aoFechar}
        />
      )}
    </Ctx.Provider>
  )
}
