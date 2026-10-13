export type TotaisConciliacao = {
  totalExtrato: number
  conciliado: number
  pendente: number
  naoIdentificado: number
  quantidadeExtrato: number
  quantidadeConciliada: number
  quantidadePendente: number
  quantidadeNaoIdentificada: number
}

export type LinhaExtrato = {
  id: string
  data: string
  historico: string
  documento: string | null
  valor: number
  conciliacaoId: string | null
  status: 'conciliado' | 'pendente' | 'nao_identificado'
}

export type MovimentoSistema = {
  id: string
  origem: 'pagar' | 'receber'
  data: string
  documento: string | null
  descricao: string
  pessoa: string | null
  valor: number
  conciliacaoId: string | null
  status: 'conciliado' | 'pendente' | 'nao_encontrado'
}

export type ConsultaConciliacaoResposta = {
  totais: TotaisConciliacao
  extrato: { linhas: LinhaExtrato[]; pagina: number; total: number }
  sistema: { linhas: MovimentoSistema[]; pagina: number; total: number }
  sugestoes: Array<{ linhaId: string; baixaId: string; origem: 'pagar' | 'receber' }>
}

export const ROTULOS_STATUS: Record<string, string> = {
  conciliado: 'Conciliado',
  pendente: 'Pendente',
  nao_identificado: 'Não identificado',
  nao_encontrado: 'Não encontrado',
}

export function dataHojeIso() {
  return new Date().toISOString().slice(0, 10)
}

export function dataInicioMesIso() {
  const hoje = new Date()
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
}

export function formatarDataBr(data: string) {
  return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}
