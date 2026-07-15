/**
 * Monta e envia os e-mails do fluxo do portal do fornecedor.
 * Falha de envio nunca derruba o fluxo principal (liberação, upload) —
 * o serviço retorna { sucesso: false } e quem chamou decide se avisa o usuário.
 */
import { obterConfigNotificacoesEmail } from './config-notificacoes-email.js'
import { enviarEmailResend } from './cliente-resend.js'
import {
  montarBlocoCredenciais,
  montarBotaoCta,
  montarLayoutEmailCorporativo,
} from './template-email-corporativo.js'

export type ResultadoEnvioEmail = { sucesso: boolean; mensagem?: string }

function formatarCnpj(cnpj: string): string {
  const digitos = cnpj.replace(/\D/g, '')
  if (digitos.length !== 14) return cnpj
  return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

async function enviarCredenciaisPortal(dados: {
  emailFornecedor: string
  fornecedorNome: string
  nomeEmpresa: string
  cnpj: string
  numeroPedido: number
}): Promise<ResultadoEnvioEmail> {
  const config = obterConfigNotificacoesEmail()
  const urlPortal = `${config.urlPortalFornecedor}/portal-fornecedor/login`

  const corpoHtml = `
    <p style="margin:0 0 12px;font-size:14px;color:#1a1a1a;">Olá, ${dados.fornecedorNome}.</p>
    <p style="margin:0 0 12px;font-size:14px;color:#1a1a1a;">Use os dados abaixo para acessar o portal e enviar seu documento (pedido, nota ou proposta):</p>
    ${montarBlocoCredenciais({
      itens: [
        { rotulo: 'CNPJ', valor: formatarCnpj(dados.cnpj) },
        { rotulo: 'Senha (nº do pedido)', valor: String(dados.numeroPedido) },
      ],
    })}
    ${montarBotaoCta({ texto: 'Acessar portal do fornecedor', url: urlPortal })}
    <p style="margin:0;font-size:12px;color:#666;">O acesso expira em 7 dias ou quando o comprador bloquear o portal.</p>
  `.trim()

  const html = montarLayoutEmailCorporativo({
    titulo: `Acesso ao portal — Pedido #${dados.numeroPedido}`,
    nomeEmpresa: dados.nomeEmpresa,
    corpoHtml,
  })

  const texto = [
    `Acesso ao portal do pedido #${dados.numeroPedido}`,
    `CNPJ: ${formatarCnpj(dados.cnpj)}`,
    `Senha (nº do pedido): ${dados.numeroPedido}`,
    `Acesse: ${urlPortal}`,
  ].join('\n')

  const resultado = await enviarEmailResend({
    apiKey: config.apiKey,
    de: config.remetente,
    para: [dados.emailFornecedor],
    assunto: `Acesso ao portal — Pedido #${dados.numeroPedido}`,
    html,
    texto,
  })

  return resultado.sucesso ? { sucesso: true } : { sucesso: false, mensagem: resultado.mensagem }
}

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

  const corpoHtml = `
    ${montarBlocoCredenciais({
      itens: [
        { rotulo: 'Pedido', valor: `#${dados.numeroPedido}` },
        { rotulo: 'Fornecedor', valor: dados.fornecedorNome },
        { rotulo: 'Arquivo', valor: dados.nomeArquivo },
      ],
    })}
    <p style="margin:0;font-size:14px;color:#1a1a1a;">Acesse o painel do pedido para conferir com a IA.</p>
  `.trim()

  const html = montarLayoutEmailCorporativo({
    titulo: `Novo documento recebido — Pedido #${dados.numeroPedido}`,
    nomeEmpresa: dados.nomeEmpresa,
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

async function avisarDocumentoAprovado(dados: {
  emailFornecedor: string
  fornecedorNome: string
  nomeEmpresa: string
  numeroPedido: number
}): Promise<ResultadoEnvioEmail> {
  const config = obterConfigNotificacoesEmail()

  const corpoHtml = `
    <p style="margin:0 0 12px;font-size:14px;color:#1a1a1a;">Olá, ${dados.fornecedorNome}.</p>
    <p style="margin:0;font-size:14px;color:#1a1a1a;">O documento enviado para o pedido #${dados.numeroPedido} foi conferido e está tudo certo. Não é necessária nenhuma ação adicional.</p>
  `.trim()

  const html = montarLayoutEmailCorporativo({
    titulo: `Documento aprovado — Pedido #${dados.numeroPedido}`,
    nomeEmpresa: dados.nomeEmpresa,
    corpoHtml,
  })

  const texto = [
    `Documento aprovado — Pedido #${dados.numeroPedido}`,
    `O documento enviado foi conferido e está tudo certo. Nenhuma ação adicional é necessária.`,
  ].join('\n')

  const resultado = await enviarEmailResend({
    apiKey: config.apiKey,
    de: config.remetente,
    para: [dados.emailFornecedor],
    assunto: `Documento aprovado — Pedido #${dados.numeroPedido}`,
    html,
    texto,
  })

  return resultado.sucesso ? { sucesso: true } : { sucesso: false, mensagem: resultado.mensagem }
}

async function avisarAjusteNecessario(dados: {
  emailFornecedor: string
  fornecedorNome: string
  nomeEmpresa: string
  numeroPedido: number
  motivo: string
}): Promise<ResultadoEnvioEmail> {
  const config = obterConfigNotificacoesEmail()
  const urlPortal = `${config.urlPortalFornecedor}/portal-fornecedor/login`

  const corpoHtml = `
    <p style="margin:0 0 12px;font-size:14px;color:#1a1a1a;">Olá, ${dados.fornecedorNome}.</p>
    <p style="margin:0 0 12px;font-size:14px;color:#1a1a1a;">Foram identificadas divergências no documento enviado para o pedido #${dados.numeroPedido}:</p>
    <p style="margin:0 0 16px;background:#fff3cd;border-radius:6px;padding:8px 12px;font-size:14px;color:#1a1a1a;">${dados.motivo}</p>
    <p style="margin:0 0 12px;font-size:14px;color:#1a1a1a;">Acesse o portal e envie um novo documento corrigido:</p>
    ${montarBotaoCta({ texto: 'Acessar portal do fornecedor', url: urlPortal })}
  `.trim()

  const html = montarLayoutEmailCorporativo({
    titulo: `Ajuste necessário — Pedido #${dados.numeroPedido}`,
    nomeEmpresa: dados.nomeEmpresa,
    corpoHtml,
  })

  const texto = [
    `Ajuste necessário — Pedido #${dados.numeroPedido}`,
    `Motivo: ${dados.motivo}`,
    `Acesse o portal e envie um novo documento: ${urlPortal}`,
  ].join('\n')

  const resultado = await enviarEmailResend({
    apiKey: config.apiKey,
    de: config.remetente,
    para: [dados.emailFornecedor],
    assunto: `Ajuste necessário — Pedido #${dados.numeroPedido}`,
    html,
    texto,
  })

  return resultado.sucesso ? { sucesso: true } : { sucesso: false, mensagem: resultado.mensagem }
}

export const servicoDeNotificacoesEmail = {
  enviarCredenciaisPortal,
  avisarUploadFornecedor,
  avisarDocumentoAprovado,
  avisarAjusteNecessario,
}
