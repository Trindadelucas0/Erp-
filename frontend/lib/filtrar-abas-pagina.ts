import type { PerfilDoUsuario } from '@/types/sessao'

type AbaComId = { id: string }

/** Filtra abas visíveis conforme abasPorPagina da sessão (admin vê todas). */
export function filtrarAbasPagina<T extends AbaComId>(
  perfil: PerfilDoUsuario | null | undefined,
  pageKey: string,
  abas: T[]
): T[] {
  if (!perfil || perfil.ehAdmin) return abas
  const permitidas = perfil.abasPorPagina?.[pageKey]
  if (permitidas === undefined) return abas
  return abas.filter((aba) => permitidas.includes(aba.id))
}

export function usuarioTemAbaConfig(
  perfil: PerfilDoUsuario | null | undefined,
  tabKey: string
): boolean {
  if (!perfil || perfil.ehAdmin) return true
  const permitidas = perfil.abasPorPagina?.configuracoes
  if (permitidas === undefined) return true
  return permitidas.includes(tabKey)
}

export function primeiraAbaPermitida(
  perfil: PerfilDoUsuario | null | undefined,
  pageKey: string,
  abas: AbaComId[],
  padrao: string
): string {
  const visiveis = filtrarAbasPagina(perfil, pageKey, abas)
  return visiveis[0]?.id ?? padrao
}
