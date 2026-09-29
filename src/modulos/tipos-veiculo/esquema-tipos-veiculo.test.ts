import { describe, expect, it } from 'vitest'
import {
  esquemaDeCriacaoDeTipoVeiculo,
  esquemaDeEdicaoDeTipoVeiculo,
} from './esquema-tipos-veiculo.js'

describe('esquema tipos de veículo', () => {
  it('aceita nome e peso inteiro e assume ativo', () => {
    const r = esquemaDeCriacaoDeTipoVeiculo.safeParse({ nome: '  Van  ', pesoMaximoKg: 1500 })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data).toEqual({ nome: 'Van', pesoMaximoKg: 1500, icone: null, ativo: true })
  })

  it('aceita ícone da galeria', () => {
    const r = esquemaDeCriacaoDeTipoVeiculo.safeParse({ nome: 'Van', pesoMaximoKg: 1500, icone: 'van' })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.icone).toBe('van')
  })

  it('aceita ícone nulo', () => {
    const r = esquemaDeCriacaoDeTipoVeiculo.safeParse({ nome: 'Van', pesoMaximoKg: 1500, icone: null })
    expect(r.success).toBe(true)
  })

  it('rejeita ícone fora da galeria', () => {
    const r = esquemaDeCriacaoDeTipoVeiculo.safeParse({
      nome: 'Van',
      pesoMaximoKg: 1500,
      icone: 'foguete',
    })
    expect(r.success).toBe(false)
    if (r.success) return
    expect(r.error.issues[0]?.message).toBe('Ícone inválido')
  })

  it('edição sem ícone mantém o campo indefinido', () => {
    const r = esquemaDeEdicaoDeTipoVeiculo.safeParse({ nome: 'Van', pesoMaximoKg: 1500, ativo: true })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.icone).toBeUndefined()
  })

  it('aceita peso enviado como texto numérico', () => {
    const r = esquemaDeCriacaoDeTipoVeiculo.safeParse({ nome: 'Carreta', pesoMaximoKg: '30000' })
    expect(r.success).toBe(true)
  })

  it.each([0, -10, '', 1.5, 1000000])('rejeita peso %s', (pesoMaximoKg) => {
    const r = esquemaDeCriacaoDeTipoVeiculo.safeParse({ nome: 'Van', pesoMaximoKg })
    expect(r.success).toBe(false)
  })

  it('rejeita peso ausente', () => {
    const r = esquemaDeCriacaoDeTipoVeiculo.safeParse({ nome: 'Van' })
    expect(r.success).toBe(false)
  })

  it('rejeita nome com menos de 2 caracteres', () => {
    const r = esquemaDeCriacaoDeTipoVeiculo.safeParse({ nome: ' V ', pesoMaximoKg: 500 })
    expect(r.success).toBe(false)
  })

  it('edição exige ativo', () => {
    const r = esquemaDeEdicaoDeTipoVeiculo.safeParse({ nome: 'Van', pesoMaximoKg: 1500 })
    expect(r.success).toBe(false)
  })
})
