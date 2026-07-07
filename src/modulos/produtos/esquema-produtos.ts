/**
 * Validação dos dados de produto com Zod.
 */
import { z } from 'zod'
import {
  textoCadastroObrigatorio,
  textoCadastroOpcional,
} from '../../compartilhado/normalizacao/esquema-texto-cadastro.js'
import {
  codigoBarrasGtinValido,
  MENSAGEM_CODIGO_BARRAS_INVALIDO,
  normalizarCodigoBarrasGtin,
} from '../../compartilhado/validacoes/codigo-barras-gtin.js'

function nulParaUndefined(valor: unknown) {
  return valor === null || valor === '' ? undefined : valor
}

const decimalOpcional = z.preprocess(
  nulParaUndefined,
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
      return Number.isFinite(n) ? n : undefined
    })
)

const inteiroOpcional = z.preprocess(
  nulParaUndefined,
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      const n = typeof v === 'number' ? v : Number(String(v).replace(/\D/g, ''))
      return Number.isFinite(n) ? Math.round(n) : undefined
    })
)

const textoOpcionalNulavel = (max: number) =>
  z.preprocess(nulParaUndefined, textoCadastroOpcional(max))

const codigoBarrasEmbalagemOpcional = z.preprocess(
  nulParaUndefined,
  z.string().max(30).optional()
)

const codigoBarrasGtinOpcional = z.preprocess(
  nulParaUndefined,
  z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined
      const digitos = normalizarCodigoBarrasGtin(v)
      return digitos || undefined
    })
    .refine(
      (v) => v === undefined || codigoBarrasGtinValido(v),
      MENSAGEM_CODIGO_BARRAS_INVALIDO
    )
)

export const esquemaEmbalagemMaster = z.object({
  quantidade: z.preprocess(
    nulParaUndefined,
    z
      .union([z.number(), z.string()])
      .refine((v) => {
        const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
        return Number.isFinite(n) && n > 0
      }, 'Quantidade da embalagem master inválida')
      .transform((v) => {
        const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
        return n
      })
  ),
  codigoBarras: codigoBarrasEmbalagemOpcional,
  alturaCm: decimalOpcional,
  larguraCm: decimalOpcional,
  comprimentoCm: decimalOpcional,
  ordem: z.number().int().optional(),
})

export const esquemaEnderecoEstoque = z.object({
  apelido: textoOpcionalNulavel(100),
  endereco: textoCadastroObrigatorio(1),
  ordem: z.number().int().optional(),
})

export const esquemaProdutoFornecedor = z.object({
  fornecedorPessoaId: z.string().uuid('Fornecedor obrigatório'),
  codigoFornecedor: textoOpcionalNulavel(50),
  multiploEntrada: decimalOpcional,
  multiplicadorEntrada: decimalOpcional,
  unidadeEntrada: textoOpcionalNulavel(20),
  ordem: z.number().int().optional(),
})

