import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarProvedorResiliente } from './provedor-resiliente.js'
import type { MensagemIa, ProvedorIa, RespostaProvedorIa } from './tipos-ia.js'

const mensagens: MensagemIa[] = [{ papel: 'user', conteudo: 'texto do documento' }]

function criarProvedorFalso(nome: string, modelo: string, respostas: RespostaProvedorIa[]): ProvedorIa {
  let chamada = 0
  return {
    nome,
    modelo,
    extrairTextoJson: vi.fn(async () => {
      const resposta = respostas[Math.min(chamada, respostas.length - 1)]
      chamada++
      return resposta
    }),
  }
}

const ERRO_SOBRECARGA: RespostaProvedorIa = {
  sucesso: false,
  mensagem: 'This model is currently experiencing high demand. Spikes in demand are usually temporary.',
  codigoHttp: 503,
}

const ERRO_AUTH: RespostaProvedorIa = {
  sucesso: false,
  mensagem: 'API key inválida.',
  codigoHttp: 401,
}

const ERRO_TIMEOUT: RespostaProvedorIa = {
  sucesso: false,
  mensagem: 'A IA (Gemini) não respondeu a tempo (timeout).',
  codigoHttp: 408,
}

const SUCESSO: RespostaProvedorIa = { sucesso: true, texto: '{"cabecalho":{},"itens":[],"avisos":[]}' }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('criarProvedorResiliente', () => {
  it('tenta de novo após erro temporário e retorna sucesso sem esgotar as tentativas', async () => {
    const principal = criarProvedorFalso('gemini', 'gemini-3.5-flash', [ERRO_SOBRECARGA, SUCESSO])
    const provedor = criarProvedorResiliente(principal, null)

    const promise = provedor.extrairTextoJson(mensagens)
    await vi.runAllTimersAsync()
    const resposta = await promise

    expect(resposta).toEqual(SUCESSO)
    expect(principal.extrairTextoJson).toHaveBeenCalledTimes(2)
    expect(provedor.modelo).toBe('gemini-3.5-flash')
  })

  it('não tenta de novo quando o erro é permanente (auth/validação)', async () => {
    const principal = criarProvedorFalso('gemini', 'gemini-3.5-flash', [ERRO_AUTH])
    const fallback = criarProvedorFalso('gemini', 'gemini-3.1-flash-lite', [SUCESSO])
    const provedor = criarProvedorResiliente(principal, fallback)

    const resposta = await provedor.extrairTextoJson(mensagens)

    expect(resposta).toEqual(ERRO_AUTH)
    expect(principal.extrairTextoJson).toHaveBeenCalledTimes(1)
    expect(fallback.extrairTextoJson).not.toHaveBeenCalled()
  })

  it('usa o fallback quando o principal esgota as tentativas por sobrecarga', async () => {
    const principal = criarProvedorFalso('gemini', 'gemini-3.5-flash', [
      ERRO_SOBRECARGA,
      ERRO_SOBRECARGA,
      ERRO_SOBRECARGA,
    ])
    const fallback = criarProvedorFalso('gemini', 'gemini-3.1-flash-lite', [SUCESSO])
    const provedor = criarProvedorResiliente(principal, fallback)

    const promise = provedor.extrairTextoJson(mensagens)
    await vi.runAllTimersAsync()
    const resposta = await promise

    expect(resposta).toEqual(SUCESSO)
    expect(principal.extrairTextoJson).toHaveBeenCalledTimes(3)
    expect(fallback.extrairTextoJson).toHaveBeenCalledTimes(1)
    expect(provedor.modelo).toBe('gemini-3.1-flash-lite')
  })

  it('sem fallback configurado, retorna o erro original após esgotar as tentativas', async () => {
    const principal = criarProvedorFalso('gemini', 'gemini-3.5-flash', [
      ERRO_SOBRECARGA,
      ERRO_SOBRECARGA,
      ERRO_SOBRECARGA,
    ])
    const provedor = criarProvedorResiliente(principal, null)

    const promise = provedor.extrairTextoJson(mensagens)
    await vi.runAllTimersAsync()
    const resposta = await promise

    expect(resposta).toEqual(ERRO_SOBRECARGA)
    expect(principal.extrairTextoJson).toHaveBeenCalledTimes(3)
  })

  it('timeout (408) também é retentado, mas limitado a 2 tentativas em vez de 3', async () => {
    const principal = criarProvedorFalso('gemini', 'gemini-3.5-flash', [ERRO_TIMEOUT, ERRO_TIMEOUT])
    const fallback = criarProvedorFalso('gemini', 'gemini-3.1-flash-lite', [SUCESSO])
    const provedor = criarProvedorResiliente(principal, fallback)

    const promise = provedor.extrairTextoJson(mensagens)
    await vi.runAllTimersAsync()
    const resposta = await promise

    expect(resposta).toEqual(SUCESSO)
    expect(principal.extrairTextoJson).toHaveBeenCalledTimes(2)
    expect(fallback.extrairTextoJson).toHaveBeenCalledTimes(1)
  })

  it('reporta o erro do fallback quando ele também falha', async () => {
    const principal = criarProvedorFalso('gemini', 'gemini-3.5-flash', [
      ERRO_SOBRECARGA,
      ERRO_SOBRECARGA,
      ERRO_SOBRECARGA,
    ])
    const erroFallback: RespostaProvedorIa = { sucesso: false, mensagem: 'Fallback também sobrecarregado.', codigoHttp: 503 }
    const fallback = criarProvedorFalso('gemini', 'gemini-3.1-flash-lite', [erroFallback])
    const provedor = criarProvedorResiliente(principal, fallback)

    const promise = provedor.extrairTextoJson(mensagens)
    await vi.runAllTimersAsync()
    const resposta = await promise

    expect(resposta).toEqual(erroFallback)
  })
})
