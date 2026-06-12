'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { buscarPerfilDoUsuario } from '@/services/autenticacao'
import { limparSessaoLocal } from '@/lib/sessao-local'
import type { PerfilDoUsuario } from '@/types/sessao'

type ContextoDaSessao = {
  perfil: PerfilDoUsuario | null
  carregando: boolean
  estaAutenticado: boolean
  recarregarPerfil: () => Promise<PerfilDoUsuario | null>
  encerrarSessao: () => void
}

const SessaoDoUsuarioContext = createContext<ContextoDaSessao | null>(null)

export function ProvedorSessaoDoUsuario({
  children,
}: {
  children: React.ReactNode
}) {
  const roteador = useRouter()
  const caminho = usePathname()
  const [perfil, setPerfil] = useState<PerfilDoUsuario | null>(null)
  const [carregando, setCarregando] = useState(true)

  const recarregarPerfil = useCallback(async (): Promise<PerfilDoUsuario | null> => {
    const tokenNoInicio = localStorage.getItem('token')

    if (!tokenNoInicio) {
      setPerfil(null)
      setCarregando(false)
      return null
    }

    setCarregando(true)

    try {
      const perfilAtualizado = await buscarPerfilDoUsuario()
      setPerfil(perfilAtualizado)

      const empresaAtivaIdSalva = localStorage.getItem('empresaAtivaId')
      const empresas = perfilAtualizado.empresas ?? []
      const empresaValida = empresas.find((e) => e.company.id === empresaAtivaIdSalva)

      if (!empresaValida && empresas.length > 0) {
        localStorage.setItem('empresaAtivaId', empresas[0].company.id)
      }

      return perfilAtualizado
    } catch {
      if (localStorage.getItem('token') === tokenNoInicio) {
        limparSessaoLocal()
      }
      setPerfil(null)
      return null
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (caminho === '/login') {
      setCarregando(false)
      return
    }
    recarregarPerfil()
  }, [recarregarPerfil, caminho])

  const encerrarSessao = useCallback(() => {
    limparSessaoLocal()
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
