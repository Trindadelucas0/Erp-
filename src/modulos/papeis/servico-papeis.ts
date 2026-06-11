/**
 * Regras de negócio para papéis (roles).
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { repositorioDePapeis } from './repositorio-papeis.js'

/**
 * Lista papéis para popular formulários.
 * @returns Lista de papéis com permissões
 */
async function listarPapeis() {
  return repositorioDePapeis.listarTodos()
}

/**
 * Busca um papel pelo ID.
 * @param idDoPapel - UUID do papel
 * @returns Papel encontrado
 */
async function buscarPapelPorId(idDoPapel: string) {
  const papel = await repositorioDePapeis.buscarPorId(idDoPapel)

  if (!papel) {
    throw new ErroDaAplicacao('Papel não encontrado', 404)
  }

  return papel
}

/**
 * Salva permissões de um papel. Admin sempre mantém todas (não editável).
 * @param idDoPapel - UUID do papel
 * @param idsDasPermissoes - IDs selecionados
 * @returns Papel atualizado
 */
async function salvarPermissoesDoPapel(
  idDoPapel: string,
  idsDasPermissoes: string[]
) {
  const papel = await repositorioDePapeis.buscarPorId(idDoPapel)

  if (!papel) {
    throw new ErroDaAplicacao('Papel não encontrado', 404)
  }

  if (papel.name === 'admin') {
    throw new ErroDaAplicacao('O papel admin tem acesso total e não pode ser editado', 400)
  }

  return repositorioDePapeis.atualizarPermissoesDoPapel(
    idDoPapel,
    idsDasPermissoes
  )
}

export const servicoDePapeis = {
  listarPapeis,
  buscarPapelPorId,
  salvarPermissoesDoPapel,
}
