/**
 * Acesso ao banco de dados para o portal do fornecedor.
 */
import { randomBytes } from 'node:crypto'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

const DIAS_EXPIRACAO_SESSAO = 7

function normalizarCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '')
}

async function buscarPedidoParaLiberar(pedidoCompraId: string, companyId: string) {
  return clientePrisma.pedidoCompra.findFirst({
    where: { id: pedidoCompraId, companyId },
    include: {
      company: { select: { name: true } },
      fornecedor: {
        select: {
          id: true,
          nome: true,
          cnpj: true,
          contatos: { where: { tipo: 'email' }, orderBy: { principal: 'desc' } },
        },
      },
    },
  })
}

async function buscarPedidoLiberadoPorCnpjENumero(cnpjBruto: string, numeroPedido: number) {
  const cnpjNormalizado = normalizarCnpj(cnpjBruto)

  const pedidos = await clientePrisma.pedidoCompra.findMany({
    where: {
      numero: numeroPedido,
      portalLiberadoEm: { not: null },
    },
    include: { fornecedor: { select: { id: true, nome: true, cnpj: true } } },
  })

  return pedidos.find((p) => normalizarCnpj(p.fornecedor.cnpj ?? '') === cnpjNormalizado) ?? null
}

async function criarSessao(pedidoCompraId: string) {
  const token = randomBytes(32).toString('hex')
  const expiraEm = new Date()
  expiraEm.setDate(expiraEm.getDate() + DIAS_EXPIRACAO_SESSAO)

  return clientePrisma.pedidoCompraAcessoPortal.create({
    data: { pedidoCompraId, token, expiraEm },
  })
}

async function buscarSessaoValidaPorToken(token: string) {
  const sessao = await clientePrisma.pedidoCompraAcessoPortal.findUnique({ where: { token } })
  if (!sessao) return null
  if (sessao.revogadoEm) return null
  if (sessao.expiraEm.getTime() < Date.now()) return null
  return sessao
}

async function revogarSessoesDoPedido(pedidoCompraId: string): Promise<void> {
  await clientePrisma.pedidoCompraAcessoPortal.updateMany({
    where: { pedidoCompraId, revogadoEm: null },
    data: { revogadoEm: new Date() },
  })
}

async function buscarPedidoCompletoPorId(pedidoCompraId: string) {
  return clientePrisma.pedidoCompra.findUnique({
    where: { id: pedidoCompraId },
    include: {
      company: { select: { name: true } },
      fornecedor: { select: { nome: true, cnpj: true } },
      transportadora: { select: { nome: true } },
      itens: {
        include: {
          produto: {
            select: {
              nomeVenda: true,
              sku: true,
              codigoBarras: true,
              fotos: { where: { tipo: 'miniatura' }, select: { arquivo: true }, take: 1 },
            },
          },
        },
        orderBy: { ordem: 'asc' },
      },
      anexosFornecedor: { orderBy: { enviadoEm: 'desc' } },
    },
  })
}

async function criarAnexo(dados: {
  pedidoCompraId: string
  nomeArquivo: string
  mimeType: string
  caminhoArquivo: string
  tamanhoBytes: number
}) {
  return clientePrisma.pedidoCompraAnexoFornecedor.create({ data: dados })
}

async function liberarPedidoParaPortal(pedidoCompraId: string) {
  return clientePrisma.pedidoCompra.update({
    where: { id: pedidoCompraId },
    data: { portalLiberadoEm: new Date(), portalBloqueadoEm: null },
  })
}

async function bloquearPortal(pedidoCompraId: string) {
  const pedido = await clientePrisma.pedidoCompra.update({
    where: { id: pedidoCompraId },
    data: { portalBloqueadoEm: new Date() },
  })
  await revogarSessoesDoPedido(pedidoCompraId)
  return pedido
}

async function buscarAnexoPorId(anexoId: string) {
  return clientePrisma.pedidoCompraAnexoFornecedor.findUnique({ where: { id: anexoId } })
}

async function aprovarAnexo(anexoId: string) {
  return clientePrisma.pedidoCompraAnexoFornecedor.update({
    where: { id: anexoId },
    data: { statusConferencia: 'aprovado', decididoEm: new Date(), motivoAjuste: null },
  })
}

async function excluirAnexo(anexoId: string) {
  return clientePrisma.pedidoCompraAnexoFornecedor.delete({ where: { id: anexoId } })
}

async function solicitarAjusteAnexo(anexoId: string, motivo: string, relatorioJson?: object) {
  return clientePrisma.pedidoCompraAnexoFornecedor.update({
    where: { id: anexoId },
    data: {
      statusConferencia: 'ajuste_solicitado',
      decididoEm: new Date(),
      motivoAjuste: motivo,
      relatorioConferenciaJson: relatorioJson ?? undefined,
    },
  })
}

export const repositorioDoPortalFornecedor = {
  buscarPedidoParaLiberar,
  buscarPedidoLiberadoPorCnpjENumero,
  criarSessao,
  buscarSessaoValidaPorToken,
  revogarSessoesDoPedido,
  buscarPedidoCompletoPorId,
  criarAnexo,
  liberarPedidoParaPortal,
  bloquearPortal,
  buscarAnexoPorId,
  aprovarAnexo,
  excluirAnexo,
  solicitarAjusteAnexo,
}
