/**
 * Layout HTML corporativo reutilizável para os e-mails do portal do fornecedor.
 * Tudo em tabelas com estilo inline — é o que garante renderização consistente
 * em Outlook, Gmail e demais clientes de e-mail (CSS externo não é confiável).
 */

const COR_MARCA = '#c2410c'
const COR_MARCA_ESCURA = '#9a3412'
const COR_TEXTO_PRINCIPAL = '#1a1a1a'
const COR_TEXTO_SECUNDARIO = '#64748b'
const COR_BORDA = '#e2e8f0'
const COR_FUNDO_PAGINA = '#f1f5f9'
const COR_FUNDO_BLOCO = '#f8fafc'
const COR_FUNDO_META = '#fff7ed'
const COR_SUCESSO_FUNDO = '#ecfdf5'
const COR_SUCESSO_TEXTO = '#047857'
const COR_SUCESSO_BORDA = '#a7f3d0'
const COR_ATENCAO_FUNDO = '#fffbeb'
const COR_ATENCAO_TEXTO = '#b45309'
const COR_ATENCAO_BORDA = '#fde68a'
const COR_INFO_FUNDO = '#eff6ff'
const COR_INFO_TEXTO = '#1d4ed8'
const COR_INFO_BORDA = '#bfdbfe'

export type TomBadge = 'sucesso' | 'atencao' | 'info' | 'neutro'

export function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function estilosDoTom(tom: TomBadge): { fundo: string; texto: string; borda: string } {
  if (tom === 'sucesso') {
    return { fundo: COR_SUCESSO_FUNDO, texto: COR_SUCESSO_TEXTO, borda: COR_SUCESSO_BORDA }
  }
  if (tom === 'atencao') {
    return { fundo: COR_ATENCAO_FUNDO, texto: COR_ATENCAO_TEXTO, borda: COR_ATENCAO_BORDA }
  }
  if (tom === 'info') {
    return { fundo: COR_INFO_FUNDO, texto: COR_INFO_TEXTO, borda: COR_INFO_BORDA }
  }
  return { fundo: COR_FUNDO_BLOCO, texto: COR_TEXTO_SECUNDARIO, borda: COR_BORDA }
}

export function montarParagrafo(texto: string, margemInferior = 16): string {
  return `<p style="margin:0 0 ${margemInferior}px;font-size:15px;line-height:1.55;color:${COR_TEXTO_PRINCIPAL};">${texto}</p>`
}

export function montarBadgeStatus(dados: { tom: TomBadge; texto: string }): string {
  const estilos = estilosDoTom(dados.tom)
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
      <tr>
        <td style="background-color:${estilos.fundo};border:1px solid ${estilos.borda};border-radius:999px;padding:6px 14px;">
          <span style="font-size:12px;font-weight:bold;letter-spacing:0.03em;text-transform:uppercase;color:${estilos.texto};">${dados.texto}</span>
        </td>
      </tr>
    </table>
  `.trim()
}

export function montarFaixaMeta(dados: { itens: { rotulo: string; valor: string }[] }): string {
  const celulas = dados.itens
    .map(
      (item, indice) => `
        <td style="padding:12px 16px;${indice > 0 ? `border-left:1px solid ${COR_BORDA};` : ''}">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:${COR_TEXTO_SECUNDARIO};margin-bottom:4px;">${item.rotulo}</div>
          <div style="font-size:14px;font-weight:bold;color:${COR_TEXTO_PRINCIPAL};">${item.valor}</div>
        </td>
      `
    )
    .join('')

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COR_FUNDO_META};border:1px solid #fed7aa;border-radius:8px;margin:0 0 20px;">
      <tr>
        ${celulas}
      </tr>
    </table>
  `.trim()
}

