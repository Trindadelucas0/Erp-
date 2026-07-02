/**
 * Utilitários para códigos hierárquicos de planos financeiros (1.1, 2.3.1).
 */

export type TipoPlanoFinanceiro = 'receita' | 'despesa' | 'resultado'

export function raizDoTipo(tipo: TipoPlanoFinanceiro): string {
  if (tipo === 'receita') return '1'
  if (tipo === 'despesa') return '2'
  return '3'
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

export function codigoFilhoPorIndice(codigoPai: string, indice: number): string {
  return `${codigoPai}.${indice}`
}

export function codigoRaizPorIndice(tipo: TipoPlanoFinanceiro, indice: number): string {
  return `${raizDoTipo(tipo)}.${indice}`
}

export function substituirPrefixoCodigo(
  codigo: string,
  prefixoAntigo: string,
  prefixoNovo: string
): string {
  if (codigo === prefixoAntigo) return prefixoNovo
  const sufixoEsperado = `${prefixoAntigo}.`
  if (!codigo.startsWith(sufixoEsperado)) {
    throw new Error(`Código ${codigo} não pertence ao prefixo ${prefixoAntigo}`)
  }
  return prefixoNovo + codigo.slice(prefixoAntigo.length)
}

export type PlanoComParent = { id: string; parentId: string | null }

export function coletarDescendentes(
  planoId: string,
  planos: PlanoComParent[]
): string[] {
  const filhosPorPai = new Map<string, string[]>()
  for (const plano of planos) {
    if (!plano.parentId) continue
    const lista = filhosPorPai.get(plano.parentId) ?? []
    lista.push(plano.id)
    filhosPorPai.set(plano.parentId, lista)
  }

  const descendentes: string[] = []
  function visitar(id: string) {
    for (const filhoId of filhosPorPai.get(id) ?? []) {
      descendentes.push(filhoId)
      visitar(filhoId)
    }
  }
  visitar(planoId)
  return descendentes
}

export function ehDescendente(
  ancestralId: string,
  possivelDescendenteId: string,
  parentPorId: Map<string, string | null>
): boolean {
  let atual: string | null | undefined = parentPorId.get(possivelDescendenteId)
  while (atual) {
    if (atual === ancestralId) return true
    atual = parentPorId.get(atual) ?? null
  }
  return false
}
