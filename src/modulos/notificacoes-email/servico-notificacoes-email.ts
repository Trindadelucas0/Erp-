/**
 * Monta e envia os e-mails do fluxo do portal do fornecedor.
 * Falha de envio nunca derruba o fluxo principal (liberação, upload) —
 * o serviço retorna { sucesso: false } e quem chamou decide se avisa o usuário.
 */
import { obterConfigNotificacoesEmail } from './config-notificacoes-email.js'
import { enviarEmailResend } from './cliente-resend.js'
import {
  escaparHtml,
  montarBadgeStatus,
  montarBlocoCredenciais,
  montarBlocoDestaque,
  montarBotaoCta,
  montarLayoutEmailCorporativo,
  montarParagrafo,
  montarPassos,
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
  const nomeEmpresa = escaparHtml(dados.nomeEmpresa)
  const fornecedorNome = escaparHtml(dados.fornecedorNome)
  const cnpjFormatado = escaparHtml(formatarCnpj(dados.cnpj))

  const corpoHtml = `
    ${montarBadgeStatus({ tom: 'info', texto: 'Acesso liberado' })}
    ${montarParagrafo(`Olá, <strong>${fornecedorNome}</strong>.`)}
    ${montarParagrafo(
      'Seu acesso ao portal foi liberado. Use as credenciais abaixo para consultar o pedido e enviar o documento oficial (pedido, nota ou proposta).'
    )}
    ${montarBlocoCredenciais({
      titulo: 'Dados de acesso',
      itens: [
        { rotulo: 'CNPJ', valor: cnpjFormatado },
        { rotulo: 'Senha (nº do pedido)', valor: String(dados.numeroPedido) },
      ],
    })}
    ${montarPassos({
      itens: [
        'Acesse o portal com o CNPJ e a senha informados acima',
        'Consulte os itens do pedido',
        'Envie o documento oficial para conferência',
      ],
    })}
    ${montarBotaoCta({ texto: 'Acessar portal do fornecedor', url: urlPortal })}
  `.trim()

  const html = montarLayoutEmailCorporativo({
    titulo: 'Acesso ao portal liberado',
    nomeEmpresa,
    numeroPedido: dados.numeroPedido,
    preheader: `Pedido #${dados.numeroPedido} — use CNPJ e senha para acessar o portal.`,
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

async function avisarDocumentoAprovado(dados: {
  emailFornecedor: string
  fornecedorNome: string
  nomeEmpresa: string
  numeroPedido: number
}): Promise<ResultadoEnvioEmail> {
  const config = obterConfigNotificacoesEmail()
  const nomeEmpresa = escaparHtml(dados.nomeEmpresa)
  const fornecedorNome = escaparHtml(dados.fornecedorNome)

  const corpoHtml = `
    ${montarBadgeStatus({ tom: 'sucesso', texto: 'Documento aprovado' })}
    ${montarParagrafo(`Olá, <strong>${fornecedorNome}</strong>.`)}
    ${montarParagrafo(
      `O documento enviado para o pedido <strong>#${dados.numeroPedido}</strong> foi conferido e está tudo certo.`
    )}
    ${montarBlocoDestaque({
      tom: 'sucesso',
      titulo: 'Sem ação necessária',
      html: 'Não é necessário reenviar documento nem acessar o portal por causa desta aprovação.',
    })}
  `.trim()

  const html = montarLayoutEmailCorporativo({
    titulo: 'Documento aprovado',
    nomeEmpresa,
    numeroPedido: dados.numeroPedido,
    preheader: `Pedido #${dados.numeroPedido} — documento conferido e aprovado.`,
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
  const nomeEmpresa = escaparHtml(dados.nomeEmpresa)
  const fornecedorNome = escaparHtml(dados.fornecedorNome)
  const motivo = escaparHtml(dados.motivo)

  const corpoHtml = `
    ${montarBadgeStatus({ tom: 'atencao', texto: 'Ajuste necessário' })}
    ${montarParagrafo(`Olá, <strong>${fornecedorNome}</strong>.`)}
    ${montarParagrafo(
      `Foram identificadas divergências no documento enviado para o pedido <strong>#${dados.numeroPedido}</strong>.`
    )}
    ${montarBlocoDestaque({
      tom: 'atencao',
      titulo: 'Motivo do ajuste',
      html: motivo,
    })}
    ${montarParagrafo('Acesse o portal e envie um novo documento corrigido.')}
    ${montarBotaoCta({ texto: 'Acessar portal do fornecedor', url: urlPortal })}
  `.trim()

  const html = montarLayoutEmailCorporativo({
    titulo: 'Ajuste necessário no documento',
    nomeEmpresa,
    numeroPedido: dados.numeroPedido,
    preheader: `Pedido #${dados.numeroPedido} — reenvie o documento pelo portal.`,
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
