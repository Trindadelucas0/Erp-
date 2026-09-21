import { describe, expect, it } from 'vitest'
import {
  formatarNumeroRequisicao,
  OPCOES_TIPO_OPERACAO,
  podeConcluirExecucao,
  rotuloNfDaRequisicao,
  ROTULO_TIPO_OPERACAO,
  statusUiArmazenagem,
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
    produtoCodigoBarras: null,
    produtoBarrasMaster: [],
    quantidade: 10,
    responsavelId: 'eu',
    responsavelNome: 'Eu',
    observacao: null,
    nfeRecebidaId: null,
    nfeRecebidaChave: null,
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

describe('tipos de operação', () => {
  it('não oferece Contagem de entrada nem Guardar na criação manual', () => {
    expect(OPCOES_TIPO_OPERACAO.some((o) => o.value === 'contagem_entrada')).toBe(false)
    expect(OPCOES_TIPO_OPERACAO.some((o) => o.value === 'armazenagem')).toBe(false)
    expect(ROTULO_TIPO_OPERACAO.contagem_entrada).toBe('Contagem de entrada')
    expect(ROTULO_TIPO_OPERACAO.armazenagem).toBe('Guardar mercadorias')
  })
})

describe('rotuloNfDaRequisicao', () => {
  it('extrai número e série da chave', () => {
    const chave = '35260812345678000190550010002651121234567890'
    expect(rotuloNfDaRequisicao(chave)).toBe('NF 265112 série 1')
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

describe('statusUiArmazenagem', () => {
  it('prioriza OK, sem endereço e sem barras', () => {
    expect(statusUiArmazenagem(item({ status: 'concluida' })).rotulo).toBe('OK/Armazenada')
    expect(
      statusUiArmazenagem(item({ status: 'disponivel', destinoEnderecoId: null })).rotulo
    ).toBe('Sem endereço')
    expect(
      statusUiArmazenagem(
        item({
          status: 'disponivel',
          destinoEnderecoId: 'd1',
          produtoCodigoBarras: null,
          produtoBarrasMaster: [],
        })
      ).rotulo
    ).toBe('Sem barras')
  })
})
