'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { clienteHttp } from '@/services/api'
import {
  aplicarTemaNoDocumento,
  lerTemaDoCookie,
  salvarTemaNoCookie,
  TEMA_PADRAO,
  temaDoUsuario,
  type TemaDoSistema,
} from '@/lib/tema'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'

type ContextoTema = {
  tema: TemaDoSistema
  alternarTema: () => Promise<void>
  carregando: boolean
}

const ContextoTema = createContext<ContextoTema | null>(null)

export function ProvedorDeTema({ children }: { children: ReactNode }) {
  const { perfil, estaAutenticado } = useSessaoDoUsuario()
  const [tema, setTema] = useState<TemaDoSistema>(
    () => lerTemaDoCookie() ?? TEMA_PADRAO
  )
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!estaAutenticado || !perfil?.usuario) return
    const temaDoPerfil = temaDoUsuario(perfil.usuario.tema)
    setTema(temaDoPerfil)
    aplicarTemaNoDocumento(temaDoPerfil)
    salvarTemaNoCookie(temaDoPerfil)
  }, [estaAutenticado, perfil?.usuario?.tema, perfil?.usuario])

  const alternarTema = useCallback(async () => {
    const proximo: TemaDoSistema = tema === 'escuro' ? 'claro' : 'escuro'
    setTema(proximo)
    aplicarTemaNoDocumento(proximo)
    salvarTemaNoCookie(proximo)

    if (!estaAutenticado) return

    setCarregando(true)
    try {
      await clienteHttp.patch('/auth/me/tema', { tema: proximo })
    } catch {
      const anterior: TemaDoSistema = proximo === 'escuro' ? 'claro' : 'escuro'
      setTema(anterior)
      aplicarTemaNoDocumento(anterior)
      salvarTemaNoCookie(anterior)
    } finally {
      setCarregando(false)
    }
  }, [estaAutenticado, tema])

  const valor = useMemo(
    () => ({ tema, alternarTema, carregando }),
    [tema, alternarTema, carregando]
  )

  return <ContextoTema.Provider value={valor}>{children}</ContextoTema.Provider>
}

export function useTema() {
  const ctx = useContext(ContextoTema)
  if (!ctx) {
    throw new Error('useTema deve ser usado dentro de ProvedorDeTema')
  }
  return ctx
}
