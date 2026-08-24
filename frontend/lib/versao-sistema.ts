import versao from '@versao-sistema'

export type VersaoSistema = {
  numero: string
  nome: string
}

export const VERSAO_SISTEMA: VersaoSistema = {
  numero: versao.numero,
  nome: versao.nome,
}

/** Texto discreto para login e cabeçalho: `1.10.0 · Auditoria de entradas` */
export function textoVersaoSistema(): string {
  return `${VERSAO_SISTEMA.numero} · ${VERSAO_SISTEMA.nome}`
}
