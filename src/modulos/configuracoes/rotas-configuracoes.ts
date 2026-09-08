import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { middlewareSomenteAdmin } from '../../infraestrutura/autenticacao/middleware-somente-admin.js'
import { controladorDeAtalhos } from './controlador-atalhos.js'
import { controladorParametrizacaoCustos } from './controlador-parametrizacao-custos.js'

export async function rotasDeConfiguracoes(
  aplicacao: FastifyInstance
): Promise<void> {
  aplicacao.get(
    '/atalhos',
    { preHandler: [middlewareDeAutenticacao] },
    controladorDeAtalhos.listar
  )

  aplicacao.put(
    '/atalhos',
    {
      preHandler: [
        middlewareDeAutenticacao,
        middlewareDeAutorizacao('configuracoes:edit'),
      ],
    },
    controladorDeAtalhos.salvar
  )

  aplicacao.post(
    '/atalhos/restaurar-padroes',
    {
      preHandler: [
        middlewareDeAutenticacao,
        middlewareDeAutorizacao('configuracoes:edit'),
      ],
    },
    controladorDeAtalhos.restaurarPadroes
  )

  const adminEmpresa = [
    middlewareDeAutenticacao,
    middlewareEmpresaAtiva,
    middlewareSomenteAdmin,
  ]

  aplicacao.get(
    '/parametrizacao-custos',
    { preHandler: adminEmpresa },
    controladorParametrizacaoCustos.obter
  )

  aplicacao.put(
    '/parametrizacao-custos',
    { preHandler: adminEmpresa },
    controladorParametrizacaoCustos.gravar
  )
}
