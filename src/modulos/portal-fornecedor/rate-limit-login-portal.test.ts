import { describe, expect, it } from 'vitest'
import {
  limparTentativas,
  registrarTentativaFalha,
  verificarBloqueio,
} from './rate-limit-login-portal.js'

describe('rate-limit-login-portal', () => {
  it('não bloqueia antes de atingir o limite de tentativas', () => {
    const cnpj = '11111111000111'
    for (let i = 0; i < 4; i++) {
      registrarTentativaFalha(cnpj, 100)
    }
    expect(verificarBloqueio(cnpj, 100).bloqueado).toBe(false)
  })

  it('bloqueia após 5 tentativas falhas na mesma janela', () => {
    const cnpj = '22222222000122'
    for (let i = 0; i < 5; i++) {
      registrarTentativaFalha(cnpj, 200)
    }
    const resultado = verificarBloqueio(cnpj, 200)
    expect(resultado.bloqueado).toBe(true)
    expect(resultado.segundosRestantes).toBeGreaterThan(0)
  })

  it('libera o bloqueio imediatamente após login bem-sucedido (limparTentativas)', () => {
    const cnpj = '33333333000133'
    for (let i = 0; i < 5; i++) {
      registrarTentativaFalha(cnpj, 300)
    }
    expect(verificarBloqueio(cnpj, 300).bloqueado).toBe(true)

    limparTentativas(cnpj, 300)
    expect(verificarBloqueio(cnpj, 300).bloqueado).toBe(false)
  })

  it('isola tentativas por chave (cnpj + número do pedido)', () => {
    const cnpjA = '44444444000144'
    const cnpjB = '55555555000155'
    for (let i = 0; i < 5; i++) {
      registrarTentativaFalha(cnpjA, 400)
    }
    expect(verificarBloqueio(cnpjA, 400).bloqueado).toBe(true)
    expect(verificarBloqueio(cnpjB, 400).bloqueado).toBe(false)
    expect(verificarBloqueio(cnpjA, 401).bloqueado).toBe(false)
  })
})
