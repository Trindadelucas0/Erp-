/**
 * Monta e envia e-mails internos do fluxo do portal do fornecedor.
 * Avisos ao fornecedor (credenciais, aprovação, ajuste) vão por WhatsApp (wa.me).
 * Falha de envio nunca derruba o fluxo principal — retorna { sucesso: false }.
 */
import { obterConfigNotificacoesEmail } from './config-notificacoes-email.js'
import { enviarEmailResend } from './cliente-resend.js'
import {
  escaparHtml,
  montarBadgeStatus,
  montarBlocoCredenciais,
  montarBlocoDestaque,
  montarLayoutEmailCorporativo,
  montarParagrafo,
} from './template-email-corporativo.js'

export type ResultadoEnvioEmail = { sucesso: boolean; mensagem?: string }

async function avisarUploadFornecedor(dados: {
  numeroPedido: number
  fornecedorNome: string
  nomeEmpresa: string
  nomeArquivo: string
}): Promise<ResultadoEnvioEmail> {
  const config = obterConfigNotificacoesEmail()
  if (!config.emailAvisoInterno) {
    return { sucesso: false, mensagem: 'RESEND_AVISO_PARA não configurado no .env' }
  }

  const nomeEmpresa = escaparHtml(dados.nomeEmpresa)
  const fornecedorNome = escaparHtml(dados.fornecedorNome)
  const nomeArquivo = escaparHtml(dados.nomeArquivo)

  const corpoHtml = `
    ${montarBadgeStatus({ tom: 'neutro', texto: 'Ação necessária' })}
    ${montarParagrafo('Um novo documento do fornecedor foi recebido e está disponível para conferência no painel do pedido.')}
    ${montarBlocoCredenciais({
      titulo: 'Resumo do envio',
      itens: [
        { rotulo: 'Pedido', valor: `#${dados.numeroPedido}` },
        { rotulo: 'Fornecedor', valor: fornecedorNome },
        { rotulo: 'Arquivo', valor: nomeArquivo },
      ],
    })}
    ${montarBlocoDestaque({
      tom: 'info',
      titulo: 'Próximo passo',
      html: 'Abra o pedido no ERP, acesse a aba Avaliação do pedido e use Conferir com IA ou decida diretamente (Aprovar / Solicitar ajuste).',
    })}
  `.trim()

  const html = montarLayoutEmailCorporativo({
    titulo: 'Novo documento recebido',
    nomeEmpresa,
    numeroPedido: dados.numeroPedido,
    preheader: `Pedido #${dados.numeroPedido} — ${dados.fornecedorNome} enviou ${dados.nomeArquivo}.`,
    corpoHtml,
  })

  const resultado = await enviarEmailResend({
    apiKey: config.apiKey,
    de: config.remetente,
    para: [config.emailAvisoInterno],
    assunto: `Documento recebido — Pedido #${dados.numeroPedido}`,
    html,
  })

  return resultado.sucesso ? { sucesso: true } : { sucesso: false, mensagem: resultado.mensagem }
}

export const servicoDeNotificacoesEmail = {
  avisarUploadFornecedor,
}
