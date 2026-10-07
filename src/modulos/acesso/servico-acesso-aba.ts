/**
 * Checagem de acesso a abas de tela por papel (RoleTabAccess).
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  abaValidaParaPagina,
  paginaPossuiAbasNoCatalogo,
} from '../../compartilhado/paginas/registro-de-abas.js'
import { repositorioDeAcessoTelas } from './repositorio-acesso-telas.js'

export async function usuarioEhAdminPorId(idDoUsuario: string): Promise<boolean> {
  return repositorioDeAcessoTelas.usuarioEhAdmin(idDoUsuario)
}

export async function exigirAcessoAba(
  idDoUsuario: string,
  pageKey: string,
  tabKey: string
): Promise<void> {
  if (await usuarioEhAdminPorId(idDoUsuario)) return

  if (!abaValidaParaPagina(pageKey, tabKey)) {
    throw new ErroDaAplicacao('Aba inválida', 400)
  }

  const temPagina = await repositorioDeAcessoTelas.usuarioPossuiPagina(
    idDoUsuario,
    pageKey
  )
  if (!temPagina) {
    throw new ErroDaAplicacao('Sem permissão para esta área', 403)
  }

  if (!paginaPossuiAbasNoCatalogo(pageKey)) return

  const temAba = await repositorioDeAcessoTelas.usuarioPossuiAba(
    idDoUsuario,
    pageKey,
    tabKey
  )
  if (!temAba) {
    throw new ErroDaAplicacao('Sem permissão para esta área', 403)
  }
}

export async function exigirAcessoPagina(
  idDoUsuario: string,
  pageKey: string
): Promise<void> {
  if (await usuarioEhAdminPorId(idDoUsuario)) return

  const temPagina = await repositorioDeAcessoTelas.usuarioPossuiPagina(
    idDoUsuario,
    pageKey
  )
  if (!temPagina) {
    throw new ErroDaAplicacao('Sem permissão para esta área', 403)
  }
}
