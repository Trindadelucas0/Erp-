/**
 * Atalhos de teclado padrão do sistema (espelha frontend/lib/atalhos/atalhos-padrao.ts).
 */
export const ATALHOS_PADRAO = {
  buscar: 'F3',
  novo: 'F2',
  salvar: 'F8',
  cancelar: 'Escape',
  atualizar: 'F5',
  ajuda: 'F1',
} as const

export type ChaveDaAcaoAtalho = keyof typeof ATALHOS_PADRAO

export const CHAVES_DE_ACAO_ATALHO = Object.keys(
  ATALHOS_PADRAO
) as ChaveDaAcaoAtalho[]
