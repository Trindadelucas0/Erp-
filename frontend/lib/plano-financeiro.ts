export const MSG_PLANO_SOMENTE_DESPESA = 'Só é permitido plano da aba Despesas'

export type PlanoCatalogo = {
  codigo: string
  tipo?: string
}

export function raizCodigoPlano(codigo: string): string | null {
  const match = codigo.trim().match(/^(\d)/)
  return match ? match[1] : null
}

/** Plano da aba Despesas: tipo despesa ou código iniciando em 2. */
export function planoEhDespesa(plano: PlanoCatalogo): boolean {
  if (plano.tipo) return plano.tipo === 'despesa'
  return raizCodigoPlano(plano.codigo) === '2'
}
