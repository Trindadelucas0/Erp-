import { describe, expect, it } from 'vitest'
import {
  formatarTamanhoAnexo,
  inferirMimeTypeAnexo,
  rotuloTipoAnexo,
  validarArquivoAnexoFornecedor,
} from './anexo-fornecedor'

describe('anexo-fornecedor', () => {
  it('inferirMimeTypeAnexo usa mimeType informado quando válido', () => {
    expect(inferirMimeTypeAnexo('doc.pdf', 'application/pdf')).toBe('application/pdf')
  })

  it('inferirMimeTypeAnexo infere pela extensão quando mimeType vem vazio', () => {
    expect(inferirMimeTypeAnexo('nota.pdf', '')).toBe('application/pdf')
    expect(inferirMimeTypeAnexo('planilha.xlsx', '')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    expect(inferirMimeTypeAnexo('legado.xls', '')).toBe('application/vnd.ms-excel')
    expect(inferirMimeTypeAnexo('itens.csv', '')).toBe('text/csv')
  })

  it('inferirMimeTypeAnexo retorna null para extensão inválida', () => {
    expect(inferirMimeTypeAnexo('arquivo.docx', '')).toBeNull()
  })

  it('validarArquivoAnexoFornecedor bloqueia tipo inválido', () => {
    expect(validarArquivoAnexoFornecedor('arquivo.docx', '')).toEqual({
      erro: 'Tipo de arquivo não permitido. Envie PDF, XLSX, XLS ou CSV.',
    })
  })

  it('rotuloTipoAnexo retorna rótulos amigáveis', () => {
    expect(rotuloTipoAnexo('application/pdf', 'a.pdf')).toBe('PDF')
    expect(
      rotuloTipoAnexo(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'a.xlsx'
      )
    ).toBe('Excel')
    expect(rotuloTipoAnexo('', 'a.csv')).toBe('CSV')
  })

  it('formatarTamanhoAnexo formata bytes, KB e MB', () => {
    expect(formatarTamanhoAnexo(512)).toBe('512 B')
    expect(formatarTamanhoAnexo(2048)).toBe('2.0 KB')
    expect(formatarTamanhoAnexo(2 * 1024 * 1024)).toBe('2.0 MB')
  })
})
