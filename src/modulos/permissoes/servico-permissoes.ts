/**
 * Regras de negócio para permissões.
 */
import { repositorioDePermissoes } from './repositorio-permissoes.js'

/**
 * Lista permissões para o formulário do admin.
 * @returns Lista completa de permissões
 */
async function listarPermissoes() {
  return repositorioDePermissoes.listarTodas()
}

export const servicoDePermissoes = {
  listarPermissoes,
}
