/**
 * Rotas Entrada de Notas — pipeline cadastro → fiscal → negociação → lançamento.
 * Prefixo: /entrada-notas
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorEntradaNotas } from './controlador-entrada-notas.js'

export async function rotasEntradaNotas(aplicacao: FastifyInstance): Promise<void> {
  const autenticado = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get('/:id', { preHandler: autenticado }, controladorEntradaNotas.detalhe)
  aplicacao.post('/:id/analisar', { preHandler: autenticado }, controladorEntradaNotas.analisar)
  aplicacao.post('/:id/vincular-item', { preHandler: autenticado }, controladorEntradaNotas.vincularItem)
  aplicacao.post(
    '/:id/gravar-codigo-original',
    { preHandler: autenticado },
    controladorEntradaNotas.gravarCodigoOriginal
  )
  aplicacao.post(
    '/:id/importar-fiscal-produto',
    { preHandler: autenticado },
    controladorEntradaNotas.importarFiscal
  )
  aplicacao.post(
    '/:id/liberar-criticas',
    { preHandler: autenticado },
    controladorEntradaNotas.liberarCriticas
  )
  aplicacao.post(
    '/:id/cancelar-liberacao',
    { preHandler: autenticado },
    controladorEntradaNotas.cancelarLiberacao
  )
  aplicacao.post('/:id/contato-fornecedor', { preHandler: autenticado }, controladorEntradaNotas.contato)
  aplicacao.post('/:id/definir-pedido', { preHandler: autenticado }, controladorEntradaNotas.definirPedido)
  aplicacao.post('/:id/definir-prazo', { preHandler: autenticado }, controladorEntradaNotas.definirPrazo)
  aplicacao.post('/:id/manifestar', { preHandler: autenticado }, controladorEntradaNotas.manifestar)
  aplicacao.post('/:id/lancar', { preHandler: autenticado }, controladorEntradaNotas.lancar)
}
