/**
 * Esquemas Zod — Entrada de Notas / pipeline.
 */
import { z } from 'zod'

export const esquemaVincularItem = z.object({
  itemId: z.string().uuid(),
  produtoId: z.string().uuid(),
})

export const esquemaGravarCodigoOriginal = z.object({
  itemId: z.string().uuid(),
})

export const esquemaDesvincularItem = z.object({
  itemId: z.string().uuid(),
})

export const esquemaVoltarEtapa = z.object({
  etapaDestino: z.enum(['cadastro', 'fiscal', 'negociacao', 'frete']),
})

/** Body opcional de POST /analisar — `pararEm` para avançar uma etapa sem completar o pipeline. */
export const esquemaAnalisar = z.object({
  forcarReparseItens: z.boolean().optional(),
  pararEm: z.enum(['frete', 'cadastro', 'fiscal', 'negociacao']).optional(),
})

export const esquemaImportarFiscal = z.object({
  itemId: z.string().uuid(),
  ncm: z.boolean().optional(),
  origem: z.boolean().optional(),
})

export const esquemaDefinirCfopEntrada = z.object({
  itemId: z.string().uuid(),
  cfopId: z.string().uuid(),
})

/** CFOP de entrada do documento CT-e (aba Frete/CT-e). */
export const esquemaDefinirCfopEntradaCte = z.object({
  cfopId: z.string().uuid(),
})

export const esquemaContatoFornecedor = z.object({
  observacao: z.string().min(1, 'Informe a observação do contato'),
})

export const esquemaDefinirPedido = z.object({
  pedidoCompraId: z.string().uuid(),
})

export const esquemaDefinirPrazo = z.object({
  prazo: z.string().min(1, 'Informe o prazo'),
})

export const esquemaManifestar = z.object({
  tipo: z.enum(['desconhecimento', 'nao_realizada']),
  justificativa: z.string().optional(),
})

export const esquemaMarcarProblema = z.object({
  motivo: z.string().optional(),
})

export const esquemaTratativa = z.object({
  texto: z.string().min(1, 'Informe a tratativa'),
})

export const esquemaResolverProblema = z.object({
  desfecho: z.enum(['solucao']),
})

/** Resolver divergência de contagem — senha + ressalva assinada obrigatórios (§7.17). */
export const esquemaResolverDivergencia = z.object({
  senha: z.string().min(1, 'Senha de gerente obrigatória'),
  anexo: z.object({
    mimeType: z.string().min(1, 'Tipo do arquivo obrigatório'),
    base64Arquivo: z.string().min(1, 'Arquivo obrigatório'),
    nomeArquivo: z.string().min(1, 'Nome do arquivo obrigatório'),
  }),
})

export const esquemaLancar = z.object({
  modo: z.enum(['contagem', 'consolidar']),
  senha: z.string().optional(),
})

/** Liberar críticas exige senha de gerente (doc Entrada de Notas). */
export const esquemaLiberarCriticas = z.object({
  senha: z.string().min(1, 'Senha de gerente obrigatória para liberar críticas'),
})

export const esquemaVincularCte = z
  .object({
    chaveCte: z.string().min(44).optional(),
    cteId: z.string().uuid().optional(),
  })
  .refine((d) => Boolean(d.chaveCte || d.cteId), {
    message: 'Informe a chave do CT-e ou o id',
  })

/** Uma duplicata/parcela da prévia financeira do frete. */
export const esquemaParcelaFinanceiroFrete = z.object({
  numeroDocumento: z.string().max(60).nullable().optional(),
  vencimento: z.string().min(1, 'Data de vencimento obrigatória'),
  valor: z.number().finite().nonnegative(),
})

/** Stub financeiro frete (prévia) — ContaPagar é gerada no liberar/consolidar. */
export const esquemaFinanceiroFrete = z
  .object({
    cteId: z.string().uuid().optional(),
    /** Formato novo: N duplicatas. */
    parcelas: z.array(esquemaParcelaFinanceiroFrete).min(1).optional(),
    /** Formato antigo (1 parcela) — fallback. */
    numeroDocumento: z.string().max(60).nullable().optional(),
    vencimento: z.string().min(1, 'Data de vencimento obrigatória').nullable().optional(),
    valor: z.number().finite().nonnegative().optional(),
  })
  .refine(
    (d) =>
      (d.parcelas != null && d.parcelas.length > 0) ||
      (d.valor != null && Number.isFinite(d.valor)),
    { message: 'Informe ao menos uma parcela ou o valor' }
  )
  .refine(
    (d) => {
      if (d.parcelas != null && d.parcelas.length > 0) return true
      return Boolean(d.vencimento?.trim())
    },
    { message: 'Informe a data de vencimento de cada parcela', path: ['vencimento'] }
  )
