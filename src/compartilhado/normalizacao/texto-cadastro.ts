/**
 * Normaliza texto de cadastro para caixa alta (consistência visual nas listagens).
 * Não usar em e-mail, senha, telefone ou documentos com máscara.
 */
import { decodificarEntidadesXml } from './entidades-xml.js'

export function normalizarTextoCadastro(valor: string | undefined | null): string | undefined {
  if (valor == null) return undefined
  const texto = valor.trim()
  if (!texto) return ''
  return decodificarEntidadesXml(texto).toUpperCase()
}
