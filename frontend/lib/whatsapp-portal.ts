/**
 * Helpers para abrir WhatsApp (wa.me) com mensagem pronta do portal do fornecedor.
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
      : digitos.length === 10 || digitos.length === 11
        ? `55${digitos}`
        : digitos
  return `https://wa.me/${comPais}?text=${encodeURIComponent(texto)}`
}

export function abrirWhatsappComMensagem(telefone: string, texto: string): void {
  const url = montarUrlWhatsapp(telefone, texto)
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function mensagemToastAvisoWhatsapp(aviso: AvisoWhatsappPortal, acaoConcluida: string): string {
  if (!aviso.avisoWhatsappDisponivel || !aviso.telefonesWhatsapp?.length) {
    return `${acaoConcluida}. ${aviso.mensagemAviso ?? 'Fornecedor sem telefone cadastrado — avise manualmente.'}`
  }
  if (aviso.telefonesWhatsapp.length === 1) {
    return `${acaoConcluida}. WhatsApp aberto com a mensagem pronta.`
  }
  return `${acaoConcluida}. Escolha o telefone para abrir o WhatsApp.`
}
