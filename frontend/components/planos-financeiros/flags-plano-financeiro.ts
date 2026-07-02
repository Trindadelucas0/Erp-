export type ChaveFlagPlano =
  | 'mostrarNaDre'
  | 'permiteLancamentoManual'
  | 'exigeAnexoLancamento'
  | 'permiteUsoConsumo'

export type LinhaComFlagsPlano = Record<ChaveFlagPlano, boolean | undefined>

export const COLUNAS_FLAGS_PLANO: {
  chave: ChaveFlagPlano
  rotulo: string
  titulo: string
}[] = [
  { chave: 'mostrarNaDre', rotulo: 'DRE', titulo: 'Mostrar na DRE' },
  {
    chave: 'permiteLancamentoManual',
    rotulo: 'Permite manual',
    titulo: 'Permite lançamento manual',
  },
  {
    chave: 'exigeAnexoLancamento',
    rotulo: 'Exige anexo',
    titulo: 'Exige anexo no lançamento financeiro',
  },
  {
    chave: 'permiteUsoConsumo',
    rotulo: 'Autoriza uso e consumo',
    titulo: 'Autoriza uso e consumo',
  },
]

export function textoFlagSim(valor: boolean | undefined): string {
  return valor ? 'Sim' : ''
}
