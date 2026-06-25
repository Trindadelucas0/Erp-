/**
 * Regras de negócio para integração ZapSign.
 * Toda comunicação com a API ZapSign passa por aqui.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { clienteZapsign } from './cliente-zapsign.js'
import { repositorioDeAssinaturaZapsign } from './repositorio-assinatura-zapsign.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type {
  DadosParaSalvarConfig,
  DadosParaEnviarDocumento,
  PayloadWebhookZapsign,
} from './esquema-assinatura-zapsign.js'

// ─── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Mapeia os status vindos da API ZapSign para os valores canônicos do banco.
 * A API retorna "pending" (inglês); o banco usa "pendente" (português).
 */
function normalizarStatusZapsign(status: string): string {
  if (status === 'pending') return 'pendente'
  return status
}

async function obterCredenciais(companyId: string) {
  const config = await repositorioDeAssinaturaZapsign.buscarConfigPorEmpresa(companyId)

  if (config?.ativo && config.apiToken) {
    return { apiToken: config.apiToken, sandbox: config.sandbox }
  }

  const apiTokenEnv = process.env.ZAPSIGN_API_TOKEN
  if (apiTokenEnv) {
    return {
      apiToken: apiTokenEnv,
      sandbox: process.env.ZAPSIGN_SANDBOX !== 'false',
    }
  }

  throw new ErroDaAplicacao(
    'ZapSign não configurado. Acesse Configurações → Assinatura Digital para configurar a API key.',
    400
  )
}

// ─── Serviços ─────────────────────────────────────────────────────────────────

async function buscarConfig(companyId: string) {
  const config = await repositorioDeAssinaturaZapsign.buscarConfigPorEmpresa(companyId)
  if (!config) {
    const temEnv = !!process.env.ZAPSIGN_API_TOKEN
    return {
      configurado: temEnv,
      sandbox: process.env.ZAPSIGN_SANDBOX !== 'false',
      apiTokenMascarado: temEnv ? '*** via variável de ambiente ***' : null,
      webhookSecret: null,
      fonte: temEnv ? 'env' : 'nenhuma',
    }
  }

  const token = config.apiToken
  const mascarado = token.length > 8
    ? `${token.slice(0, 4)}${'*'.repeat(token.length - 8)}${token.slice(-4)}`
    : '****'

  return {
    configurado: config.ativo,
    sandbox: config.sandbox,
    apiTokenMascarado: mascarado,
    webhookSecret: config.webhookSecret ?? null,
    fonte: 'banco',
  }
}

async function salvarConfig(companyId: string, dados: DadosParaSalvarConfig) {
  if (!dados.apiToken || dados.apiToken.trim().length < 10) {
    throw new ErroDaAplicacao('API token inválido. Deve ter pelo menos 10 caracteres.', 400)
  }
  await repositorioDeAssinaturaZapsign.salvarConfig(
    companyId,
    dados.apiToken.trim(),
    dados.sandbox,
    dados.webhookSecret?.trim() || undefined
  )
  return { sucesso: true }
}

async function testarConexao(companyId: string) {
  const { apiToken, sandbox } = await obterCredenciais(companyId)
  const resultado = await clienteZapsign.testarConexao(apiToken, sandbox)

  if (!resultado.sucesso) {
    return {
      sucesso: false,
      mensagem: resultado.mensagem,
      ambiente: sandbox ? 'sandbox' : 'produção',
    }
  }

  return {
    sucesso: true,
    mensagem: `Conexão com ZapSign (${sandbox ? 'sandbox' : 'produção'}) estabelecida com sucesso.`,
    ambiente: sandbox ? 'sandbox' : 'produção',
    totalDocumentos: resultado.dados.count,
  }
}

