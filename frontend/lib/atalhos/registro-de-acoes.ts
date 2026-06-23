import type { ChaveDaAcao } from './tipos'

export type DefinicaoDeAcao = {
  chave: ChaveDaAcao
  rotulo: string
  descricao: string
  global?: boolean
}

export const REGISTRO_DE_ACOES: readonly DefinicaoDeAcao[] = [
  {
    chave: 'buscar',
    rotulo: 'Focar busca',
    descricao: 'Coloca o cursor no campo de busca da tela atual',
  },
  {
    chave: 'novo',
    rotulo: 'Novo cadastro',
    descricao: 'Abre o formulário de novo registro',
  },
  {
    chave: 'salvar',
    rotulo: 'Salvar',
    descricao: 'Salva o formulário aberto',
  },
  {
    chave: 'cancelar',
    rotulo: 'Cancelar / fechar',
    descricao: 'Fecha modal ou diálogo aberto',
  },
  {
    chave: 'atualizar',
    rotulo: 'Atualizar lista',
    descricao: 'Recarrega os dados da tela atual',
  },
  {
    chave: 'exportar',
    rotulo: 'Exportar CSV',
    descricao: 'Exporta a lista atual para CSV',
  },
  {
    chave: 'ajuda',
    rotulo: 'Mostrar atalhos',
    descricao: 'Exibe o painel de atalhos disponíveis',
    global: true,
  },
] as const

export function rotuloDaAcao(chave: ChaveDaAcao): string {
  return REGISTRO_DE_ACOES.find((a) => a.chave === chave)?.rotulo ?? chave
}
