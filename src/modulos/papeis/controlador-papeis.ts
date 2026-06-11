/**
 * Controlador de papéis — recebe requisições HTTP.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDePapeis } from './servico-papeis.js'
import { esquemaDeSalvarPermissoesDoPapel } from './esquema-papeis.js'

/**
 * Lista todos os papéis.
 */
async function listarPapeis(_requisicao: FastifyRequest, resposta: FastifyReply) {
  const papeis = await servicoDePapeis.listarPapeis()
  return resposta.send({ papeis })
}

/**
 * Busca um papel pelo ID.
 */
async function buscarPapelPorId(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { id } = requisicao.params as { id: string }
  const papel = await servicoDePapeis.buscarPapelPorId(id)
  return resposta.send({ papel })
}

/**
 * Salva permissões de um papel.
 */
async function salvarPermissoesDoPapel(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeSalvarPermissoesDoPapel.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const papel = await servicoDePapeis.salvarPermissoesDoPapel(
    id,
    resultado.data.idsDasPermissoes
  )

  return resposta.send({ papel })
}

export const controladorDePapeis = {
  listarPapeis,
  buscarPapelPorId,
  salvarPermissoesDoPapel,
}
