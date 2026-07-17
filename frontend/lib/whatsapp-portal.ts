/**
 * Helpers para abrir WhatsApp (wa.me) com mensagem pronta nos números
 * marcados como WhatsApp no cadastro do fornecedor.
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

/** Abre wa.me em todos os telefones (mesmo clique; o navegador pode bloquear pop-ups extras). */
export function abrirWhatsappEmTodos(
  telefones: TelefoneWhatsappAviso[],
  texto: string
): void {
  for (const telefone of telefones) {
    abrirWhatsappComMensagem(telefone.valor, texto)
  }
}

/**
 * Toast após ação com aviso WhatsApp: só acrescenta texto em falha
 * (sem telefone / sem marca WhatsApp). Sucesso = só a ação concluída.
 */
export function mensagemToastAvisoWhatsapp(aviso: AvisoWhatsappPortal, acaoConcluida: string): string {
  if (!aviso.avisoWhatsappDisponivel || !aviso.telefonesWhatsapp?.length) {
    return `${acaoConcluida}. ${aviso.mensagemAviso ?? 'Marque a opção WhatsApp em pelo menos um telefone do fornecedor.'}`
  }
  return acaoConcluida
}

/** Só números marcados como WhatsApp no cadastro. */
export function selecionarTelefonesParaAvisoFront(
  telefones: TelefoneWhatsappAviso[]
): TelefoneWhatsappAviso[] {
  return telefones.filter((t) => t.whatsapp)
}

/**
 * Abre wa.me em todos os telefones marcados como WhatsApp.
 * Sem telefone marcado: não abre nada.
 */
export function processarAvisoWhatsappPortal(
  aviso: AvisoWhatsappPortal | null | undefined
): boolean {
  if (!aviso?.avisoWhatsappDisponivel || !aviso.textoWhatsapp) {
    return false
  }

  const telefones = selecionarTelefonesParaAvisoFront(aviso.telefonesWhatsapp ?? [])
  if (telefones.length === 0) {
    return false
  }

  abrirWhatsappEmTodos(telefones, aviso.textoWhatsapp)
  return true
}
