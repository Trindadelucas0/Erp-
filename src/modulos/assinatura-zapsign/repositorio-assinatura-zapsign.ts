/**
 * Acesso ao banco de dados para o módulo ZapSign.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

// ─── Configuração ─────────────────────────────────────────────────────────────

async function buscarConfigPorEmpresa(companyId: string) {
  return clientePrisma.configuracaoZapsign.findUnique({
    where: { companyId },
  })
}

async function salvarConfig(
  companyId: string,
  apiToken: string,
  sandbox: boolean,
  webhookSecret?: string
) {
  return clientePrisma.configuracaoZapsign.upsert({
    where: { companyId },
    create: { companyId, apiToken, sandbox, webhookSecret },
    update: { apiToken, sandbox, webhookSecret, updatedAt: new Date() },
  })
}

// ─── Documentos ───────────────────────────────────────────────────────────────

async function listarDocumentos(companyId: string) {
  return clientePrisma.zapsignDocumento.findMany({
    where: { companyId },
    orderBy: { criadoEm: 'desc' },
  })
}

async function listarPendentes(companyId: string) {
  return clientePrisma.zapsignDocumento.findMany({
    where: { companyId, status: { in: ['pendente', 'pending'] } },
    select: { tokenZapsign: true },
  })
}

async function buscarDocumentoPorToken(tokenZapsign: string) {
  return clientePrisma.zapsignDocumento.findUnique({
    where: { tokenZapsign },
  })
}

async function criarDocumento(dados: {
  companyId: string
  tokenZapsign: string
  nomeDocumento: string
  signatarioNome?: string
  signatarioEmail?: string
  linkAssinatura?: string
  clientePessoaId?: string
}) {
  return clientePrisma.zapsignDocumento.create({ data: dados })
}

async function atualizarStatusDocumento(
  tokenZapsign: string,
  status: string,
  extras: {
    assinadoEm?: Date | null
    recusadoEm?: Date | null
    motivoRecusa?: string | null
    linkAssinatura?: string | null
  } = {}
) {
  return clientePrisma.zapsignDocumento.update({
    where: { tokenZapsign },
    data: { status, ...extras },
  })
}

export const repositorioDeAssinaturaZapsign = {
  buscarConfigPorEmpresa,
  salvarConfig,
  listarDocumentos,
  listarPendentes,
  buscarDocumentoPorToken,
  criarDocumento,
  atualizarStatusDocumento,
}
