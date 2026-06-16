/**
 * Regras de negócio para permissões.
 */
import { repositorioDePermissoes } from './repositorio-permissoes.js'
import { MODULOS_DO_SISTEMA, ACOES_DO_SISTEMA } from '../../compartilhado/permissoes/registro-de-permissoes.js'

/**
 * Lista permissões para o formulário do admin.
 */
async function listarPermissoes() {
  return repositorioDePermissoes.listarTodas()
}

/**
 * Retorna os módulos e ações do sistema (fonte única de verdade para o frontend).
 */
function listarModulos() {
  return {
    modulos: MODULOS_DO_SISTEMA,
    acoes: ACOES_DO_SISTEMA,
  }
}

export const servicoDePermissoes = {
  listarPermissoes,
  listarModulos,
}
