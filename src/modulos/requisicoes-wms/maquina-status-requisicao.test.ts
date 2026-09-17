import { describe, expect, it } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  acaoPermitidaNoStatus,
  exigirTransicao,
  statusAposAcao,
  edicaoPermitida,
} from './maquina-status-requisicao.js'

describe('máquina de status da requisição WMS', () => {
  it('matriz de transições permitidas', () => {
    expect(acaoPermitidaNoStatus('disponibilizar', 'pendente')).toBe(true)
    expect(acaoPermitidaNoStatus('disponibilizar', 'disponivel')).toBe(false)
    expect(acaoPermitidaNoStatus('atribuir', 'pendente')).toBe(true)
    expect(acaoPermitidaNoStatus('atribuir', 'disponivel')).toBe(true)
    expect(acaoPermitidaNoStatus('iniciar', 'disponivel')).toBe(true)
    expect(acaoPermitidaNoStatus('iniciar', 'atribuida')).toBe(true)
    expect(acaoPermitidaNoStatus('iniciar', 'pendente')).toBe(false)
    expect(acaoPermitidaNoStatus('pausar', 'em_execucao')).toBe(true)
    expect(acaoPermitidaNoStatus('retomar', 'pausada')).toBe(true)
    expect(acaoPermitidaNoStatus('concluir', 'em_execucao')).toBe(true)
    expect(acaoPermitidaNoStatus('concluir', 'pausada')).toBe(false)
    expect(acaoPermitidaNoStatus('cancelar', 'pausada')).toBe(true)
    expect(acaoPermitidaNoStatus('cancelar', 'concluida')).toBe(false)
    expect(acaoPermitidaNoStatus('bloquear', 'atribuida')).toBe(true)
    expect(acaoPermitidaNoStatus('bloquear', 'em_execucao')).toBe(false)
    expect(acaoPermitidaNoStatus('desbloquear', 'bloqueada')).toBe(true)
  })

  it('statusAposAcao e 409 em transição inválida', () => {
    expect(statusAposAcao('disponibilizar', 'pendente', false)).toBe('disponivel')
    expect(statusAposAcao('iniciar', 'disponivel', false)).toBe('em_execucao')
    expect(statusAposAcao('desbloquear', 'bloqueada', false)).toBe('disponivel')
    expect(statusAposAcao('desbloquear', 'bloqueada', true)).toBe('atribuida')
    expect(() => exigirTransicao('concluir', 'pendente')).toThrow(ErroDaAplicacao)
    try {
      exigirTransicao('concluir', 'pendente')
    } catch (e) {
      expect((e as ErroDaAplicacao).statusCode).toBe(409)
    }
  })

  it('não edita concluída nem cancelada', () => {
    expect(edicaoPermitida('pendente')).toBe(true)
    expect(edicaoPermitida('concluida')).toBe(false)
    expect(edicaoPermitida('cancelada')).toBe(false)
  })
})
