import { describe, it, expect } from 'vitest'
import {
  esquemaDeCriacaoDeEmpresa,
  esquemaDeEdicaoDeEmpresa,
} from '../../../src/modulos/empresas/esquema-empresas.js'

const CNPJ_VALIDO = '11444777000161'
const CNPJ_COM_MASCARA = '11.444.777/0001-61'

function dadosValidos(overrides = {}) {
  return {
    nome: 'Empresa Teste Ltda',
    cnpj: CNPJ_VALIDO,
    ...overrides,
  }
}

describe('esquemaDeCriacaoDeEmpresa', () => {
  it('aceita dados mínimos válidos (nome + CNPJ)', () => {
    const resultado = esquemaDeCriacaoDeEmpresa.safeParse(dadosValidos())
    expect(resultado.success).toBe(true)
  })

  it('aceita CNPJ com máscara', () => {
    const resultado = esquemaDeCriacaoDeEmpresa.safeParse(
      dadosValidos({ cnpj: CNPJ_COM_MASCARA })
    )
    expect(resultado.success).toBe(true)
  })

  it('rejeita nome com menos de 2 caracteres', () => {
    const resultado = esquemaDeCriacaoDeEmpresa.safeParse(
      dadosValidos({ nome: 'A' })
    )
    expect(resultado.success).toBe(false)
    expect(resultado.error?.errors[0].message).toContain('2 caracteres')
  })

  it('rejeita CNPJ com todos os dígitos iguais', () => {
    const resultado = esquemaDeCriacaoDeEmpresa.safeParse(
      dadosValidos({ cnpj: '11111111111111' })
    )
    expect(resultado.success).toBe(false)
  })

  it('rejeita CNPJ com dígito verificador errado', () => {
    const resultado = esquemaDeCriacaoDeEmpresa.safeParse(
      dadosValidos({ cnpj: '11444777000162' })
    )
    expect(resultado.success).toBe(false)
    expect(resultado.error?.errors[0].message).toContain('CNPJ inválido')
  })

  it('aceita telefone no formato (00) 0000-0000', () => {
    const resultado = esquemaDeCriacaoDeEmpresa.safeParse(
      dadosValidos({ phone: '(11) 3333-4444' })
    )
    expect(resultado.success).toBe(true)
  })

  it('aceita celular no formato (00) 00000-0000', () => {
    const resultado = esquemaDeCriacaoDeEmpresa.safeParse(
      dadosValidos({ phone: '(11) 99999-8888' })
    )
    expect(resultado.success).toBe(true)
  })

  it('rejeita telefone com formato inválido', () => {
    const resultado = esquemaDeCriacaoDeEmpresa.safeParse(
      dadosValidos({ phone: '123' })
    )
    expect(resultado.success).toBe(false)
    expect(resultado.error?.errors[0].message).toContain('Telefone')
  })

  it('aceita email corporativo válido', () => {
    const resultado = esquemaDeCriacaoDeEmpresa.safeParse(
      dadosValidos({ email: 'contato@empresa.com.br' })
    )
    expect(resultado.success).toBe(true)
  })

  it('rejeita email inválido', () => {
    const resultado = esquemaDeCriacaoDeEmpresa.safeParse(
      dadosValidos({ email: 'nao-e-email' })
    )
    expect(resultado.success).toBe(false)
    expect(resultado.error?.errors[0].message).toContain('Email')
  })

  it('aceita CEP com hífen', () => {
    const resultado = esquemaDeCriacaoDeEmpresa.safeParse(
      dadosValidos({ cep: '01310-100' })
    )
    expect(resultado.success).toBe(true)
  })

  it('aceita CEP sem hífen', () => {
    const resultado = esquemaDeCriacaoDeEmpresa.safeParse(
      dadosValidos({ cep: '01310100' })
    )
    expect(resultado.success).toBe(true)
  })

  it('rejeita CEP com letras', () => {
    const resultado = esquemaDeCriacaoDeEmpresa.safeParse(
      dadosValidos({ cep: 'ABCDE-FGH' })
    )
    expect(resultado.success).toBe(false)
  })

  it('estado deve ter exatamente 2 letras (sigla)', () => {
    const resultado = esquemaDeCriacaoDeEmpresa.safeParse(
      dadosValidos({ estado: 'SPA' })
    )
    expect(resultado.success).toBe(false)
    expect(resultado.error?.errors[0].message).toContain('sigla')
  })

  it('aceita estado com sigla válida', () => {
    const resultado = esquemaDeCriacaoDeEmpresa.safeParse(
      dadosValidos({ estado: 'sp' }) // deve ser convertido para uppercase
    )
    expect(resultado.success).toBe(true)
  })

  it('aceita todos os campos opcionais vazios', () => {
    const resultado = esquemaDeCriacaoDeEmpresa.safeParse(dadosValidos())
    expect(resultado.success).toBe(true)
  })
})

describe('esquemaDeEdicaoDeEmpresa', () => {
  it('é equivalente ao esquema de criação', () => {
    const resultado = esquemaDeEdicaoDeEmpresa.safeParse(dadosValidos())
    expect(resultado.success).toBe(true)
  })

  it('aplica as mesmas validações de CNPJ', () => {
    const resultado = esquemaDeEdicaoDeEmpresa.safeParse(
      dadosValidos({ cnpj: '00000000000000' })
    )
    expect(resultado.success).toBe(false)
  })
})