async function resolverDadosSignatario(
  companyId: string,
  dados: DadosParaEnviarDocumento
): Promise<{ nome: string; email: string | undefined; clientePessoaId: string | undefined }> {
  if (!dados.clienteId) {
    return {
      nome: dados.signatarioNome!,
      email: dados.signatarioEmail || undefined,
      clientePessoaId: undefined,
    }
  }

  const pessoa = await clientePrisma.pessoa.findUnique({
    where: { id: dados.clienteId },
    include: {
      papeis: {
        where: { papel: 'cliente' },
        include: { dadosCliente: true },
      },
      contatos: true,
    },
  })

  if (!pessoa || pessoa.companyId !== companyId) {
    throw new ErroDaAplicacao('Cliente não encontrado', 404)
  }

  const dadosCliente = pessoa.papeis[0]?.dadosCliente
  if (!dadosCliente || dadosCliente.statusAprovacao !== 'aguardando_assinatura') {
    throw new ErroDaAplicacao(
      'Cliente não está em status "Aguardando assinatura". Verifique o cadastro.',
      400
    )
  }

  const emailContato =
    pessoa.contatos.find((c) => c.tipo === 'email' && c.principal)?.valor ??
    pessoa.contatos.find((c) => c.tipo === 'email')?.valor ??
    null

  if (!emailContato) {
    throw new ErroDaAplicacao(
      `Cliente "${pessoa.nome}" não possui e-mail cadastrado. Atualize o cadastro antes de enviar.`,
      400
    )
  }

  return {
    nome: pessoa.nome,
    email: emailContato,
    clientePessoaId: pessoa.id,
  }
}

async function enviarDocumento(companyId: string, dados: DadosParaEnviarDocumento) {
  const { apiToken, sandbox } = await obterCredenciais(companyId)

  const { nome, email, clientePessoaId } = await resolverDadosSignatario(companyId, dados)

  const resultado = await clienteZapsign.criarDocumento(apiToken, sandbox, {
    name: dados.nomeDocumento,
    base64_pdf: dados.base64Pdf,
    url_pdf: dados.urlPdf,
    lang: 'pt-br',
    signers: [
      {
        name: nome,
        email: email || undefined,
        send_automatic_email: !!email,
      },
    ],
  })

  if (!resultado.sucesso) {
    throw new ErroDaAplicacao(
      `Erro ao criar documento na ZapSign: ${resultado.mensagem}`,
      502
    )
  }

  const doc = resultado.dados
  const primeiroSignatario = doc.signers?.[0]

  const documento = await repositorioDeAssinaturaZapsign.criarDocumento({
    companyId,
    tokenZapsign: doc.token,
    nomeDocumento: doc.name,
    signatarioNome: nome,
    signatarioEmail: email || undefined,
    linkAssinatura: primeiroSignatario?.sign_url || undefined,
    clientePessoaId: clientePessoaId || undefined,
  })

  return {
    documento,
    linkAssinatura: primeiroSignatario?.sign_url || null,
  }
}

async function listarDocumentos(companyId: string) {
  return repositorioDeAssinaturaZapsign.listarDocumentos(companyId)
}

async function sincronizarPendentes(companyId: string) {
  const pendentes = await repositorioDeAssinaturaZapsign.listarPendentes(companyId)

  if (pendentes.length === 0) {
    return { sincronizados: 0, atualizados: 0 }
  }

  let atualizados = 0

  try {
    const { apiToken, sandbox } = await obterCredenciais(companyId)

    await Promise.all(
      pendentes.map(async ({ tokenZapsign }) => {
        try {
          const resultado = await clienteZapsign.buscarDocumento(apiToken, sandbox, tokenZapsign)
          if (!resultado.sucesso) return

          const docRemoto = resultado.dados
          const novoStatus = docRemoto.status
            ? normalizarStatusZapsign(docRemoto.status)
            : undefined

          if (novoStatus && novoStatus !== 'pendente') {
            const primeiroSignatario = docRemoto.signers?.[0]
            await repositorioDeAssinaturaZapsign.atualizarStatusDocumento(tokenZapsign, novoStatus, {
              assinadoEm:
                novoStatus === 'signed' && primeiroSignatario?.signed_at
                  ? new Date(primeiroSignatario.signed_at)
                  : null,
              linkAssinatura: primeiroSignatario?.sign_url || null,
            })
            atualizados++
          }
        } catch {
          // falha silenciosa por documento — não interrompe os demais
        }
      })
    )
  } catch {
    // credenciais indisponíveis — retorna sem atualizar
  }

  return { sincronizados: pendentes.length, atualizados }
}

