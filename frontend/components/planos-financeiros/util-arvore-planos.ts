import type { PlanoFinanceiroNo } from './arvore-planos-financeiros'

/** 0 = grupo, 1 = subgrupo. Não exibir níveis abaixo disso. */
export const NIVEL_MAXIMO_PLANO = 1

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
    const podeExpandir = nivel < NIVEL_MAXIMO_PLANO && filhos.length > 0
    lista.push({ ...no, nivel, temFilhos: podeExpandir })
    if (podeExpandir) {
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

/** Só grupos de 1º nível (nivel 0) podem ter subgrupos. */
export function podeReceberSubgrupo(plano: Pick<PlanoComNivel, 'nivel'>): boolean {
  return plano.nivel === 0
}
