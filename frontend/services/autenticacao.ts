import { clienteHttp } from '@/services/api'
import type { PerfilDoUsuario } from '@/types/sessao'

export const CAMINHO_INICIO = '/inicio'

export async function buscarPerfilDoUsuario(): Promise<PerfilDoUsuario> {
  const { data } = await clienteHttp.get<PerfilDoUsuario>('/auth/me')
  return data
}

export function resolverRotaAposLogin(perfil: PerfilDoUsuario): string {
  if (perfil.ehAdmin) {
    return '/users'
  }

  if (perfil.paginasPermitidas.length > 0) {
    return perfil.paginasPermitidas[0].caminho
  }

  return CAMINHO_INICIO
}

export function usuarioPossuiAcessoAPagina(
  perfil: PerfilDoUsuario | null,
  chaveDaPagina: string
): boolean {
  if (!perfil) return false
  return perfil.paginasPermitidas.some((pagina) => pagina.chave === chaveDaPagina)
}