export function montarBlocoDestaque(dados: {
  titulo?: string
  html: string
  tom?: TomBadge
}): string {
  const tom = dados.tom ?? 'atencao'
  const estilos = estilosDoTom(tom)
  const titulo = dados.titulo
    ? `<div style="font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.04em;color:${estilos.texto};margin-bottom:8px;">${dados.titulo}</div>`
    : ''

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${estilos.fundo};border:1px solid ${estilos.borda};border-left:4px solid ${estilos.texto};border-radius:8px;margin:0 0 20px;">
      <tr>
        <td style="padding:14px 16px;">
          ${titulo}
          <div style="font-size:14px;line-height:1.5;color:${COR_TEXTO_PRINCIPAL};">${dados.html}</div>
        </td>
      </tr>
    </table>
  `.trim()
}

export function montarPassos(dados: { itens: string[] }): string {
  const linhas = dados.itens
    .map(
      (item, indice) => `
        <tr>
          <td valign="top" style="padding:0 0 12px;width:28px;">
            <div style="width:24px;height:24px;border-radius:50%;background-color:${COR_MARCA};color:#ffffff;font-size:12px;font-weight:bold;text-align:center;line-height:24px;">${indice + 1}</div>
          </td>
          <td valign="top" style="padding:2px 0 12px 8px;font-size:14px;line-height:1.45;color:${COR_TEXTO_PRINCIPAL};">${item}</td>
        </tr>
      `
    )
    .join('')

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">
      ${linhas}
    </table>
  `.trim()
}

export function montarBotaoCta(dados: { texto: string; url: string }): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
      <tr>
        <td align="center" bgcolor="${COR_MARCA}" style="border-radius:8px;background-color:${COR_MARCA};">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${dados.url}" style="height:44px;v-text-anchor:middle;width:280px;" arcsize="12%" stroke="f" fillcolor="${COR_MARCA}">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${dados.texto}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-- -->
          <a href="${dados.url}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;background-color:${COR_MARCA};mso-hide:all;">${dados.texto}</a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>
  `.trim()
}

export function montarBlocoCredenciais(dados: {
  titulo?: string
  itens: { rotulo: string; valor: string }[]
}): string {
  const titulo = dados.titulo
    ? `<tr><td colspan="2" style="padding:14px 16px 8px;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.04em;color:${COR_MARCA_ESCURA};">${dados.titulo}</td></tr>`
    : ''

  const linhas = dados.itens
    .map(
      (item, indice) => `
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:${COR_TEXTO_SECUNDARIO};${indice > 0 ? `border-top:1px solid ${COR_BORDA};` : ''}">${item.rotulo}</td>
          <td style="padding:10px 16px;font-size:15px;color:${COR_TEXTO_PRINCIPAL};font-weight:bold;text-align:right;${indice > 0 ? `border-top:1px solid ${COR_BORDA};` : ''}">${item.valor}</td>
        </tr>
      `
    )
    .join('')

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COR_FUNDO_BLOCO};border:1px solid ${COR_BORDA};border-radius:8px;margin:0 0 20px;">
      ${titulo}
      ${linhas}
    </table>
  `.trim()
}

export function montarLayoutEmailCorporativo(dados: {
  titulo: string
  nomeEmpresa: string
  corpoHtml: string
  preheader?: string
  numeroPedido?: number
  rodapeExtra?: string
}): string {
  const preheader = dados.preheader
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${dados.preheader}</div>`
    : ''

  const faixaMeta = dados.numeroPedido
    ? montarFaixaMeta({
        itens: [{ rotulo: 'Pedido', valor: `#${dados.numeroPedido}` }],
      })
    : ''

  return `
    ${preheader}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COR_FUNDO_PAGINA};padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial, Helvetica, sans-serif;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
            <tr>
              <td style="background-color:${COR_MARCA};padding:22px 32px;">
                <div style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.01em;">${dados.nomeEmpresa}</div>
                <div style="color:#ffedd5;font-size:12px;margin-top:6px;letter-spacing:0.06em;text-transform:uppercase;">Portal do Fornecedor</div>
              </td>
            </tr>
            <tr>
              <td style="height:4px;background-color:${COR_MARCA_ESCURA};font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${faixaMeta}
                <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:${COR_TEXTO_PRINCIPAL};font-weight:bold;">${dados.titulo}</h1>
                ${dados.corpoHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background-color:${COR_FUNDO_BLOCO};border-top:1px solid ${COR_BORDA};">
                <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:${COR_TEXTO_PRINCIPAL};">${dados.nomeEmpresa}</p>
                <p style="margin:0;font-size:12px;line-height:1.5;color:${COR_TEXTO_SECUNDARIO};">
                  Esta é uma mensagem automática do Portal do Fornecedor — não é necessário responder este e-mail.${
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
