/**
 * Menu efetivo antes de RolePageAccess — usado só no backfill de migração.
 */
import {
  PAPEIS_MENU_EXPLICITO,
  papelUsaMenuExplicito,
} from '../permissoes/registro-de-permissoes.js'
import {
  PAGINAS_PADRAO_POR_PAPEL_MENU,
  PAGINAS_VINCULAVEIS,
  resolverPaginaPorChave,
  type PaginaDoSistema,
  type PapelDoUsuarioParaMenu,
} from './registro-de-paginas.js'

function paginaLiberadaPorPermissaoView(
  pagina: PaginaDoSistema,
  permissoesEfetivas: string[]
): boolean {
  if (!pagina.modulo) return false
  return permissoesEfetivas.includes(`${pagina.modulo}:view`)
}

export function montarPaginasPermitidasLegado(
  chavesDoUsuario: string[],
  permissoesEfetivas: string[],
  papeisDoUsuario: PapelDoUsuarioParaMenu[]
): PaginaDoSistema[] {
  const paginasPorChave = new Map<string, PaginaDoSistema>()
  const temPapelMenuExplicito = papeisDoUsuario.some((p) =>
    papelUsaMenuExplicito(p.nome)
  )
  const temPapelComExpansaoModulo = papeisDoUsuario.some(
    (p) => !papelUsaMenuExplicito(p.nome)
  )

  for (const chave of chavesDoUsuario) {
    const pagina = resolverPaginaPorChave(chave)
    if (pagina) paginasPorChave.set(pagina.chave, pagina)
  }

  for (const papel of papeisDoUsuario) {
    if (!papelUsaMenuExplicito(papel.nome)) continue
    const chaves =
      PAGINAS_PADRAO_POR_PAPEL_MENU[
        papel.nome as (typeof PAPEIS_MENU_EXPLICITO)[number]
      ] ?? []
    for (const chave of chaves) {
      const pagina = resolverPaginaPorChave(chave)
      if (pagina) paginasPorChave.set(pagina.chave, pagina)
    }
  }

  if (temPapelComExpansaoModulo || !temPapelMenuExplicito) {
    for (const pagina of PAGINAS_VINCULAVEIS) {
      if (paginaLiberadaPorPermissaoView(pagina, permissoesEfetivas)) {
        paginasPorChave.set(pagina.chave, pagina)
      }
    }
  }

  const injetaConfiguracoes =
    temPapelComExpansaoModulo ||
    (!temPapelMenuExplicito &&
      (permissoesEfetivas.includes('financeiro:view') ||
        permissoesEfetivas.includes('produtos:view') ||
        permissoesEfetivas.includes('estoque:view')))

  const temParametroFinanceiro =
    paginasPorChave.has('cfops') ||
    paginasPorChave.has('planos-financeiros') ||
    (temPapelComExpansaoModulo && permissoesEfetivas.includes('financeiro:view'))
  const temParametroLogistica =
    paginasPorChave.has('estrutura-wms') ||
    (temPapelComExpansaoModulo &&
      (permissoesEfetivas.includes('produtos:view') ||
        permissoesEfetivas.includes('estoque:view')))
  if (
    injetaConfiguracoes &&
    (temParametroFinanceiro || temParametroLogistica) &&
    !paginasPorChave.has('configuracoes')
  ) {
    const config = resolverPaginaPorChave('configuracoes')
    if (config) paginasPorChave.set('configuracoes', config)
  }

  if (paginasPorChave.has('requisicoes') && !paginasPorChave.has('separacao')) {
    const separacao = resolverPaginaPorChave('separacao')
    if (separacao) paginasPorChave.set('separacao', separacao)
  }

  const temPendencias =
    temPapelComExpansaoModulo &&
    (permissoesEfetivas.includes('financeiro:view') ||
      permissoesEfetivas.includes('compras:view') ||
      permissoesEfetivas.includes('estoque:view') ||
      permissoesEfetivas.includes('clientes:view'))
  if (temPendencias && !paginasPorChave.has('pendencias')) {
    const pendencias = resolverPaginaPorChave('pendencias')
    if (pendencias) paginasPorChave.set('pendencias', pendencias)
  }

  return [...paginasPorChave.values()]
}
