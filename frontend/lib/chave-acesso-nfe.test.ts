import { describe, expect, it } from 'vitest'
import {
  extrairSerieNumeroChave,
  prefixoNumeroDocumento,
  tituloAnaliseEntrada,
} from './chave-acesso-nfe'

describe('extrairSerieNumeroChave', () => {
  it('lê série e número de chave NFe 44 dígitos', () => {
    const chave = '53260801637895007498550060014735781685508775'
    expect(extrairSerieNumeroChave(chave)).toEqual({ serie: '6', numero: '1473578' })
  })

  it('aceita chave com máscara e zera zeros à esquerda', () => {
    const chave = '35-2608-01637895007498-55-001-000265112-168550877-5'
    expect(extrairSerieNumeroChave(chave)).toEqual({ serie: '1', numero: '265112' })
  })

  it('não inventa número se a chave não tem 44 dígitos', () => {
    expect(extrairSerieNumeroChave('abc')).toEqual({ serie: null, numero: null })
    expect(extrairSerieNumeroChave('123')).toEqual({ serie: null, numero: null })
  })
})

describe('tituloAnaliseEntrada', () => {
  it('compõe o h1 com prefixo do tipo', () => {
    expect(tituloAnaliseEntrada('nfe55', '1473578')).toBe('Análise de entrada · NF 1473578')
    expect(tituloAnaliseEntrada('cte', '5406')).toBe('Análise de entrada · CT-e 5406')
    expect(tituloAnaliseEntrada('nfse', '99')).toBe('Análise de entrada · NFS-e 99')
  })

  it('omite o número quando não há extração', () => {
    expect(tituloAnaliseEntrada('nfe55', null)).toBe('Análise de entrada')
  })

  it('prefixoNumeroDocumento cobre os três tipos', () => {
    expect(prefixoNumeroDocumento('nfe55')).toBe('NF')
    expect(prefixoNumeroDocumento('cte')).toBe('CT-e')
    expect(prefixoNumeroDocumento('nfse')).toBe('NFS-e')
  })
})
