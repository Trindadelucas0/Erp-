export const MSG_PLANO_SOMENTE_DESPESA = 'Só é permitido plano da aba Despesas'
export const MSG_PLANO_SOMENTE_SUBGRUPO =
  'Só é permitido subgrupo de Despesas (ex.: 2.1.1)'

export type PlanoCatalogo = {
  codigo: string
  tipo?: string
}

export function raizCodigoPlano(codigo: string): string | null {
  const match = codigo.trim().match(/^(\d)/)
  return match ? match[1] : null
}

export function planoEhSubgrupo(plano: PlanoCatalogo): boolean {
  return plano.codigo.trim().split('.').length >= 3
}

/** Plano da aba Despesas: tipo despesa ou código iniciando em 2. */
export function planoEhDespesa(plano: PlanoCatalogo): boolean {
  if (plano.tipo) return plano.tipo === 'despesa'
  return raizCodigoPlano(plano.codigo) === '2'
}
