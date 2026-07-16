/**
 * Helpers para abrir WhatsApp (wa.me) com mensagem pronta no número do fornecedor.
 */

export type TelefoneWhatsappAviso = {
  id: string
  valor: string
  valorFormatado: string
  whatsapp?: boolean
  principal?: boolean
}

export type AvisoWhatsappPortal = {
  avisoWhatsappDisponivel?: boolean
  telefonesWhatsapp?: TelefoneWhatsappAviso[]
  textoWhatsapp?: string
  mensagemAviso?: string
}

export function montarUrlWhatsapp(telefone: string, texto: string): string {
  const digitos = telefone.replace(/\D/g, '')
  const comPais =
    digitos.startsWith('55') || digitos.length > 11
      ? digitos
      : digitos.length >= 8 && digitos.length <= 11
        ? `55${digitos}`
        : digitos
  if (comPais.length < 8) {
    throw new Error('Telefone do fornecedor inválido para WhatsApp')
  }
  return `https://wa.me/${comPais}?text=${encodeURIComponent(texto)}`
}

export function abrirWhatsappComMensagem(telefone: string, texto: string): void {
  const url = montarUrlWhatsapp(telefone, texto)
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Toast após ação com aviso WhatsApp: só retorna texto em falha (sem telefone)
 * ou quando o comprador ainda precisa escolher o número. Sucesso com abertura
 * automática = só a ação concluída, sem "WhatsApp aberto…".
 */
export function mensagemToastAvisoWhatsapp(aviso: AvisoWhatsappPortal, acaoConcluida: string): string {
  if (!aviso.avisoWhatsappDisponivel || !aviso.telefonesWhatsapp?.length) {
    return `${acaoConcluida}. ${aviso.mensagemAviso ?? 'Cadastre o telefone do fornecedor para enviar pelo WhatsApp.'}`
  }
  if (aviso.telefonesWhatsapp.length > 1) {
    return `${acaoConcluida}. Escolha o telefone do fornecedor para abrir o WhatsApp.`
  }
  return acaoConcluida
}

/** Preferência: só números marcados como WhatsApp, se houver. */
export function selecionarTelefonesParaAvisoFront(
  telefones: TelefoneWhatsappAviso[]
): TelefoneWhatsappAviso[] {
  const marcados = telefones.filter((t) => t.whatsapp)
  return marcados.length > 0 ? marcados : telefones
}
