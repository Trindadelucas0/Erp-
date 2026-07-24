import { describe, expect, it } from 'vitest'
import {
  detectarTipoDocumento,
  mascaraCnpj,
  normalizarCnpj,
  validarCnpj,
  validarCpf,
} from './documentos.js'

describe('normalizarCnpj', () => {
  it('remove pontuação e mantém só A-Z/0-9 em maiúsculas', () => {
    expect(normalizarCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35')
  })

  it('limita a 14 caracteres', () => {
    expect(normalizarCnpj('12ABC34501DE35EXTRA')).toBe('12ABC34501DE35')
  })
})

describe('validarCnpj', () => {
  it('aceita CNPJ numérico clássico formatado', () => {
    expect(validarCnpj('11.222.333/0001-81')).toBe(true)
  })

  it('aceita CNPJ numérico sem máscara', () => {
    expect(validarCnpj('11222333000181')).toBe(true)
  })

  it('aceita CNPJ alfanumérico válido', () => {
    expect(validarCnpj('12ABC34501DE35')).toBe(true)
    expect(validarCnpj('12.ABC.345/01DE-35')).toBe(true)
  })

  it('rejeita tamanho inválido', () => {
    expect(validarCnpj('123')).toBe(false)
    expect(validarCnpj('1122233300018')).toBe(false)
  })

  it('rejeita DV inválido', () => {
    expect(validarCnpj('11222333000180')).toBe(false)
    expect(validarCnpj('12ABC34501DE00')).toBe(false)
  })

  it('rejeita sequência repetida', () => {
    expect(validarCnpj('00000000000000')).toBe(false)
    expect(validarCnpj('AAAAAAAAAAAA00')).toBe(false)
  })

  it('rejeita DV não numérico', () => {
    expect(validarCnpj('12ABC34501DEAB')).toBe(false)
  })
})

describe('mascaraCnpj', () => {
  it('formata numérico', () => {
    expect(mascaraCnpj('11222333000181')).toBe('11.222.333/0001-81')
  })

  it('formata alfanumérico preservando letras', () => {
    expect(mascaraCnpj('12ABC34501DE35')).toBe('12.ABC.345/01DE-35')
  })
})

describe('detectarTipoDocumento', () => {
  it('detecta CPF com 11 dígitos', () => {
    expect(detectarTipoDocumento('529.982.247-25')).toBe('CPF')
  })

  it('detecta CNPJ por letras ou tamanho', () => {
    expect(detectarTipoDocumento('12ABC')).toBe('CNPJ')
    expect(detectarTipoDocumento('11222333000181')).toBe('CNPJ')
  })

  it('retorna null enquanto ambíguo', () => {
    expect(detectarTipoDocumento('12345')).toBe(null)
  })
})

describe('validarCpf (inalterado)', () => {
  it('aceita CPF válido e rejeita inválido', () => {
    expect(validarCpf('529.982.247-25')).toBe(true)
    expect(validarCpf('111.111.111-11')).toBe(false)
  })
})
