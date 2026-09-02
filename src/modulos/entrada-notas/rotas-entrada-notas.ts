/**
 * Rotas Entrada de Notas — pipeline frete → cadastro → fiscal → negociação → lançamento (NFe 55).
 * Prefixo: /entrada-notas
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorEntradaNotas } from './controlador-entrada-notas.js'

export async function rotasEntradaNotas(aplicacao: FastifyInstance): Promise<void> {
  const autenticado = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  // Rotas estáticas antes de /:id
  aplicacao.post(
    '/vincular-fornecedores-pendentes',
    { preHandler: autenticado },
    controladorEntradaNotas.vincularFornecedoresPendentes
  )
  aplicacao.post(
    '/vincular-ctes-pendentes',
    { preHandler: autenticado },
    controladorEntradaNotas.vincularCtesPendentes
  )
  aplicacao.get(
    '/ctes-aguardando-nf',
    { preHandler: autenticado },
    controladorEntradaNotas.ctesAguardandoNf
  )

  aplicacao.get('/:id', { preHandler: autenticado }, controladorEntradaNotas.detalhe)
  aplicacao.post('/:id/analisar', { preHandler: autenticado }, controladorEntradaNotas.analisar)
  aplicacao.post('/:id/vincular-item', { preHandler: autenticado }, controladorEntradaNotas.vincularItem)
  aplicacao.post(
    '/:id/desvincular-item',
    { preHandler: autenticado },
    controladorEntradaNotas.desvincularItem
  )
  aplicacao.post('/:id/voltar-etapa', { preHandler: autenticado }, controladorEntradaNotas.voltarEtapa)
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
    '/:id/definir-cfop-entrada',
    { preHandler: autenticado },
    controladorEntradaNotas.definirCfopEntrada
  )
  aplicacao.post(
    '/:id/definir-cfop-entrada-cte',
    { preHandler: autenticado },
    controladorEntradaNotas.definirCfopEntradaCte
  )
  aplicacao.post(
    '/:id/definir-cfop-entrada-nota',
    { preHandler: autenticado },
    controladorEntradaNotas.definirCfopEntradaNota
  )
  aplicacao.post(
    '/:id/finalidade-entrada',
    { preHandler: autenticado },
    controladorEntradaNotas.definirFinalidadeEntrada
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
  aplicacao.post(
    '/:id/marcar-problema',
    { preHandler: autenticado },
    controladorEntradaNotas.marcarProblema
  )
  aplicacao.get(
    '/:id/tratativas',
    { preHandler: autenticado },
    controladorEntradaNotas.listarTratativas
  )
  aplicacao.post(
    '/:id/tratativas',
    { preHandler: autenticado },
    controladorEntradaNotas.adicionarTratativa
  )
  aplicacao.post(
    '/:id/resolver-problema',
    { preHandler: autenticado },
    controladorEntradaNotas.resolverProblema
  )
  aplicacao.post('/:id/descancelar', { preHandler: autenticado }, controladorEntradaNotas.descancelar)
  aplicacao.post('/:id/lancar', { preHandler: autenticado }, controladorEntradaNotas.lancar)
  aplicacao.post(
    '/:id/aceitar-auditoria-chegada',
    { preHandler: autenticado },
    controladorEntradaNotas.aceitarAuditoriaChegada
  )
  aplicacao.post(
    '/:id/liberar-para-contagem',
    { preHandler: autenticado },
    controladorEntradaNotas.liberarParaContagem
  )
  aplicacao.post(
    '/:id/baixar-contagem',
    { preHandler: autenticado },
    controladorEntradaNotas.baixarContagem
  )
  aplicacao.post(
    '/:id/voltar-para-contagem',
    { preHandler: autenticado },
    controladorEntradaNotas.voltarParaContagem
  )
  aplicacao.post(
    '/:id/desbloquear-estoque',
    { preHandler: autenticado },
    controladorEntradaNotas.desbloquearEstoque
  )
  aplicacao.post(
    '/:id/resolver-divergencia',
    { preHandler: autenticado },
    controladorEntradaNotas.resolverDivergencia
  )
  aplicacao.get(
    '/:id/anexo-divergencia/:anexoId/download',
    { preHandler: autenticado },
    controladorEntradaNotas.baixarAnexoDivergencia
  )
  aplicacao.post('/:id/vincular-cte', { preHandler: autenticado }, controladorEntradaNotas.vincularCte)
  aplicacao.post(
    '/:id/financeiro-frete',
    { preHandler: autenticado },
    controladorEntradaNotas.salvarFinanceiroFrete
  )
  aplicacao.post(
    '/:id/financeiro-documental',
    { preHandler: autenticado },
    controladorEntradaNotas.salvarFinanceiroDocumental
  )
  aplicacao.delete(
    '/:id/vinculos-cte/:vinculoId',
    { preHandler: autenticado },
    controladorEntradaNotas.desvincularCte
  )
}
