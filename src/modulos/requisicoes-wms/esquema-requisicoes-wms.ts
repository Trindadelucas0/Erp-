import { z } from 'zod'
import { TIPOS_OPERACAO_REQUISICAO, STATUS_REQUISICAO } from './tipos-requisicao-wms.js'

const idOpcional = z
  .union([z.string().trim().min(1), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? v : null))

const quantidadeOpcional = z.preprocess((v) => {
  if (v === '' || v === undefined || v === null) return null
  return v
}, z.coerce.number().positive('Quantidade deve ser maior que zero').nullable().optional())

export const esquemaCorpoRequisicao = z.object({
  tipoOperacao: z.enum(TIPOS_OPERACAO_REQUISICAO, {
    errorMap: () => ({ message: 'Tipo de operação inválido' }),
  }),
  prioridade: z.coerce.number().int().min(1).max(4),
  origemEnderecoId: idOpcional,
  destinoEnderecoId: idOpcional,
  produtoId: idOpcional,
  quantidade: quantidadeOpcional,
  responsavelId: idOpcional,
  observacao: z
    .union([z.string().trim().max(2000), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
})

export const esquemaEdicaoRequisicao = esquemaCorpoRequisicao.partial()

export const esquemaAtribuir = z.object({
  usuarioId: z.string().trim().min(1, 'Informe o responsável'),
})

export const esquemaMotivo = z.object({
  motivo: z.string().trim().min(1, 'Informe o motivo').max(500),
})

export const esquemaConferir = z.object({
  etapa: z.enum(['origem', 'produto', 'quantidade', 'destino'], {
    errorMap: () => ({ message: 'Etapa de conferência inválida' }),
  }),
  valor: z.string().trim().min(1, 'Informe o valor conferido').max(120),
})

export const esquemaFiltroListagem = z.object({
  q: z.string().optional(),
  status: z.enum(STATUS_REQUISICAO).optional().or(z.literal('')),
  tipo: z.enum(TIPOS_OPERACAO_REQUISICAO).optional().or(z.literal('')),
  prioridade: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.coerce.number().int().min(1).max(4).optional()
  ),
  fila: z.enum(['minha', 'todas']).optional(),
  pagina: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? 1 : v),
    z.coerce.number().int().min(1).optional().default(1)
  ),
  limite: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? 50 : v),
    z.coerce.number().int().min(1).max(100).optional().default(50)
  ),
})

export type DadosCorpoRequisicao = z.infer<typeof esquemaCorpoRequisicao>
export type DadosEdicaoRequisicao = z.infer<typeof esquemaEdicaoRequisicao>
export type FiltroListagemRequisicao = z.infer<typeof esquemaFiltroListagem>
export type DadosConferirRequisicao = z.infer<typeof esquemaConferir>
