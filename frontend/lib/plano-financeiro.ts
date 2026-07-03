export const MSG_PLANO_SOMENTE_DESPESA = 'Só é permitido plano da aba Despesas'
export const MSG_PLANO_SOMENTE_SUBGRUPO =
  'Só é permitido subgrupo de Despesas (ex.: 2.1.1)'

export const SUFIXO_CODIGO_MIN = 1
export const SUFIXO_CODIGO_MAX = 99
export const MSG_SUFIXO_INVALIDO = 'Informe um número de 1 a 99'

export type TipoPlanoFinanceiro = 'receita' | 'despesa' | 'resultado'

export type PlanoCatalogo = {
  codigo: string
  tipo?: string
}

function raizDoTipo(tipo: TipoPlanoFinanceiro): string {
  if (tipo === 'receita') return '1'
  if (tipo === 'despesa') return '2'
  return '3'
}

export function raizCodigoPlano(codigo: string): string | null {
  const match = codigo.trim().match(/^(\d)/)
  return match ? match[1] : null
}

export function prefixoParaNovoPlano(
  tipo: TipoPlanoFinanceiro,
  codigoPai?: string | null
): string {
  if (codigoPai) return `${codigoPai}.`
  return `${raizDoTipo(tipo)}.`
}

export function montarCodigoComSufixo(prefixo: string, sufixo: number): string {
  const base = prefixo.endsWith('.') ? prefixo.slice(0, -1) : prefixo
  return `${base}.${sufixo}`
}

export function sufixoCodigoValido(sufixo: number): boolean {
  return (
    Number.isInteger(sufixo) &&
    sufixo >= SUFIXO_CODIGO_MIN &&
    sufixo <= SUFIXO_CODIGO_MAX
  )
}

export function validarSufixoInformado(valor: string): string | null {
  const texto = valor.trim()
  if (!texto) return MSG_SUFIXO_INVALIDO

  const numero = Number(texto)
  if (!sufixoCodigoValido(numero)) return MSG_SUFIXO_INVALIDO

  return null
}

export function codigoPlanoJaExiste(codigo: string, codigosExistentes: string[]): boolean {
  return codigosExistentes.includes(codigo)
}

export function mensagemCodigoDuplicado(codigo: string): string {
  return `O código ${codigo} já está em uso nesta empresa`
}

export function planoEhSubgrupo(plano: PlanoCatalogo): boolean {
  return plano.codigo.trim().split('.').length >= 3
}

/** Plano da aba Despesas: tipo despesa ou código iniciando em 2. */
export function planoEhDespesa(plano: PlanoCatalogo): boolean {
  if (plano.tipo) return plano.tipo === 'despesa'
  return raizCodigoPlano(plano.codigo) === '2'
}
