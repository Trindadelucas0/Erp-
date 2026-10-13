import { z } from 'zod'

const dataIso = z.string().trim().refine((valor) => !Number.isNaN(Date.parse(valor)), 'Data inválida')

export const esquemaConsultaConciliacao = z.object({
  contaEmpresaId: z.string().uuid('Conta inválida'),
  dataDe: dataIso,
  dataAte: dataIso,
  tipo: z.enum(['credito', 'debito']).optional(),
  status: z.enum(['conciliado', 'pendente', 'nao_identificado', 'nao_encontrado']).optional(),
  extratoId: z.string().uuid().optional(),
})

export const esquemaUploadExtrato = z.object({
  contaEmpresaId: z.string().uuid('Conta inválida'),
  nomeArquivo: z.string().trim().min(1).max(200),
  mimeType: z.enum([
    'application/x-ofx',
    'application/ofx',
    'text/ofx',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ]),
  base64Arquivo: z.string().min(10).max(7_000_000),
})

const baixa = z.object({
  origem: z.enum(['pagar', 'receber']),
  baixaId: z.string().uuid(),
})

export const esquemaConcluirConciliacao = z.object({
  contaEmpresaId: z.string().uuid('Conta inválida'),
  linhaIds: z.array(z.string().uuid()).min(1, 'Selecione ao menos uma linha do extrato'),
  baixas: z.array(baixa).min(1, 'Selecione ao menos uma movimentação do sistema'),
})

export const esquemaDesvincularConciliacao = z.object({
  id: z.string().uuid(),
})

export const esquemaCriarLancamentoConciliacao = z.object({
  direcao: z.enum(['saida', 'entrada']),
  contaEmpresaId: z.string().uuid('Conta inválida'),
  planoFinanceiroId: z.string().uuid('Plano financeiro obrigatório'),
  data: dataIso,
  valor: z.coerce.number().finite().positive('Valor deve ser maior que zero'),
  historico: z.string().trim().min(1).max(500),
  documento: z.string().trim().max(60).nullable().optional(),
})

export const esquemaConsultaMovimentos = z.object({
  contaEmpresaId: z.string().uuid().optional(),
  dataDe: dataIso,
  dataAte: dataIso,
  q: z.string().trim().max(120).optional(),
  conciliada: z.enum(['sim', 'nao']).optional(),
})

export type ConsultaConciliacao = z.infer<typeof esquemaConsultaConciliacao>
export type UploadExtrato = z.infer<typeof esquemaUploadExtrato>
export type ConcluirConciliacao = z.infer<typeof esquemaConcluirConciliacao>
export type CriarLancamentoConciliacao = z.infer<typeof esquemaCriarLancamentoConciliacao>
export type ConsultaMovimentos = z.infer<typeof esquemaConsultaMovimentos>
