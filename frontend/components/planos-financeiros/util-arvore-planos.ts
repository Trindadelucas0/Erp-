import type { PlanoFinanceiroNo } from './arvore-planos-financeiros'

export type PlanoComNivel = PlanoFinanceiroNo & {
  nivel: number
  temFilhos: boolean
}

export function achatarPlanosComNivel(
  nos: PlanoFinanceiroNo[],
  nivel = 0
): PlanoComNivel[] {
  const lista: PlanoComNivel[] = []
  for (const no of nos) {
    const filhos = no.filhos ?? []
    const temFilhos = filhos.length > 0
    lista.push({ ...no, nivel, temFilhos })
    if (temFilhos) {
      lista.push(...achatarPlanosComNivel(filhos, nivel + 1))
    }
  }
  return lista
}

export function buscarPlanoPorId(
  planos: PlanoComNivel[],
  id: string
): PlanoComNivel | undefined {
  return planos.find((p) => p.id === id)
}

export function buscarGrupoPai(
  planos: PlanoComNivel[],
  parentId: string | null
): PlanoComNivel | undefined {
  if (!parentId) return undefined
  return buscarPlanoPorId(planos, parentId)
}
