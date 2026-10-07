/**
 * Rotas Entrada de Notas — pipeline frete → cadastro → fiscal → negociação → lançamento (NFe 55).
 * Prefixo: /entrada-notas
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorEntradaNotas } from './controlador-entrada-notas.js'
import { middlewareAcessoNotaEntradaPorId } from './middleware-acesso-nota-entrada.js'

export async function rotasEntradaNotas(aplicacao: FastifyInstance): Promise<void> {
  const autenticado = [middlewareDeAutenticacao, middlewareEmpresaAtiva]
  const autenticadoNota = [...autenticado, middlewareAcessoNotaEntradaPorId]

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

  aplicacao.get('/:id', { preHandler: autenticadoNota }, controladorEntradaNotas.detalhe)
  aplicacao.get(
    '/:id/precificacao',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.obterPrecificacao
  )
  aplicacao.put(
    '/:id/precificacao',
    {
      preHandler: [
        ...autenticado,
        middlewareAcessoNotaEntradaPorId,
        middlewareDeAutorizacao('produtos:edit'),
      ],
    },
    controladorEntradaNotas.gravarPrecificacao
  )
  aplicacao.post('/:id/analisar', { preHandler: autenticadoNota }, controladorEntradaNotas.analisar)
  aplicacao.post('/:id/vincular-item', { preHandler: autenticadoNota }, controladorEntradaNotas.vincularItem)
  aplicacao.post(
    '/:id/desvincular-item',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.desvincularItem
  )
  aplicacao.post('/:id/voltar-etapa', { preHandler: autenticadoNota }, controladorEntradaNotas.voltarEtapa)
  aplicacao.post(
    '/:id/gravar-codigo-original',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.gravarCodigoOriginal
  )
  aplicacao.post(
    '/:id/importar-fiscal-produto',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.importarFiscal
  )
  aplicacao.post(
    '/:id/definir-cfop-entrada',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.definirCfopEntrada
  )
  aplicacao.post(
    '/:id/definir-cfop-entrada-cte',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.definirCfopEntradaCte
  )
  aplicacao.post(
    '/:id/definir-cfop-entrada-nota',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.definirCfopEntradaNota
  )
  aplicacao.post(
    '/:id/finalidade-entrada',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.definirFinalidadeEntrada
  )
  aplicacao.post(
    '/:id/liberar-criticas',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.liberarCriticas
  )
  aplicacao.post(
    '/:id/cancelar-liberacao',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.cancelarLiberacao
  )
  aplicacao.post('/:id/contato-fornecedor', { preHandler: autenticadoNota }, controladorEntradaNotas.contato)
  aplicacao.post('/:id/definir-pedido', { preHandler: autenticadoNota }, controladorEntradaNotas.definirPedido)
  aplicacao.post('/:id/definir-prazo', { preHandler: autenticadoNota }, controladorEntradaNotas.definirPrazo)
  aplicacao.post('/:id/manifestar', { preHandler: autenticadoNota }, controladorEntradaNotas.manifestar)
  aplicacao.post(
    '/:id/marcar-problema',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.marcarProblema
  )
  aplicacao.get(
    '/:id/tratativas',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.listarTratativas
  )
  aplicacao.post(
    '/:id/tratativas',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.adicionarTratativa
  )
  aplicacao.post(
    '/:id/resolver-problema',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.resolverProblema
  )
  aplicacao.post('/:id/descancelar', { preHandler: autenticadoNota }, controladorEntradaNotas.descancelar)
  aplicacao.post('/:id/lancar', { preHandler: autenticadoNota }, controladorEntradaNotas.lancar)
  aplicacao.post(
    '/:id/aceitar-auditoria-chegada',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.aceitarAuditoriaChegada
  )
  aplicacao.post(
    '/:id/liberar-para-contagem',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.liberarParaContagem
  )
  aplicacao.post(
    '/:id/baixar-contagem',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.baixarContagem
  )
  aplicacao.post(
    '/:id/voltar-para-contagem',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.voltarParaContagem
  )
  aplicacao.post(
    '/:id/desbloquear-estoque',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.desbloquearEstoque
  )
  aplicacao.post(
    '/:id/resolver-divergencia',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.resolverDivergencia
  )
  aplicacao.get(
    '/:id/anexo-divergencia/:anexoId/download',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.baixarAnexoDivergencia
  )
  aplicacao.post('/:id/vincular-cte', { preHandler: autenticadoNota }, controladorEntradaNotas.vincularCte)
  aplicacao.post(
    '/:id/financeiro-frete',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.salvarFinanceiroFrete
  )
  aplicacao.post(
    '/:id/financeiro-documental',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.salvarFinanceiroDocumental
  )
  aplicacao.delete(
    '/:id/vinculos-cte/:vinculoId',
    { preHandler: autenticadoNota },
    controladorEntradaNotas.desvincularCte
  )
}
