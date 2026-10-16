export function telefoneWhatsApp(telefone: string): string | null {
  const digitos = telefone.replace(/\D/g, '')
  if (/^[1-9]\d{9,10}$/.test(digitos)) return `55${digitos}`
  if (/^55[1-9]\d{9,10}$/.test(digitos)) return digitos
  return null
}

export async function compartilharPdfOrcamento(blob: Blob, numero: string, telefone: string) {
  const arquivo = new File([blob], `orcamento-${numero.replace(/[^\w-]/g, '_')}.pdf`, { type: 'application/pdf' })
  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: `Orçamento ${numero}`, text: `Segue o orçamento ${numero}.` })
      return 'Selecione o WhatsApp e confira o destinatário para enviar o orçamento.'
    } catch (erro) {
      if (erro && typeof erro === 'object' && 'name' in erro && erro.name === 'AbortError') return 'Compartilhamento cancelado.'
      // Navegadores podem anunciar suporte e recusar o arquivo; disponibilizar download.
    }
  }
  const url = URL.createObjectURL(arquivo)
  const link = document.createElement('a')
  link.href = url
  link.download = arquivo.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  const whatsappUrl = `https://wa.me/${telefone}?text=${encodeURIComponent(`Segue o orçamento ${numero}.`)}`
  // A navegação acontece após o download, sem depender de pop-up após uma chamada assíncrona.
  const janela = window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
  void janela
  return 'PDF baixado. Abra o WhatsApp pelo link abaixo, anexe o arquivo e confirme o envio.'
}