async function detalharDocumento(companyId: string, tokenZapsign: string) {
  const doc = await repositorioDeAssinaturaZapsign.buscarDocumentoPorToken(tokenZapsign)

  if (!doc || doc.companyId !== companyId) {
    throw new ErroDaAplicacao('Documento não encontrado', 404)
  }

  // Sincroniza status com ZapSign se ainda não concluído
  if (doc.status !== 'signed' && doc.status !== 'refused') {
    try {
      const { apiToken, sandbox } = await obterCredenciais(companyId)
      const resultado = await clienteZapsign.buscarDocumento(apiToken, sandbox, tokenZapsign)

      if (resultado.sucesso) {
        const docRemoto = resultado.dados
        const novoStatus = docRemoto.status
          ? normalizarStatusZapsign(docRemoto.status)
          : undefined

        if (novoStatus && novoStatus !== doc.status) {
          const primeiroSignatario = docRemoto.signers?.[0]
          await repositorioDeAssinaturaZapsign.atualizarStatusDocumento(tokenZapsign, novoStatus, {
            assinadoEm: primeiroSignatario?.signed_at ? new Date(primeiroSignatario.signed_at) : null,
            linkAssinatura: primeiroSignatario?.sign_url || null,
          })

          return {
            ...doc,
            status: novoStatus,
            linkAssinatura: primeiroSignatario?.sign_url || doc.linkAssinatura,
          }
        }
      }
    } catch {
      // falha silenciosa — retorna dados do banco sem sync
    }
  }

  return doc
}

async function processarWebhook(
  payload: PayloadWebhookZapsign,
  webhookSecret?: string,
  headerSecret?: string
) {
  if (webhookSecret && headerSecret !== webhookSecret) {
    throw new ErroDaAplicacao('Webhook secret inválido', 401)
  }

  const tokenDoc = payload.doc?.token
  if (!tokenDoc) return { ignorado: true, motivo: 'token ausente' }

  const doc = await repositorioDeAssinaturaZapsign.buscarDocumentoPorToken(tokenDoc)
  if (!doc) return { ignorado: true, motivo: 'documento não encontrado no banco' }

  const eventType = payload.event_type

  if (eventType === 'doc_signed') {
    const signatario = payload.doc?.signers?.[0]
    await repositorioDeAssinaturaZapsign.atualizarStatusDocumento(tokenDoc, 'signed', {
      assinadoEm: signatario?.signed_at ? new Date(signatario.signed_at) : new Date(),
    })
    return { processado: true, evento: 'signed', token: tokenDoc }
  }

  if (eventType === 'doc_refused') {
    await repositorioDeAssinaturaZapsign.atualizarStatusDocumento(tokenDoc, 'refused', {
      recusadoEm: new Date(),
      motivoRecusa: payload.doc?.refused_reason ?? null,
    })
    return { processado: true, evento: 'refused', token: tokenDoc }
  }

  if (eventType === 'doc_deleted') {
    await repositorioDeAssinaturaZapsign.atualizarStatusDocumento(tokenDoc, 'deleted')
    return { processado: true, evento: 'deleted', token: tokenDoc }
  }

  return { ignorado: true, motivo: `evento '${eventType}' não tratado` }
}

export const servicoDeAssinaturaZapsign = {
  buscarConfig,
  salvarConfig,
  testarConexao,
  enviarDocumento,
  listarDocumentos,
  sincronizarPendentes,
  detalharDocumento,
  processarWebhook,
}
