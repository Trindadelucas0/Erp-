import type { AtalhoConfigurado, ChaveDaAcao } from './tipos'

export const ATALHOS_PADRAO: Record<ChaveDaAcao, string> = {
  buscar: 'F3',
  novo: 'F2',
  salvar: 'F8',
  cancelar: 'Escape',
  atualizar: 'F5',
  exportar: 'Ctrl+E',
  ajuda: 'F1',
}

export const TECLAS_COM_CONFLITO_NAVEGADOR = [
  'F5',
  'Ctrl+R',
  'Ctrl+S',
  'Ctrl+E',
  'Ctrl+P',
] as const

export function montarAtalhosPadrao(): AtalhoConfigurado[] {
  return (Object.entries(ATALHOS_PADRAO) as [ChaveDaAcao, string][]).map(
    ([acao, tecla]) => ({
      acao,
      tecla,
      ativo: true,
    })
  )
}

export function teclaTemConflitoNavegador(tecla: string): boolean {
  return TECLAS_COM_CONFLITO_NAVEGADOR.includes(
    tecla as (typeof TECLAS_COM_CONFLITO_NAVEGADOR)[number]
  )
}
