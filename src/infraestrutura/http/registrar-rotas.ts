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
import { rotasDeCatalogos } from '../../modulos/catalogos/rotas-catalogos.js'
import { rotasDePlanosFinanceiros } from '../../modulos/planos-financeiros/rotas-planos-financeiros.js'
import { rotasDeCfops } from '../../modulos/cfops/rotas-cfops.js'
import { rotasDeAssinaturaZapsign } from '../../modulos/assinatura-zapsign/rotas-assinatura-zapsign.js'
import { rotasFocusNfe } from '../../modulos/focus-nfe/rotas-focus-nfe.js'
import { rotasEntradaNotas } from '../../modulos/entrada-notas/rotas-entrada-notas.js'
import { rotasDeIntegracoes } from '../../modulos/integracoes/rotas-integracoes.js'
import { rotasDeProdutos } from '../../modulos/produtos/rotas-produtos.js'
import { rotasDePedidosCompra } from '../../modulos/pedidos-compra/rotas-pedidos-compra.js'
import { rotasDeEstoque } from '../../modulos/estoque/rotas-estoque.js'
import { rotasDeUploads } from './rotas-uploads.js'
import { rotasDoPortalFornecedor } from '../../modulos/portal-fornecedor/rotas-portal-fornecedor.js'

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
  await aplicacao.register(rotasDeProdutos, { prefix: '/produtos' })
  await aplicacao.register(rotasDePedidosCompra, { prefix: '/pedidos-compra' })
  await aplicacao.register(rotasDeEstoque, { prefix: '/estoque' })
  await aplicacao.register(rotasDePaginas, { prefix: '/paginas' })
  await aplicacao.register(rotasDeAuditoria, { prefix: '/auditoria' })
  await aplicacao.register(rotasDeConfiguracoes, { prefix: '/configuracoes' })
  await aplicacao.register(rotasDePlanosFinanceiros, { prefix: '/planos-financeiros' })
  await aplicacao.register(rotasDeCfops, { prefix: '/cfops' })
  await aplicacao.register(rotasDeCatalogos, { prefix: '' })
  await aplicacao.register(rotasDeAssinaturaZapsign, { prefix: '/zapsign' })
  await aplicacao.register(rotasFocusNfe, { prefix: '/focus-nfe' })
  await aplicacao.register(rotasEntradaNotas, { prefix: '/entrada-notas' })
  await aplicacao.register(rotasDeIntegracoes, { prefix: '/integracoes' })
  await aplicacao.register(rotasDeUploads, { prefix: '/uploads' })
  await aplicacao.register(rotasDoPortalFornecedor, { prefix: '/portal-fornecedor' })
}
