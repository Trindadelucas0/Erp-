export const CHAVES_DE_ACAO = [
  'buscar',
  'novo',
  'salvar',
  'cancelar',
  'atualizar',
  'exportar',
  'ajuda',
] as const

export type ChaveDaAcao = (typeof CHAVES_DE_ACAO)[number]

export type AtalhoConfigurado = {
  acao: ChaveDaAcao
  tecla: string
  ativo: boolean
}

export type HandlersDeAtalhos = Partial<Record<ChaveDaAcao, () => void>>

export type CondicoesDeAtalhos = Partial<Record<ChaveDaAcao, boolean>>
