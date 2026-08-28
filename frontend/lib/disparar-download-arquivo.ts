/**
 * Dispara download de arquivo no navegador sem navegar fora da SPA.
 * O link precisa estar no DOM (appendChild) — padrão usado em anexos e pedidos.
 */

export function dispararDownloadArquivo(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 100)
}

/** Valida magic bytes de PDF (%PDF) antes de disparar download. */
export function blobParecePdf(blob: Blob): Promise<boolean> {
  return blob.slice(0, 4).text().then((inicio) => inicio.startsWith('%PDF'))
}
