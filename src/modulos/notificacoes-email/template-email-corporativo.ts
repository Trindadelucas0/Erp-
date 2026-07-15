/**
 * Layout HTML corporativo reutilizável para os e-mails do portal do fornecedor.
 * Tudo em tabelas com estilo inline — é o que garante renderização consistente
 * em Outlook, Gmail e demais clientes de e-mail (CSS externo não é confiável).
 */
const COR_FAIXA = '#c2410c'
const COR_TEXTO_PRINCIPAL = '#1a1a1a'
const COR_TEXTO_SECUNDARIO = '#666666'
const COR_BORDA = '#e5e5e5'
const COR_FUNDO_PAGINA = '#f4f4f5'
const COR_FUNDO_BLOCO = '#f9fafb'

export function montarLayoutEmailCorporativo(dados: {
  titulo: string
  nomeEmpresa: string
  corpoHtml: string
  rodapeExtra?: string
}): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COR_FUNDO_PAGINA};padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;font-family:Arial, Helvetica, sans-serif;">
            <tr>
              <td style="background-color:${COR_FAIXA};padding:20px 32px;border-radius:8px 8px 0 0;">
                <span style="color:#ffffff;font-size:18px;font-weight:bold;">${dados.nomeEmpresa}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:20px;color:${COR_TEXTO_PRINCIPAL};">${dados.titulo}</h1>
                ${dados.corpoHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid ${COR_BORDA};border-radius:0 0 8px 8px;">
                <p style="margin:0;font-size:12px;color:${COR_TEXTO_SECUNDARIO};">
                  Esta é uma mensagem automática — não é necessário responder este e-mail.${
                    dados.rodapeExtra ? ` ${dados.rodapeExtra}` : ''
                  }
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `.trim()
}

export function montarBotaoCta(dados: { texto: string; url: string }): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
      <tr>
        <td style="border-radius:6px;background-color:${COR_FAIXA};">
          <a href="${dados.url}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">${dados.texto}</a>
        </td>
      </tr>
    </table>
  `.trim()
}

export function montarBlocoCredenciais(dados: { itens: { rotulo: string; valor: string }[] }): string {
  const linhas = dados.itens
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;font-size:13px;color:${COR_TEXTO_SECUNDARIO};">${item.rotulo}</td>
          <td style="padding:8px 0;font-size:14px;color:${COR_TEXTO_PRINCIPAL};font-weight:bold;text-align:right;">${item.valor}</td>
        </tr>
      `
    )
    .join('')

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COR_FUNDO_BLOCO};border:1px solid ${COR_BORDA};border-radius:6px;margin:16px 0;">
      <tr>
        <td style="padding:4px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${linhas}
          </table>
        </td>
      </tr>
    </table>
  `.trim()
}
