import { z } from 'zod'

const percentualOpcional = z.preprocess((valor) => {
  if (valor === '' || valor === undefined || valor === null) return null
  return valor
}, z.coerce.number({ invalid_type_error: 'Percentual inválido' }).finite('Percentual inválido').min(0, 'Percentual deve ser entre 0 e 100').max(100, 'Percentual deve ser entre 0 e 100').nullable())

const diasValidadeOrcamento = z.preprocess((valor) => {
  if (valor === '' || valor === undefined || valor === null) return 14
  return valor
}, z.coerce
  .number({ invalid_type_error: 'Validade do orçamento inválida' })
  .int('Validade do orçamento deve ser um número inteiro')
  .min(1, 'Validade do orçamento deve ser de pelo menos 1 dia')
  .max(3650, 'Validade do orçamento deve ser de no máximo 3650 dias'))

export const esquemaGravarParametrizacaoCustos = z.object({
  pis: percentualOpcional,
  cofins: percentualOpcional,
  impRendaSupSimples: percentualOpcional,
  contribuicaoSocial: percentualOpcional,
  custoFixo: percentualOpcional,
  comissao: percentualOpcional,
  jurosMensaisCustoFinanOperac: percentualOpcional,
  aliquotaCbs: percentualOpcional,
  aliquotaIbs: percentualOpcional,
  validadeOrcamentoDias: diasValidadeOrcamento,
})

export type DadosParametrizacaoCustos = z.infer<typeof esquemaGravarParametrizacaoCustos>

const CAMPOS_TOTAL_VENDA = [
  'pis',
  'cofins',
  'impRendaSupSimples',
  'contribuicaoSocial',
  'custoFixo',
  'comissao',
] as const

export function somarTotalVenda(
  dados: Pick<DadosParametrizacaoCustos, (typeof CAMPOS_TOTAL_VENDA)[number]>
): number {
  let soma = 0
  for (const campo of CAMPOS_TOTAL_VENDA) {
    const valor = dados[campo]
    if (valor != null && Number.isFinite(valor)) soma += valor
  }
  return soma
}
