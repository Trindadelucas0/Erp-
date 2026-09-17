import { describe, expect, it } from 'vitest'
import {
  formatarNumeroRequisicao,
  podeConcluirExecucao,
  type RequisicaoWms,
} from './requisicoes-wms'

function item(parcial: Partial<RequisicaoWms> = {}): RequisicaoWms {
  return {
    id: '1',
    numero: 1,
    tipoOperacao: 'separacao',
    prioridade: 1,
    status: 'em_execucao',
    origemEnderecoId: null,
    origemCodigo: null,
    destinoEnderecoId: null,
    destinoCodigo: null,
    produtoId: 'p',
    produtoNome: 'Cabo',
    produtoSku: '9325',
    quantidade: 10,
    responsavelId: 'eu',
    responsavelNome: 'Eu',
    observacao: null,
    iniciadoEm: null,
    pausadoEm: null,
    concluidoEm: null,
    qtdExecutada: 10,
    conferidoOrigemEm: null,
    conferidoProdutoEm: '2026-09-17T12:00:00.000Z',
    conferidoDestinoEm: null,
    conferidoOrigemValor: null,
    conferidoProdutoValor: '9325',
    conferidoDestinoValor: null,
    passosExigidos: ['produto', 'quantidade'],
    conferenciaOk: true,
    controlaEstoque: true,
    produtoUnidade: 'UN',
    qtdDisponivel: 24,
    createdAt: '',
    updatedAt: '',
    ...parcial,
  }
}

describe('formatarNumeroRequisicao', () => {
  it('preenche zeros à esquerda', () => {
    expect(formatarNumeroRequisicao(42)).toBe('REQ-00042')
  })
})

describe('podeConcluirExecucao', () => {
  it('só o responsável com conferência completa', () => {
    expect(podeConcluirExecucao(item(), 'eu')).toBe(true)
    expect(podeConcluirExecucao(item({ conferenciaOk: false }), 'eu')).toBe(false)
    expect(podeConcluirExecucao(item(), 'outro')).toBe(false)
    expect(podeConcluirExecucao(item({ status: 'pausada' }), 'eu')).toBe(false)
  })
})
