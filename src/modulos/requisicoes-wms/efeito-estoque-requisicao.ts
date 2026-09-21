import { arredondarQtd } from '../estoque/tipos-estoque.js'
import type { TipoOperacaoRequisicao } from './tipos-requisicao-wms.js'

export const ETAPAS_CONFERENCIA = ['origem', 'produto', 'quantidade', 'destino'] as const
export type EtapaConferencia = (typeof ETAPAS_CONFERENCIA)[number]

export const ORIGEM_MOVIMENTO_REQUISICAO = 'requisicao_wms'
export const TIPO_MOV_RESERVA = 'requisicao_reserva'
export const TIPO_MOV_SAIDA = 'requisicao_saida'
export const TIPO_MOV_ESTORNO = 'requisicao_estorno'

/** Ordem obrigatória no concluir Separação (mesmo tx). */
export const ORDEM_MOVIMENTOS_CONCLUIR = ['estornoReserva', 'saida'] as const

export function tipoMoveKardexSeparacao(tipoOperacao: string): boolean {
  return tipoOperacao === 'separacao'
}

export function barrasArmazenagemDoProduto(params: {
  codigoBarras?: string | null
  embalagensMaster?: Array<{ codigoBarras?: string | null }>
}): string[] {
  const barras: string[] = []
  const ean = params.codigoBarras?.trim()
  if (ean) barras.push(ean)
  for (const emb of params.embalagensMaster ?? []) {
    const c = emb.codigoBarras?.trim()
    if (c) barras.push(c)
  }
  return barras
}

export function produtoTemBarrasArmazenagem(params: {
  codigoBarras?: string | null
  embalagensMaster?: Array<{ codigoBarras?: string | null }>
}): boolean {
  return barrasArmazenagemDoProduto(params).length > 0
}

/** Conferência de Guardar: só EAN-13 (produto) e DUN-14 (master). Não aceita SKU. */
export function produtoConfereBarrasArmazenagem(params: {
  codigoBarras: string | null | undefined
  barrasMaster: string[]
  informado: string
}): boolean {
  const inf = params.informado.trim()
  if (!inf) return false
  if (
    produtoConfere({
      sku: null,
      codigoBarras: params.codigoBarras,
      gtin: null,
      informado: inf,
    })
  ) {
    return true
  }
  return params.barrasMaster.some((c) =>
    produtoConfere({ sku: null, codigoBarras: c, gtin: null, informado: inf })
  )
}

export function chavesIdempotenciaEstoque(requisicaoId: string) {
  return {
    reserva: `reqwms:${requisicaoId}:reserva`,
    estornoReserva: `reqwms:${requisicaoId}:reserva:estorno`,
    saida: `reqwms:${requisicaoId}:saida`,
  }
}

export type CamposOsConferencia = {
  tipoOperacao: string
  origemEnderecoId: string | null
  destinoEnderecoId: string | null
  produtoId: string | null
  quantidade: number | null
}

export function passosExigidos(os: CamposOsConferencia): EtapaConferencia[] {
  const tipo = os.tipoOperacao as TipoOperacaoRequisicao | string
  if (tipo === 'contagem_entrada') return []
  if (tipo === 'armazenagem') return ['produto', 'destino']
  const temOrigem = Boolean(os.origemEnderecoId)
  const temDestino = Boolean(os.destinoEnderecoId)
  const temProduto = Boolean(os.produtoId)
  const temQtd = os.quantidade != null && os.quantidade > 0

  if (tipo === 'separacao') {
    const passos: EtapaConferencia[] = []
    if (temOrigem) passos.push('origem')
    passos.push('produto', 'quantidade')
    if (temDestino) passos.push('destino')
    return passos
  }
  if (tipo === 'reposicao') {
    return ['origem', 'produto', 'quantidade', 'destino']
  }
  if (tipo === 'movimentacao') {
    const passos: EtapaConferencia[] = ['origem']
    if (temProduto) passos.push('produto')
    if (temQtd) passos.push('quantidade')
    passos.push('destino')
    return passos
  }
  if (tipo === 'limpeza') {
    return temOrigem ? ['origem'] : []
  }

  const passos: EtapaConferencia[] = []
  if (temOrigem) passos.push('origem')
  if (temProduto) passos.push('produto')
  if (temQtd) passos.push('quantidade')
  if (temDestino) passos.push('destino')
  return passos
}

export type FlagsConferido = {
  conferidoOrigemEm: Date | string | null
  conferidoProdutoEm: Date | string | null
  conferidoDestinoEm: Date | string | null
  qtdExecutada: number | null
}

export function conferenciaCompleta(os: CamposOsConferencia, flags: FlagsConferido): boolean {
  const exigidos = passosExigidos(os)
  return exigidos.every((passo) => {
    if (passo === 'origem') return Boolean(flags.conferidoOrigemEm)
    if (passo === 'produto') return Boolean(flags.conferidoProdutoEm)
    if (passo === 'destino') return Boolean(flags.conferidoDestinoEm)
    return flags.qtdExecutada != null
  })
}

export function normalizarCodigoConferencia(valor: string): string {
  return valor.trim().toUpperCase().replace(/\s+/g, '')
}

export function enderecoConfere(esperado: string | null | undefined, informado: string): boolean {
  if (!esperado?.trim()) return false
  return normalizarCodigoConferencia(esperado) === normalizarCodigoConferencia(informado)
}

function skuEquivale(sku: string, informado: string): boolean {
  const a = sku.trim().toLowerCase()
  const b = informado.trim().toLowerCase()
  if (!a || !b) return false
  if (a === b) return true
  return a.replace(/\./g, '') === b.replace(/\./g, '')
}

export function produtoConfere(params: {
  sku: string | null | undefined
  codigoBarras: string | null | undefined
  gtin: string | null | undefined
  informado: string
}): boolean {
  const inf = params.informado.trim()
  if (!inf) return false
  const infCod = normalizarCodigoConferencia(inf)
  if (params.codigoBarras?.trim()) {
    if (normalizarCodigoConferencia(params.codigoBarras) === infCod) return true
  }
  if (params.gtin?.trim()) {
    if (normalizarCodigoConferencia(params.gtin) === infCod) return true
  }
  if (params.sku?.trim() && skuEquivale(params.sku, inf)) return true
  return false
}

export function quantidadeConfere(esperada: number, informada: number): boolean {
  if (!Number.isFinite(esperada) || !Number.isFinite(informada)) return false
  return arredondarQtd(esperada) === arredondarQtd(informada)
}

export function etapaEhValida(valor: string): valor is EtapaConferencia {
  return (ETAPAS_CONFERENCIA as readonly string[]).includes(valor)
}
