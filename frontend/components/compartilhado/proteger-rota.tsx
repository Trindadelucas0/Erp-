'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CAMINHO_INICIO, usuarioPossuiAcessoAPagina } from '@/services/autenticacao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'

type Props = {
  children: React.ReactNode
  somenteAdmin?: boolean
  chaveDaPagina?: string
  /** Qualquer chave basta (ex.: Executar reutilizado por Guardar mercadorias). */
  chavesDaPagina?: string[]
}

export function ProtegerRota({
  children,
  somenteAdmin = false,
  chaveDaPagina,
  chavesDaPagina,
}: Props) {
  const roteador = useRouter()
  const { perfil, carregando, estaAutenticado } = useSessaoDoUsuario()
  const chaves = [
    ...(chaveDaPagina ? [chaveDaPagina] : []),
    ...(chavesDaPagina ?? []),
  ]
  const temAcessoPagina =
    chaves.length === 0 || chaves.some((chave) => usuarioPossuiAcessoAPagina(perfil, chave))

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

    if (!temAcessoPagina) {
      roteador.replace(CAMINHO_INICIO)
    }
  }, [
    carregando,
    estaAutenticado,
    perfil,
    somenteAdmin,
    temAcessoPagina,
    roteador,
  ])

  if (carregando) {
    return (
      <p className="text-sm text-muted-foreground">Carregando sessão...</p>
    )
  }

  if (!estaAutenticado) return null

  if (somenteAdmin && !perfil?.ehAdmin) return null

  if (!temAcessoPagina) return null

  return <>{children}</>
}
