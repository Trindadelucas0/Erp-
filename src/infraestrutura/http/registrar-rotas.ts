/**
 * Registra todas as rotas da API 
 */
import { FastifyInstance } from 'fastify'
import { rotasDeAutenticacao } from '../../modulos/autenticacao/rotas-autenticacao.js'
import { rotasDeUsuarios } from '../../modulos/usuarios/rotas-usuarios.js'
import { rotasDePapeis } from '../../modulos/papeis/rotas-papeis.js'
import { rotasDePermissoes } from '../../modulos/permissoes/rotas-permissoes.js'
import { rotasDeEmpresas } from '../../modulos/empresas/rotas-empresas.js'
import { rotasDePaginas } from '../../modulos/paginas/rotas-paginas.js'

/**
 * Conecta cada módulo às suas rotas HTTP.
 * @param aplicacao - Instância do servidor Fastify
 * @returns void
 */
export async function registrarRotas(aplicacao: FastifyInstance): Promise<void> {
  await aplicacao.register(rotasDeAutenticacao, { prefix: '/auth' })
  await aplicacao.register(rotasDeUsuarios, { prefix: '/users' })
  await aplicacao.register(rotasDePapeis, { prefix: '/roles' })
  await aplicacao.register(rotasDePermissoes, { prefix: '/permissions' })
  await aplicacao.register(rotasDeEmpresas, { prefix: '/companies' })
  await aplicacao.register(rotasDePaginas, { prefix: '/paginas' })
}
