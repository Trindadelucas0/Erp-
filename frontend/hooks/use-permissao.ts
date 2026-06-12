'use client'

import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'

export function usePermissao(chaveDaPermissao: string): boolean {
  const { perfil } = useSessaoDoUsuario()

  if (!perfil) return false
  if (perfil.ehAdmin) return true

  return perfil.permissoesEfetivas.includes(chaveDaPermissao)
}
