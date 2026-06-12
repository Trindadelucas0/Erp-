/**
 * Controlador de páginas do sistema.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { servicoDePaginas } from './servico-paginas.js'

async function listarPaginasVinculaveis(
  _requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const paginas = servicoDePaginas.listarPaginasVinculaveisDoSistema()
  return resposta.send({ paginas })
}

export const controladorDePaginas = {
  listarPaginasVinculaveis,
}
