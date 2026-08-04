/**
 * Tipos e helpers puros do ledger de estoque (Fase 1 — Kardex).
 */

export const DIMENSOES_ESTOQUE = ['fisico', 'fiscal', 'reserva', 'bloqueio'] as const
export type DimensaoEstoque = (typeof DIMENSOES_ESTOQUE)[number]

export const TIPOS_ESTOQUE_VISAO = ['disponivel', 'fisico', 'fiscal'] as const
export type TipoEstoqueVisao = (typeof TIPOS_ESTOQUE_VISAO)[number]

export type SaldosEstoque = {
  qtdFisica: number
  qtdReservada: number
  qtdBloqueada: number
  qtdFiscal: number
}

export function decimalParaNumero(valor: unknown): number {
  if (valor == null) return 0
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0
  return Number(valor)
}

export function arredondarQtd(valor: number): number {
  return Math.round(valor * 10000) / 10000
}

export function calcularQtdDisponivel(saldos: Pick<SaldosEstoque, 'qtdFisica' | 'qtdReservada' | 'qtdBloqueada'>): number {
  return arredondarQtd(saldos.qtdFisica - saldos.qtdReservada - saldos.qtdBloqueada)
}

export function saldosComDisponivel(saldos: SaldosEstoque) {
  return {
    ...saldos,
    qtdDisponivel: calcularQtdDisponivel(saldos),
  }
}

/** Delta na dimensão disponível causado por um movimento do ledger. */
export function deltaDisponivelDoMovimento(dimensao: DimensaoEstoque, quantidade: number): number {
  if (dimensao === 'fisico') return quantidade
  if (dimensao === 'reserva' || dimensao === 'bloqueio') return -quantidade
  return 0
}

export function aplicarDeltaNaDimensao(
  saldos: SaldosEstoque,
  dimensao: DimensaoEstoque,
  quantidade: number
): { saldosNovos: SaldosEstoque; saldoDepois: number } {
  const qtd = arredondarQtd(quantidade)
  const novos = { ...saldos }

  if (dimensao === 'fisico') {
    novos.qtdFisica = arredondarQtd(saldos.qtdFisica + qtd)
    return { saldosNovos: novos, saldoDepois: novos.qtdFisica }
  }
  if (dimensao === 'fiscal') {
    novos.qtdFiscal = arredondarQtd(saldos.qtdFiscal + qtd)
    return { saldosNovos: novos, saldoDepois: novos.qtdFiscal }
  }
  if (dimensao === 'reserva') {
    novos.qtdReservada = arredondarQtd(saldos.qtdReservada + qtd)
    return { saldosNovos: novos, saldoDepois: novos.qtdReservada }
  }
  novos.qtdBloqueada = arredondarQtd(saldos.qtdBloqueada + qtd)
  return { saldosNovos: novos, saldoDepois: novos.qtdBloqueada }
}

export function dimensaoEhValida(valor: string): valor is DimensaoEstoque {
  return (DIMENSOES_ESTOQUE as readonly string[]).includes(valor)
}

export function tipoEstoqueVisaoEhValido(valor: string): valor is TipoEstoqueVisao {
  return (TIPOS_ESTOQUE_VISAO as readonly string[]).includes(valor)
}

/** Dimensões que afetam a visão "Disponível" do kardex. */
export const DIMENSOES_VISAO_DISPONIVEL: DimensaoEstoque[] = ['fisico', 'reserva', 'bloqueio']

export const ROTULOS_TIPO_MOVIMENTO: Record<string, string> = {
  inventario: 'Inventário',
  entrada_nf: 'Entrada NF',
  saida_nf: 'Saída NF',
  conferencia_ok: 'Conferência',
  venda_reserva: 'Venda',
  venda_entrega: 'Entrega',
  bloqueio: 'Bloqueio',
  desbloqueio: 'Desbloqueio',
  estorno: 'Estorno',
  entrada: 'Entrada',
  saida: 'Saída',
  perda: 'Perda',
}

export function rotuloTipoMovimento(tipo: string): string {
  return ROTULOS_TIPO_MOVIMENTO[tipo] ?? tipo
}

export function rotuloDimensao(dimensao: string): string {
  if (dimensao === 'fisico') return 'estoque físico'
  if (dimensao === 'fiscal') return 'estoque fiscal'
  if (dimensao === 'reserva') return 'reserva'
  if (dimensao === 'bloqueio') return 'bloqueio'
  return dimensao
}

/** Frase de sistema para a coluna Ocorrência do kardex. */
export function montarOcorrencia(dados: {
  tipoMovimento: string
  dimensao: string
  origem: string
}): string {
  const tipo = rotuloTipoMovimento(dados.tipoMovimento)
  const dim = rotuloDimensao(dados.dimensao)
  if (dados.origem === 'inventario' || dados.tipoMovimento === 'inventario') {
    return `Ajuste de inventário (${dim})`
  }
  if (dados.tipoMovimento === 'entrada_nf') {
    return `Entrada por nota fiscal (${dim})`
  }
  if (dados.tipoMovimento === 'saida_nf') {
    return `Saída por nota fiscal (${dim})`
  }
  if (dados.tipoMovimento === 'conferencia_ok') {
    return `Conferência cega OK (${dim})`
  }
  return `${tipo} (${dim})`
}

export function documentoPessoa(pessoa: {
  cnpj?: string | null
  cpf?: string | null
}): string | null {
  const doc = pessoa.cnpj?.trim() || pessoa.cpf?.trim()
  return doc || null
}

export function nomeParceiro(pessoa: {
  nome: string
  nomeFantasia?: string | null
}): string {
  const fantasia = pessoa.nomeFantasia?.trim()
  if (fantasia && fantasia !== pessoa.nome) {
    return `${pessoa.nome} (${fantasia})`
  }
  return pessoa.nome
}
