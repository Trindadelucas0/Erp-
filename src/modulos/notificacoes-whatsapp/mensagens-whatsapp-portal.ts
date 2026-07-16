/**
 * Monta textos e links wa.me para avisos manuais ao fornecedor (portal).
 * Não envia mensagem automaticamente — o comprador abre o link e envia.
 */

export type TelefoneWhatsapp = {
  id: string
  valor: string
  valorFormatado: string
  whatsapp: boolean
  principal: boolean
}

export type ContatoTelefoneFonte = {
  id: string
  valor: string
  whatsapp: boolean
  principal: boolean
}

export function normalizarTelefoneWhatsapp(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '')
  if (!digitos || digitos.length < 8) return null

  if (digitos.startsWith('55') && digitos.length >= 12) {
    return digitos
  }

  if (digitos.length >= 8 && digitos.length <= 11) {
    return `55${digitos}`
  }

  if (digitos.length <= 15) {
    return digitos
  }

  return null
}

export function formatarTelefoneExibicao(valor: string): string {
  const digitos = valor.replace(/\D/g, '')
  const nacional = digitos.startsWith('55') && digitos.length >= 12 ? digitos.slice(2) : digitos
  if (nacional.length === 11) {
    return nacional.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  if (nacional.length === 10) {
    return nacional.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
  return valor
}

export function listarTelefonesParaWhatsapp(contatos: ContatoTelefoneFonte[]): TelefoneWhatsapp[] {
  const lista: TelefoneWhatsapp[] = []
  const vistos = new Set<string>()

  for (const contato of contatos) {
    const normalizado = normalizarTelefoneWhatsapp(contato.valor)
    if (!normalizado || vistos.has(normalizado)) continue
    vistos.add(normalizado)
    lista.push({
      id: contato.id,
      valor: normalizado,
      valorFormatado: formatarTelefoneExibicao(contato.valor),
      whatsapp: contato.whatsapp,
      principal: contato.principal,
    })
  }

  return lista.sort((a, b) => {
    if (a.whatsapp !== b.whatsapp) return a.whatsapp ? -1 : 1
    if (a.principal !== b.principal) return a.principal ? -1 : 1
    return 0
  })
}

export function montarUrlWhatsapp(dados: { telefone: string; texto: string }): string {
  const telefone = normalizarTelefoneWhatsapp(dados.telefone) ?? dados.telefone.replace(/\D/g, '')
  if (!telefone || telefone.length < 8) {
    throw new Error('Telefone do fornecedor inválido para WhatsApp')
  }
  return `https://wa.me/${telefone}?text=${encodeURIComponent(dados.texto)}`
}

function urlBasePortal(): string {
  const base = (process.env.PORTAL_FORNECEDOR_URL || '').replace(/\/+$/, '')
  return base || 'http://localhost:3333'
}

function formatarCnpj(cnpj: string): string {
  const digitos = cnpj.replace(/\D/g, '')
  if (digitos.length !== 14) return cnpj
  return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

export function montarTextoCredenciaisPortal(dados: {
  fornecedorNome: string
  nomeEmpresa: string
  cnpj: string
  numeroPedido: number
}): string {
  const urlPortal = `${urlBasePortal()}/portal-fornecedor/login`
  return [
    `Olá, ${dados.fornecedorNome}.`,
    '',
    `${dados.nomeEmpresa} liberou o acesso ao Portal do Fornecedor para o pedido #${dados.numeroPedido}.`,
    '',
    `CNPJ: ${formatarCnpj(dados.cnpj)}`,
    `Senha (nº do pedido): ${dados.numeroPedido}`,
    '',
    `Acesse: ${urlPortal}`,
  ].join('\n')
}

export function montarTextoDocumentoAprovado(dados: {
  fornecedorNome: string
  nomeEmpresa: string
  numeroPedido: number
}): string {
  return [
    `Olá, ${dados.fornecedorNome}.`,
    '',
    `${dados.nomeEmpresa} aprovou o documento do pedido #${dados.numeroPedido}.`,
    'Não é necessária nenhuma ação adicional.',
  ].join('\n')
}

export function montarTextoAjusteNecessario(dados: {
  fornecedorNome: string
  nomeEmpresa: string
  numeroPedido: number
  motivo: string
}): string {
  const urlPortal = `${urlBasePortal()}/portal-fornecedor/login`
  return [
    `Olá, ${dados.fornecedorNome}.`,
    '',
    `${dados.nomeEmpresa} solicitou ajuste no documento do pedido #${dados.numeroPedido}.`,
    '',
    `Motivo: ${dados.motivo}`,
    '',
    `Acesse o portal e envie um novo documento: ${urlPortal}`,
  ].join('\n')
}

export type ResultadoAvisoWhatsappPortal = {
  avisoWhatsappDisponivel: boolean
  telefonesWhatsapp: TelefoneWhatsapp[]
  textoWhatsapp: string
  mensagemAviso?: string
}

/** Se houver telefone(s) marcados como WhatsApp, usa só esses; senão, todos os válidos. */
export function selecionarTelefonesParaAviso(
  contatos: ContatoTelefoneFonte[]
): TelefoneWhatsapp[] {
  const lista = listarTelefonesParaWhatsapp(contatos)
  const marcados = lista.filter((t) => t.whatsapp)
  return marcados.length > 0 ? marcados : lista
}

export function montarResultadoAvisoWhatsapp(dados: {
  contatos: ContatoTelefoneFonte[]
  textoWhatsapp: string
  mensagemSemTelefone: string
}): ResultadoAvisoWhatsappPortal {
  const telefonesWhatsapp = selecionarTelefonesParaAviso(dados.contatos)
  if (telefonesWhatsapp.length === 0) {
    return {
      avisoWhatsappDisponivel: false,
      telefonesWhatsapp: [],
      textoWhatsapp: dados.textoWhatsapp,
      mensagemAviso: dados.mensagemSemTelefone,
    }
  }

  return {
    avisoWhatsappDisponivel: true,
    telefonesWhatsapp,
    textoWhatsapp: dados.textoWhatsapp,
  }
}
