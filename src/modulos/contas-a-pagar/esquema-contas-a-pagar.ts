import { z } from 'zod'

export const TIPOS_CONTA_PAGAR = ['duplicata', 'tributos'] as const
export const TIPOS_TRIBUTO = ['darf_simples', 'darf_normal', 'gps'] as const

const dataIso = z
  .string()
  .trim()
  .min(1, 'Data obrigatória')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida')

const dinheiro = z.coerce.number().finite().min(0, 'Valor não pode ser negativo')

export const esquemaParcelaContaPagar = z.object({
  numeroDocumento: z.string().trim().max(60).nullable().optional(),
  vencimento: dataIso,
  valor: dinheiro.refine((v) => v > 0, 'Valor da parcela deve ser maior que zero'),
})

export const esquemaDeCriacaoDeContaPagar = z
  .object({
    tipo: z.enum(TIPOS_CONTA_PAGAR),
    tipoTributo: z.enum(TIPOS_TRIBUTO).nullable().optional(),
    codigoReceita: z.string().trim().max(40).nullable().optional(),
    numeroReferencia: z.string().trim().max(60).nullable().optional(),
    pessoaId: z.string().uuid('Fornecedor inválido').nullable().optional(),
    planoFinanceiroId: z.string().uuid('Plano financeiro inválido').nullable().optional(),
    numeroDocumento: z.string().trim().max(60).nullable().optional(),
    dataEmissao: dataIso.nullable().optional(),
    valorTotal: dinheiro.refine((v) => v > 0, 'Valor do documento deve ser maior que zero'),
    valorDesconto: dinheiro.optional().default(0),
    valorJuros: dinheiro.optional().default(0),
    valorMulta: dinheiro.optional().default(0),
    valorImpostoRetido: dinheiro.optional().default(0),
    observacao: z.string().trim().max(2000).nullable().optional(),
    vencimento: dataIso,
  })
  .superRefine((dados, ctx) => {
    if (dados.tipo === 'tributos') {
      if (!dados.tipoTributo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tipoTributo'],
          message: 'Tipo de tributo é obrigatório quando o tipo é Tributos',
        })
      }
    } else if (dados.tipoTributo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tipoTributo'],
        message: 'Tipo de tributo só se aplica a Tributos',
      })
    }
  })

export const esquemaDeEdicaoDeContaPagar = esquemaDeCriacaoDeContaPagar

export const ORIGENS_CONTA_PAGAR = ['manual', 'nfe', 'cte'] as const

export const esquemaFiltroListagemContasPagar = z.object({
  pessoaId: z.string().uuid().optional(),
  planoFinanceiroId: z.string().uuid().optional(),
  tipo: z.enum(TIPOS_CONTA_PAGAR).optional(),
  origem: z.enum(ORIGENS_CONTA_PAGAR).optional(),
  nfeRecebidaId: z.string().uuid().optional(),
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

export type DadosParaCriarContaPagar = z.infer<typeof esquemaDeCriacaoDeContaPagar>
export type DadosParaEditarContaPagar = z.infer<typeof esquemaDeEdicaoDeContaPagar>
export type FiltroListagemContasPagar = z.infer<typeof esquemaFiltroListagemContasPagar>
export const esquemaFiltroHistoricoBaixas = z.object({
  pessoaId: z.string().uuid().optional(),
  contaPagarId: z.string().uuid().optional(),
  nfeRecebidaId: z.string().uuid().optional(),
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
export const esquemaUploadAnexoContaPagar = z.object({
  nomeArquivo: z.string().min(1, 'Nome do arquivo obrigatório').max(200),
  mimeType: z.enum(MIME_ANEXO_CONTA, {
    invalid_type_error: 'Tipo não permitido. Use PDF, JPG, PNG ou WEBP.',
  }),
  base64Arquivo: z
    .string()
    .min(50, 'Arquivo inválido')
    .max(3_500_000, 'Arquivo não pode ser superior a 2 MB'),
})

export type DadosUploadAnexoContaPagar = z.infer<typeof esquemaUploadAnexoContaPagar>
