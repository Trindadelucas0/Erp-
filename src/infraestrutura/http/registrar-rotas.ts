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
import { rotasDeAuditoria } from '../../modulos/auditoria/rotas-auditoria.js'
import { rotasDeClientes } from '../../modulos/clientes/rotas-clientes.js'
import { rotasDeFornecedores } from '../../modulos/fornecedores/rotas-fornecedores.js'
import { rotasDeTransportadoras } from '../../modulos/transportadoras/rotas-transportadoras.js'
import { rotasDeConfiguracoes } from '../../modulos/configuracoes/rotas-configuracoes.js'

/**
 * Conecta cada módulo às suas rotas HTTP.
 */
export async function registrarRotas(aplicacao: FastifyInstance): Promise<void> {
  await aplicacao.register(rotasDeAutenticacao, { prefix: '/auth' })
  await aplicacao.register(rotasDeUsuarios, { prefix: '/users' })
  await aplicacao.register(rotasDePapeis, { prefix: '/roles' })
  await aplicacao.register(rotasDePermissoes, { prefix: '/permissions' })
  await aplicacao.register(rotasDeEmpresas, { prefix: '/companies' })
  await aplicacao.register(rotasDeClientes, { prefix: '/clientes' })
  await aplicacao.register(rotasDeFornecedores, { prefix: '/fornecedores' })
  await aplicacao.register(rotasDeTransportadoras, { prefix: '/transportadoras' })
  await aplicacao.register(rotasDePaginas, { prefix: '/paginas' })
  await aplicacao.register(rotasDeAuditoria, { prefix: '/auditoria' })
  await aplicacao.register(rotasDeConfiguracoes, { prefix: '/configuracoes' })
}
