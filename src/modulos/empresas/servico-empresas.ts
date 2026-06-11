/**
 * Regras de negócio para empresas.
 */
import { repositorioDeEmpresas } from './repositorio-empresas.js'

/**
 * Lista empresas para popular o formulário do admin.
 * @returns Lista de empresas ativas
 */
async function listarEmpresas() {
  return repositorioDeEmpresas.listarTodasAtivas()
}

export const servicoDeEmpresas = {
  listarEmpresas,
}
