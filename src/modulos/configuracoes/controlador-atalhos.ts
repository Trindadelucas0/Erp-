import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeAtalhos } from './servico-atalhos.js'
import type { AtalhoPersistido } from './repositorio-atalhos.js'

export const controladorDeAtalhos = {
  async listar(_requisicao: FastifyRequest, resposta: FastifyReply) {
    const atalhos = await servicoDeAtalhos.listar()
    return resposta.send({ atalhos })
  },

  async salvar(requisicao: FastifyRequest, resposta: FastifyReply) {
    const usuarioId = requisicao.idDoUsuario
    if (!usuarioId) {
      throw new ErroDaAplicacao('Usuário não autenticado', 401)
    }

    const { atalhos } = requisicao.body as { atalhos: AtalhoPersistido[] }
    const salvos = await servicoDeAtalhos.salvar(atalhos, usuarioId)
    return resposta.send({ atalhos: salvos })
  },

  async restaurarPadroes(requisicao: FastifyRequest, resposta: FastifyReply) {
    const usuarioId = requisicao.idDoUsuario
    if (!usuarioId) {
      throw new ErroDaAplicacao('Usuário não autenticado', 401)
    }

    const atalhos = await servicoDeAtalhos.restaurarPadroes(usuarioId)
    return resposta.send({ atalhos })
  },
}
