import type { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import {
  middlewareDeAutorizacao,
  middlewareDeAutorizacaoQualquer,
} from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDeTiposVeiculo } from './controlador-tipos-veiculo.js'

export async function rotasDeTiposVeiculo(aplicacao: FastifyInstance) {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]
  const leitura = middlewareDeAutorizacaoQualquer('configuracoes:view', 'transportadoras:view')
  const escrita = middlewareDeAutorizacao('configuracoes:view')

  aplicacao.get('/', { preHandler: [...auth, leitura] }, controladorDeTiposVeiculo.listar)
  aplicacao.get('/:id', { preHandler: [...auth, leitura] }, controladorDeTiposVeiculo.obter)
  aplicacao.post('/', { preHandler: [...auth, escrita] }, controladorDeTiposVeiculo.criar)
  aplicacao.put('/:id', { preHandler: [...auth, escrita] }, controladorDeTiposVeiculo.editar)
  aplicacao.patch(
    '/:id/ativo',
    { preHandler: [...auth, escrita] },
    controladorDeTiposVeiculo.alterarStatus
  )
}
