import { z } from 'zod'

export const TIPOS_CONTA_RECEBER = ['duplicata', 'credito'] as const

const dataIso = z
  .string()
  .trim()
  .min(1, 'Data obrigatória')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida')

const dinheiro = z.coerce.number().finite().min(0, 'Valor não pode ser negativo')

export const esquemaParcelaContaReceber = z.object({
  numeroDocumento: z.string().trim().max(60).nullable().optional(),
  vencimento: dataIso,
  valor: dinheiro.refine((v) => v > 0, 'Valor da parcela deve ser maior que zero'),
})

export const esquemaDeCriacaoDeContaReceber = z.object({
  tipo: z.enum(TIPOS_CONTA_RECEBER),
  pessoaId: z.string().uuid('Cliente inválido').nullable().optional(),
  planoFinanceiroId: z.string().uuid('Plano financeiro inválido').nullable().optional(),
  numeroDocumento: z.string().trim().max(60).nullable().optional(),
  dataEmissao: dataIso.nullable().optional(),
  valorTotal: dinheiro.refine((v) => v > 0, 'Valor do documento deve ser maior que zero'),
  valorDesconto: dinheiro.optional().default(0),
  valorJuros: dinheiro.optional().default(0),
  valorMulta: dinheiro.optional().default(0),
  valorComissao: dinheiro.optional().default(0),
  observacao: z.string().trim().max(2000).nullable().optional(),
  vencimento: dataIso,
})

export const esquemaDeEdicaoDeContaReceber = esquemaDeCriacaoDeContaReceber

export const ORIGENS_CONTA_RECEBER = ['manual'] as const

export const esquemaFiltroListagemContasReceber = z.object({
  pessoaId: z.string().uuid().optional(),
  planoFinanceiroId: z.string().uuid().optional(),
  tipo: z.enum(TIPOS_CONTA_RECEBER).optional(),
  origem: z.enum(ORIGENS_CONTA_RECEBER).optional(),
  codigo: z.string().trim().max(40).optional(),
  numeroDocumento: z.string().trim().max(60).optional(),
  vencimentoDe: z.string().trim().optional(),
  vencimentoAte: z.string().trim().optional(),
  valorMin: z.coerce.number().finite().optional(),
  valorMax: z.coerce.number().finite().optional(),
  status: z.string().trim().optional(),
  q: z.string().trim().max(120).optional(),
})

export const esquemaItemBaixa = z.object({
  parcelaId: z.string().uuid('Parcela inválida'),
  valorPrincipal: dinheiro.refine((v) => v > 0, 'Valor principal deve ser maior que zero'),
  valorJuros: dinheiro.optional().default(0),
  valorMulta: dinheiro.optional().default(0),
  valorDesconto: dinheiro.optional().default(0),
  observacao: z.string().trim().max(500).nullable().optional(),
})

export const esquemaBaixaLote = z.object({
  pagoEm: dataIso.nullable().optional(),
  itens: z.array(esquemaItemBaixa).min(1, 'Selecione ao menos um título'),
})

export type DadosParaCriarContaReceber = z.infer<typeof esquemaDeCriacaoDeContaReceber>
export type DadosParaEditarContaReceber = z.infer<typeof esquemaDeEdicaoDeContaReceber>
export type FiltroListagemContasReceber = z.infer<typeof esquemaFiltroListagemContasReceber>
export const esquemaFiltroHistoricoBaixas = z.object({
  pessoaId: z.string().uuid().optional(),
  contaReceberId: z.string().uuid().optional(),
  pagoEmDe: z.string().trim().optional(),
  pagoEmAte: z.string().trim().optional(),
  q: z.string().trim().max(120).optional(),
})

export type FiltroHistoricoBaixas = z.infer<typeof esquemaFiltroHistoricoBaixas>
export type DadosBaixaLote = z.infer<typeof esquemaBaixaLote>

const MIME_ANEXO_CONTA = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const

/** ~2 MB em base64 (~2.7M chars). Validação fina no storage pelo buffer. */
export const esquemaUploadAnexoContaReceber = z.object({
  nomeArquivo: z.string().min(1, 'Nome do arquivo obrigatório').max(200),
  mimeType: z.enum(MIME_ANEXO_CONTA, {
    invalid_type_error: 'Tipo não permitido. Use PDF, JPG, PNG ou WEBP.',
  }),
  base64Arquivo: z
    .string()
    .min(50, 'Arquivo inválido')
    .max(3_500_000, 'Arquivo não pode ser superior a 2 MB'),
})

export type DadosUploadAnexoContaReceber = z.infer<typeof esquemaUploadAnexoContaReceber>
