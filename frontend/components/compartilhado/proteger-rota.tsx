'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CAMINHO_INICIO, usuarioPossuiAcessoAPagina } from '@/services/autenticacao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'

type Props = {
  children: React.ReactNode
  somenteAdmin?: boolean
  chaveDaPagina?: string
}

export function ProtegerRota({
  children,
  somenteAdmin = false,
  chaveDaPagina,
}: Props) {
  const roteador = useRouter()
  const { perfil, carregando, estaAutenticado } = useSessaoDoUsuario()

  useEffect(() => {
    if (carregando) return

    if (!estaAutenticado) {
      roteador.replace('/login')
      return
    }

    if (somenteAdmin && !perfil?.ehAdmin) {
      roteador.replace(CAMINHO_INICIO)
      return
    }

    if (
      chaveDaPagina &&
      !usuarioPossuiAcessoAPagina(perfil, chaveDaPagina)
    ) {
      roteador.replace(CAMINHO_INICIO)
    }
  }, [
    carregando,
    estaAutenticado,
    perfil,
    somenteAdmin,
    chaveDaPagina,
    roteador,
  ])

  if (carregando) {
    return (
      <p className="text-sm text-muted-foreground">Carregando sessão...</p>
    )
  }

  if (!estaAutenticado) return null

  if (somenteAdmin && !perfil?.ehAdmin) return null

  if (chaveDaPagina && !usuarioPossuiAcessoAPagina(perfil, chaveDaPagina)) {
    return null
  }

  return <>{children}</>
}
