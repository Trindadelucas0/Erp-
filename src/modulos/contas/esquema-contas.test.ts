import { describe, expect, it } from 'vitest'
import {
  esquemaDeCriacaoDeConta,
  normalizarDadosContaParaGravacao,
} from './esquema-contas.js'

describe('esquemaDeCriacaoDeConta', () => {
  it('caixa aceita só nome e zera campos bancários na normalização', () => {
    const parse = esquemaDeCriacaoDeConta.safeParse({
      nome: 'Caixa loja',
      tipo: 'caixa',
      banco: 'itau',
      agencia: '1234',
      conta: '999',
    })
    expect(parse.success).toBe(true)
    if (!parse.success) return
    const gravacao = normalizarDadosContaParaGravacao(parse.data)
    expect(gravacao.banco).toBeNull()
    expect(gravacao.agencia).toBeNull()
    expect(gravacao.conta).toBeNull()
  })

  it('bancária exige banco, agência e conta', () => {
    const parse = esquemaDeCriacaoDeConta.safeParse({
      nome: 'Itaú matriz',
      tipo: 'bancaria',
    })
    expect(parse.success).toBe(false)
  })

  it('bancária válida normaliza dígito', () => {
    const parse = esquemaDeCriacaoDeConta.safeParse({
      nome: 'Itaú matriz',
      tipo: 'bancaria',
      banco: 'itau',
      agencia: '1234',
      digitoAgencia: 'x',
      conta: '99887',
      digitoConta: '6',
    })
    expect(parse.success).toBe(true)
    if (!parse.success) return
    const gravacao = normalizarDadosContaParaGravacao(parse.data)
    expect(gravacao.digitoAgencia).toBe('X')
    expect(gravacao.digitoConta).toBe('6')
  })
})
