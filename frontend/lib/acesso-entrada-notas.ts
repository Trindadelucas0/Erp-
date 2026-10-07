import type { PerfilDoUsuario } from '@/types/sessao'

export const PAINEIS_ENTRADA_ADMINISTRATIVO = [
  'aguardando_chegada',
  'contagem',
  'problemas',
] as const

export type PainelEntradaAdministrativo =
  (typeof PAINEIS_ENTRADA_ADMINISTRATIVO)[number]

export const PAINEL_ENTRADA_PADRAO_ADMINISTRATIVO: PainelEntradaAdministrativo =
  'aguardando_chegada'

export function perfilRestritoEntradaAdministrativo(
  perfil: PerfilDoUsuario | null | undefined
): boolean {
  if (!perfil) return false
  if (perfil.ehAdmin) return false
  if (perfil.permissoesEfetivas.includes('compras:view')) return false
  const nomes = perfil.usuario.roles?.map((item) => item.role.name) ?? []
  return nomes.includes('administrativo')
}

export function painelEntradaAdministrativoPermitido(painel: string): boolean {
  return (PAINEIS_ENTRADA_ADMINISTRATIVO as readonly string[]).includes(painel)
}
