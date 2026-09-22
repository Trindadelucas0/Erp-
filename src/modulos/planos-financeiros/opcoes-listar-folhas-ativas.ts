import type { TipoPlanoFinanceiro } from './codigo-plano-financeiro.js'
import { montarFiltroBuscaCamposEscalares } from '../../compartilhado/utilitarios/filtro-busca-textual.js'

const LIMITE_BUSCA_CATALOGO = 50

/**
 * Opções do findMany de folhas ativas do catálogo.
 * Sem `q`: todas as folhas (combo carrega e filtra no cliente).
 * Com `q`: no máximo 50 folhas que casam o termo (lookup com debounce).
 */
export function montarOpcoesListarFolhasAtivas(
  companyId: string,
  q?: string,
  tipo?: TipoPlanoFinanceiro,
  somenteSubgrupo?: boolean
) {
  const filtroBusca = montarFiltroBuscaCamposEscalares(q, ['codigo', 'nome'])
  const termo = q?.trim()

  return {
    where: {
      companyId,
      ativo: true,
      children: { none: {} },
      ...(tipo ? { tipo } : {}),
      ...(somenteSubgrupo ? { parentId: { not: null } } : {}),
      ...(filtroBusca ?? {}),
    },
    orderBy: { codigo: 'asc' as const },
    ...(termo ? { take: LIMITE_BUSCA_CATALOGO } : {}),
  }
}
