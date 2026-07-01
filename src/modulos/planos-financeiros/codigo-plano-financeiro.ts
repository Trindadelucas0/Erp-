/**
 * Utilitários para códigos hierárquicos de planos financeiros (1.1, 2.3.1).
 */

export type TipoPlanoFinanceiro = 'receita' | 'despesa'

export function raizDoTipo(tipo: TipoPlanoFinanceiro): string {
  return tipo === 'receita' ? '1' : '2'
}

export function nivelDoCodigo(codigo: string): number {
  if (!codigo.includes('.')) return 1
  return codigo.split('.').length
}

export function codigoCompativelComTipo(codigo: string, tipo: TipoPlanoFinanceiro): boolean {
  const raiz = raizDoTipo(tipo)
  return codigo === raiz || codigo.startsWith(`${raiz}.`)
}

export function proximoCodigoFilho(codigoPai: string, codigosIrmaos: string[]): string {
  const prefixo = codigoPai
  const filhos = codigosIrmaos
    .filter((c) => c.startsWith(`${prefixo}.`))
    .map((c) => {
      const sufixo = c.slice(prefixo.length + 1)
      const primeiraParte = sufixo.split('.')[0]
      return parseInt(primeiraParte, 10)
    })
    .filter((n) => !Number.isNaN(n))

  const proximo = filhos.length > 0 ? Math.max(...filhos) + 1 : 1
  return `${prefixo}.${proximo}`
}

export function codigoInicialSemPai(tipo: TipoPlanoFinanceiro, codigosExistentes: string[]): string {
  const raiz = raizDoTipo(tipo)
  const irmaos = codigosExistentes.filter((c) => {
    const partes = c.split('.')
    return partes.length === 2 && partes[0] === raiz
  })

  if (irmaos.length === 0) return `${raiz}.1`

  const numeros = irmaos.map((c) => parseInt(c.split('.')[1], 10)).filter((n) => !Number.isNaN(n))
  const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1
  return `${raiz}.${proximo}`
}
