/**
 * Monta URL pública para arquivos em /uploads (fotos de produto, etc.).
 * Em dev, o Next faz proxy de /uploads para a API (ver next.config.ts).
 */
import { urlPublicaDoApp } from './url-publica'

export function resolverUrlUpload(caminho?: string | null): string | null {
  if (!caminho) return null
  if (caminho.startsWith('http') || caminho.startsWith('data:')) return caminho
  const origem = urlPublicaDoApp() || 'http://localhost:3333'
  return `${origem}${caminho.startsWith('/') ? caminho : `/${caminho}`}`
}
