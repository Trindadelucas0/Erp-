/**
 * Controlador de papéis — recebe requisições HTTP.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDePapeis } from './servico-papeis.js'
import {
  esquemaDeSalvarPermissoesDoPapel,
  esquemaDeCriacaoDePapel,
} from './esquema-papeis.js'

async function listarPapeis(_requisicao: FastifyRequest, resposta: FastifyReply) {
  const papeis = await servicoDePapeis.listarPapeis()
  return resposta.send({ papeis })
}

async function buscarPapelPorId(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { id } = requisicao.params as { id: string }
  const papel = await servicoDePapeis.buscarPapelPorId(id)
  return resposta.send({ papel })
}

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

async function criarPapel(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaDeCriacaoDePapel.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const papel = await servicoDePapeis.criarPapel(
    resultado.data.nome,
    resultado.data.descricao
  )

  return resposta.status(201).send({ papel })
}

async function excluirPapel(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  await servicoDePapeis.excluirPapel(id)
  return resposta.send({ mensagem: 'Papel excluído com sucesso' })
}

export const controladorDePapeis = {
  listarPapeis,
  buscarPapelPorId,
  salvarPermissoesDoPapel,
  criarPapel,
  excluirPapel,
}