const camposProduto = {
  sku: textoOpcionalNulavel(50),
  ativo: z.boolean().optional().default(true),
  nomeVenda: textoCadastroObrigatorio(2, 60),
  marca: textoCadastroObrigatorio(1, 100),
  unidade: textoCadastroObrigatorio(1).transform((v) => v.toUpperCase()).default('UN'),
  caracteristicas: textoOpcionalNulavel(2000),
  tipoEntrega: z.preprocess(
    nulParaUndefined,
    z
      .enum(['pronta_entrega', 'sob_encomenda'])
      .optional()
  ),
  diasParaEntrega: inteiroOpcional,
  dataValidadePreco: z.preprocess(
    nulParaUndefined,
    z
      .union([z.string(), z.date()])
      .optional()
      .transform((v) => {
        if (v === undefined) return undefined
        if (v instanceof Date) return v
        const d = new Date(v)
        return Number.isNaN(d.getTime()) ? undefined : d
      })
  ),
  entregaNoAto: z.boolean().optional().default(false),
  entregaARetirar: z.boolean().optional().default(false),
  entregar: z.boolean().optional().default(false),
  entregaPorEncomenda: z.boolean().optional().default(false),
  flagDevolucao: z.boolean().optional().default(false),
  controlaEstoque: z.boolean().optional().default(true),
  flagComissao: z.boolean().optional().default(false),
  permiteEstoqueNegativo: z.boolean().optional().default(false),
  bloqueadoCompra: z.boolean().optional().default(false),
  bloqueadoVenda: z.boolean().optional().default(false),
  desativarAoZerarEstoque: z.boolean().optional().default(false),
  codigoBarras: codigoBarrasGtinOpcional,
  pesoKg: decimalOpcional,
  alturaCm: decimalOpcional,
  larguraCm: decimalOpcional,
  comprimentoCm: decimalOpcional,
  capacidadeEmpilhamento: inteiroOpcional,
  normaPalete: textoOpcionalNulavel(100),
  nomeCompra: textoOpcionalNulavel(200),
  precoCusto: decimalOpcional,
  agruparSimilaresRuptura: z.boolean().optional().default(false),
  fornecedores: z.array(esquemaProdutoFornecedor).optional().default([]),
  ncm: z.preprocess(
    nulParaUndefined,
    z
      .string()
      .optional()
      .refine((v) => !v || /^\d{8}$/.test(v.replace(/\D/g, '')), 'NCM deve ter 8 dígitos')
      .transform((v) => (v ? v.replace(/\D/g, '') : undefined))
  ),
  codigoOrigem: z.preprocess(
    nulParaUndefined,
    z
      .string()
      .optional()
      .refine((v) => !v || /^[0-8]$/.test(v), 'Código de origem deve ser de 0 a 8')
  ),
  embalagensMaster: z.array(esquemaEmbalagemMaster).optional().default([]),
  enderecosEstoque: z.array(esquemaEnderecoEstoque).optional().default([]),
  similaresIds: z.array(z.string().uuid()).optional().default([]),
}

export const esquemaDeCriacaoDeProduto = z
  .object({
    ...camposProduto,
    entregaNoAto: z.boolean().optional().default(true),
    entregaARetirar: z.boolean().optional().default(true),
    entregar: z.boolean().optional().default(true),
  })
  .superRefine((dados, ctx) => {
    if (dados.tipoEntrega !== 'sob_encomenda') {
      if (dados.diasParaEntrega !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Dias para entrega só se aplica a sob encomenda',
          path: ['diasParaEntrega'],
        })
      }
      if (dados.dataValidadePreco !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Data de validade do preço só se aplica a sob encomenda',
          path: ['dataValidadePreco'],
        })
      }
    }
  })

export const esquemaDeEdicaoDeProduto = z
  .object(camposProduto)
  .superRefine((dados, ctx) => {
    if (dados.tipoEntrega !== 'sob_encomenda') {
      if (dados.diasParaEntrega !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Dias para entrega só se aplica a sob encomenda',
          path: ['diasParaEntrega'],
        })
      }
      if (dados.dataValidadePreco !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Data de validade do preço só se aplica a sob encomenda',
          path: ['dataValidadePreco'],
        })
      }
    }
  })

export const esquemaDeAtivarProduto = z.object({
  ativo: z.boolean(),
})

export const esquemaDeUploadFotoProduto = z.object({
  principal: z.string().min(1, 'Foto principal obrigatória'),
  miniatura: z.string().min(1, 'Miniatura obrigatória'),
  larguraPrincipal: z.number().int().positive().optional(),
  alturaPrincipal: z.number().int().positive().optional(),
  larguraMiniatura: z.number().int().positive().optional(),
  alturaMiniatura: z.number().int().positive().optional(),
})

export type DadosParaCriarProduto = z.infer<typeof esquemaDeCriacaoDeProduto>
export type DadosParaEditarProduto = z.infer<typeof esquemaDeEdicaoDeProduto>
export type DadosUploadFotoProduto = z.infer<typeof esquemaDeUploadFotoProduto>

export function mensagemErroZod(erro: z.ZodError): string {
  return (
    erro.errors
      .map((e) => {
        const campo = e.path.join('.') || 'campo'
        const msg = e.message === 'Invalid input' ? 'valor inválido' : e.message
        return `${campo}: ${msg}`
      })
      .join('; ') || 'Dados inválidos'
  )
}
