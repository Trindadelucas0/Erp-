/**
 * Match puro de recorrência financeira (fornecedor + valor exato em centavos).
 * Fonte: DOCUMENTACAO-SISTEMA.md §7 (recorrência).
 */

export type RecorrenciaParaMatch = {
  id: string
  valor: number
}

export type ResultadoCasamentoRecorrencia =
  | { status: 'sem_recorrencia' }
  | { status: 'casou'; recorrencia: RecorrenciaParaMatch }
  | {
      status: 'valor_divergente'
      esperados: Array<{ id: string; valor: number }>
      valorNota: number
    }

export function valorEmCentavos(valor: number): number {
  return Math.round(Number(valor) * 100)
}

export function valoresIguaisEmCentavos(a: number, b: number): boolean {
  return valorEmCentavos(a) === valorEmCentavos(b)
}

/**
 * Casa a nota com uma recorrência ativa do fornecedor.
 * - Sem recorrências ativas → sem_recorrencia (fluxo normal).
 * - Valor igual a alguma → casou.
 * - Há recorrências mas nenhuma com o valor → valor_divergente (bloqueia auto-lançamento).
 */
export function casarRecorrencia(input: {
  fornecedorPessoaId: string | null | undefined
  valorTotal: number | null | undefined
  recorrenciasAtivas: RecorrenciaParaMatch[]
}): ResultadoCasamentoRecorrencia {
  if (!input.fornecedorPessoaId) return { status: 'sem_recorrencia' }
  if (!input.recorrenciasAtivas.length) return { status: 'sem_recorrencia' }

  const valorNota = Number(input.valorTotal ?? 0)
  if (!(valorNota > 0) || !Number.isFinite(valorNota)) {
    return {
      status: 'valor_divergente',
      esperados: input.recorrenciasAtivas.map((r) => ({
        id: r.id,
        valor: r.valor,
      })),
      valorNota,
    }
  }

  const casada = input.recorrenciasAtivas.find((r) =>
    valoresIguaisEmCentavos(r.valor, valorNota)
  )
  if (casada) {
    return { status: 'casou', recorrencia: casada }
  }

  return {
    status: 'valor_divergente',
    esperados: input.recorrenciasAtivas.map((r) => ({
      id: r.id,
      valor: r.valor,
    })),
    valorNota,
  }
}

export function formatarMoedaBr(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function mensagemValorDivergenteRecorrencia(
  valorNota: number,
  esperados: Array<{ valor: number }>
): string {
  const lista = esperados.map((e) => formatarMoedaBr(e.valor)).join('; ')
  return `Recorrência: valor da nota (${formatarMoedaBr(valorNota)}) não confere com o cadastrado (${lista}). Confira a nota ou a regra em Configurações → Financeiro → Recorrência.`
}
