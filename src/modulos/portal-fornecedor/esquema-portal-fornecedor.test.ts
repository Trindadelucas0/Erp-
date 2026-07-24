import { describe, expect, it } from 'vitest'
import {
  esquemaLoginPortalFornecedor,
  esquemaUploadPortalFornecedor,
} from './esquema-portal-fornecedor.js'

describe('esquemaLoginPortalFornecedor', () => {
  it('aceita CNPJ formatado e normaliza (numérico ou alfanumérico)', () => {
    const resultado = esquemaLoginPortalFornecedor.parse({
      cnpj: '12.345.678/0001-99',
      senha: '42',
    })
    expect(resultado.cnpj).toBe('12345678000199')
    expect(resultado.senha).toBe(42)

    const alfa = esquemaLoginPortalFornecedor.parse({
      cnpj: '12.ABC.345/01DE-35',
      senha: '42',
    })
    expect(alfa.cnpj).toBe('12ABC34501DE35')
  })

  it('rejeita CNPJ com quantidade de caracteres inválida', () => {
    expect(() =>
      esquemaLoginPortalFornecedor.parse({ cnpj: '123', senha: '42' })
    ).toThrow()
  })

  it('rejeita senha não numérica ou zero', () => {
    expect(() =>
      esquemaLoginPortalFornecedor.parse({ cnpj: '12345678000199', senha: 'abc' })
    ).toThrow()
    expect(() =>
      esquemaLoginPortalFornecedor.parse({ cnpj: '12345678000199', senha: '0' })
    ).toThrow()
  })
})

describe('esquemaUploadPortalFornecedor', () => {
  const base64Valido = 'A'.repeat(60)

  it('aceita PDF, XLSX, XLS e CSV', () => {
    const mimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ]
    for (const mimeType of mimes) {
      expect(() =>
        esquemaUploadPortalFornecedor.parse({
          nomeArquivo: 'documento.ext',
          mimeType,
          base64Arquivo: base64Valido,
        })
      ).not.toThrow()
    }
  })

  it('rejeita tipo de arquivo não permitido', () => {
    expect(() =>
      esquemaUploadPortalFornecedor.parse({
        nomeArquivo: 'imagem.png',
        mimeType: 'image/png',
        base64Arquivo: base64Valido,
      })
    ).toThrow()
  })

  it('rejeita arquivo base64 muito curto (provavelmente inválido)', () => {
    expect(() =>
      esquemaUploadPortalFornecedor.parse({
        nomeArquivo: 'documento.pdf',
        mimeType: 'application/pdf',
        base64Arquivo: 'abc',
      })
    ).toThrow()
  })
})
