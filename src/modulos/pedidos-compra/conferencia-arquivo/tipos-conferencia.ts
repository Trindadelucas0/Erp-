/**
 * Contrato da extração via IA e do relatório de conferência arquivo × pedido.
 * Espelha o schema fechado em integração ia.md, calibrado nos documentos reais
 * de fornecedor (Resicolor, Policorda, WEG/Esatta).
 */
import { z } from 'zod'

export const esquemaCabecalhoExtraido = z.object({
  fornecedorNome: z.string().nullable().default(null),
  fornecedorCnpj: z.string().nullable().default(null),
  numeroDocumentoFornecedor: z.string().nullable().default(null),
  dataEmissao: z.string().nullable().default(null),
  condicaoPagamento: z.string().nullable().default(null),
  prazoEntregaDias: z.number().nullable().default(null),
  modalidadeTransporte: z.string().nullable().default(null),
  valorTotalGeral: z.number().nullable().default(null),
})

export const esquemaItemExtraido = z.object({
  codigo: z.string().nullable().default(null),
  codigoBarras: z.string().nullable().default(null),
  ncm: z.string().nullable().default(null),
  descricao: z.string().default(''),
  unidade: z.string().nullable().default(null),
  quantidade: z.number(),
  precoUnitario: z.number(),
  precoUnitarioComImposto: z.number().nullable().default(null),
  valorTotalItem: z.number().nullable().default(null),
})

export const esquemaRespostaExtracaoArquivo = z.object({
  cabecalho: esquemaCabecalhoExtraido,
  itens: z.array(esquemaItemExtraido),
  avisos: z.array(z.string()).default([]),
})

export type CabecalhoExtraido = z.infer<typeof esquemaCabecalhoExtraido>
export type ItemExtraido = z.infer<typeof esquemaItemExtraido>
export type RespostaExtracaoArquivo = z.infer<typeof esquemaRespostaExtracaoArquivo>

export type SeveridadeDivergencia = 'alta' | 'media' | 'baixa'

export type DivergenciaCampo = {
  campo: string
  esperado: string
  encontrado: string
  severidade: SeveridadeDivergencia
}

export type MetodoMatch = 'codigo_barras' | 'codigo_original' | 'nome_preco' | 'nenhum'

export type StatusLinhaConferencia = 'ok' | 'divergente' | 'sem_match_pedido' | 'sobra_arquivo'

export type ItemPedidoParaMatch = {
  produtoId: string
  sku: string | null
  nome: string
  codigoOriginal: string | null
  codigoBarras: string | null
  quantidade: number
  precoUnitario: number
  unidade: string
  fotoUrl: string | null
}

export type LinhaResultadoConferencia = {
  status: StatusLinhaConferencia
  metodoMatch: MetodoMatch
  confianca: number
  pedido?: ItemPedidoParaMatch
  arquivo?: ItemExtraido
  divergencias: DivergenciaCampo[]
}

export type StatusGeralConferencia = 'ok' | 'divergencias' | 'falha_extracao'

export type RelatorioConferenciaArquivo = {
  statusGeral: StatusGeralConferencia
  provider: string
  modelo: string
  resumo: {
    totalItensPedido: number
    totalItensArquivo: number
    ok: number
    divergentes: number
    semMatch: number
    sobrasArquivo: number
  }
  cabecalho: {
    divergencias: DivergenciaCampo[]
  }
  linhas: LinhaResultadoConferencia[]
  avisos: string[]
}

/**
 * Espelham o relatório de conferência (tipos acima) em zod — usados para
 * validar o relatório quando ele volta no body de "Solicitar ajuste"
 * (o front já tem o relatório em memória, gerado pela chamada anterior a
 * /conferir-ia, e reenvia para o backend persistir e depois gerar o PDF
 * exibido no portal do fornecedor).
 */
export const esquemaDivergenciaCampo = z.object({
  campo: z.string(),
  esperado: z.string(),
  encontrado: z.string(),
  severidade: z.enum(['alta', 'media', 'baixa']),
})

export const esquemaItemPedidoParaMatch = z.object({
  produtoId: z.string(),
  sku: z.string().nullable(),
  nome: z.string(),
  codigoOriginal: z.string().nullable(),
  codigoBarras: z.string().nullable(),
  quantidade: z.number(),
  precoUnitario: z.number(),
  unidade: z.string(),
  fotoUrl: z.string().nullable().default(null),
})

export const esquemaLinhaResultadoConferencia = z.object({
  status: z.enum(['ok', 'divergente', 'sem_match_pedido', 'sobra_arquivo']),
  metodoMatch: z.enum(['codigo_barras', 'codigo_original', 'nome_preco', 'nenhum']),
  confianca: z.number(),
  pedido: esquemaItemPedidoParaMatch.optional(),
  arquivo: esquemaItemExtraido.optional(),
  divergencias: z.array(esquemaDivergenciaCampo),
})

export const esquemaRelatorioConferenciaArquivo = z.object({
  statusGeral: z.enum(['ok', 'divergencias', 'falha_extracao']),
  provider: z.string(),
  modelo: z.string(),
  resumo: z.object({
    totalItensPedido: z.number(),
    totalItensArquivo: z.number(),
    ok: z.number(),
    divergentes: z.number(),
    semMatch: z.number(),
    sobrasArquivo: z.number(),
  }),
  cabecalho: z.object({ divergencias: z.array(esquemaDivergenciaCampo) }),
  linhas: z.array(esquemaLinhaResultadoConferencia),
  avisos: z.array(z.string()),
})
