'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { buscarPerfilDoUsuario } from '@/services/autenticacao'
import type { PerfilDoUsuario } from '@/types/sessao'

type ContextoDaSessao = {
  perfil: PerfilDoUsuario | null
  carregando: boolean
  estaAutenticado: boolean
  recarregarPerfil: () => Promise<void>
  encerrarSessao: () => void
}

const SessaoDoUsuarioContext = createContext<ContextoDaSessao | null>(null)

export function ProvedorSessaoDoUsuario({
  children,
}: {
  children: React.ReactNode
}) {
  const roteador = useRouter()
  const [perfil, setPerfil] = useState<PerfilDoUsuario | null>(null)
  const [carregando, setCarregando] = useState(true)

  const recarregarPerfil = useCallback(async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      setPerfil(null)
      setCarregando(false)
      return
    }

    setCarregando(true)

    try {
      const perfilAtualizado = await buscarPerfilDoUsuario()
      setPerfil(perfilAtualizado)
    } catch {
      localStorage.removeItem('token')
      setPerfil(null)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    recarregarPerfil()
  }, [recarregarPerfil])

  const encerrarSessao = useCallback(() => {
    localStorage.removeItem('token')
    setPerfil(null)
    roteador.push('/login')
  }, [roteador])

  const valor = useMemo(
    () => ({
      perfil,
      carregando,
      estaAutenticado: !!perfil,
      recarregarPerfil,
      encerrarSessao,
    }),
    [perfil, carregando, recarregarPerfil, encerrarSessao]
  )

  return (
    <SessaoDoUsuarioContext.Provider value={valor}>
      {children}
    </SessaoDoUsuarioContext.Provider>
  )
}

export function useSessaoDoUsuario() {
  const contexto = useContext(SessaoDoUsuarioContext)

  if (!contexto) {
    throw new Error(
      'useSessaoDoUsuario deve ser usado dentro de ProvedorSessaoDoUsuario'
    )
  }

  return contexto
}
