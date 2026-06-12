/**
 * Regras de negócio para páginas do sistema.
 */
import { listarPaginasVinculaveis } from '../../compartilhado/paginas/registro-de-paginas.js'

function listarPaginasVinculaveisDoSistema() {
  return listarPaginasVinculaveis()
}

export const servicoDePaginas = {
  listarPaginasVinculaveisDoSistema,
}
