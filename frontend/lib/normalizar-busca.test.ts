import { describe, expect, it } from 'vitest'
import {
  filtrarCadastroPessoa,
  normalizarTermoBusca,
  segmentarTextoPorTermo,
  textoContemTermo,
  textoContemTodosTermos,
  textosContemTodosTermos,
  tokensBusca,
} from './normalizar-busca'

const cadastros = [
  {
    nome: 'SAINT-GOBAIN DO BRASIL',
    nomeFantasia: 'Saint Gobain',
    cpf: null,
    cnpj: '12345678000199',
    email: 'contato@saint.com',
    estado: 'SP',
  },
  {
    nome: 'Transportes São Paulo Ltda',
    nomeFantasia: null,
    cpf: null,
    cnpj: '98765432000111',
    email: null,
    estado: 'RJ',
  },
]

describe('normalizar-busca', () => {
  it('ignora maiúsculas e minúsculas', () => {
    expect(normalizarTermoBusca('MaRiA')).toBe('maria')
    expect(textoContemTermo('SAINT-GOBAIN DO BRASIL', 'gobain')).toBe(true)
  })

  it('ignora acentos', () => {
    expect(textoContemTermo('São Paulo', 'sao')).toBe(true)
  })

  it('retorna true para termo vazio', () => {
    expect(textoContemTermo('Qualquer texto', '')).toBe(true)
    expect(textoContemTermo('Qualquer texto', '   ')).toBe(true)
  })

  it('tokensBusca separa por espaço', () => {
    expect(tokensBusca('esgoto 75')).toEqual(['esgoto', '75'])
    expect(tokensBusca('  ESG  ')).toEqual(['esg'])
  })

  it('textoContemTodosTermos exige todas as palavras (ordem irrelevante)', () => {
    expect(textoContemTodosTermos('TUBO ESGOTO PVC 75MM', 'esgoto 75')).toBe(true)
    expect(textoContemTodosTermos('TUBO ESGOTO PVC 75MM', '75 esgoto')).toBe(true)
    expect(textoContemTodosTermos('TUBO ESGOTO PVC 75MM', 'esgoto 110')).toBe(false)
  })

  it('textoContemTodosTermos aceita trecho parcial', () => {
    expect(textoContemTodosTermos('TUBO ESGOTO PVC 75MM', 'esg')).toBe(true)
  })

  it('textosContemTodosTermos permite tokens em campos diferentes', () => {
    expect(textosContemTodosTermos(['TUBO ESGOTO', 'SKU75'], 'esgoto 75')).toBe(true)
    expect(textosContemTodosTermos(['TUBO ESGOTO', 'SKU01'], 'esgoto 75')).toBe(false)
  })
})

describe('filtrarCadastroPessoa', () => {
  it('filtra por nome sem diferenciar maiúsculas', () => {
    expect(filtrarCadastroPessoa(cadastros, 'saint')).toHaveLength(1)
    expect(filtrarCadastroPessoa(cadastros, 'SAINT')).toHaveLength(1)
  })

  it('filtra por nome com acento', () => {
    expect(filtrarCadastroPessoa(cadastros, 'sao paulo')).toHaveLength(1)
  })

  it('filtra por palavras em campos diferentes', () => {
    expect(filtrarCadastroPessoa(cadastros, 'saint sp')).toHaveLength(1)
  })

  it('filtra por CNPJ parcial', () => {
    expect(filtrarCadastroPessoa(cadastros, '12345678')).toHaveLength(1)
  })

  it('retorna todos quando busca vazia', () => {
    expect(filtrarCadastroPessoa(cadastros, '')).toHaveLength(2)
  })
})

describe('segmentarTextoPorTermo', () => {
  it('destaca trecho ignorando maiúsculas', () => {
    const segmentos = segmentarTextoPorTermo('ADITIVO COLANTE', 'col')
    expect(segmentos).toEqual([
      { texto: 'ADITIVO ', destaque: false },
      { texto: 'COL', destaque: true },
      { texto: 'ANTE', destaque: false },
    ])
  })

  it('destaca trecho ignorando acentos', () => {
    const segmentos = segmentarTextoPorTermo('São Paulo', 'sao')
    expect(segmentos).toEqual([
      { texto: 'São', destaque: true },
      { texto: ' Paulo', destaque: false },
    ])
  })

  it('retorna segmento único sem destaque para termo vazio', () => {
    expect(segmentarTextoPorTermo('Qualquer texto', '')).toEqual([
      { texto: 'Qualquer texto', destaque: false },
    ])
    expect(segmentarTextoPorTermo('Qualquer texto', '   ')).toEqual([
      { texto: 'Qualquer texto', destaque: false },
    ])
  })

  it('destaca todas as ocorrências do termo', () => {
    const segmentos = segmentarTextoPorTermo('col colante', 'col')
    expect(segmentos).toEqual([
      { texto: 'col', destaque: true },
      { texto: ' ', destaque: false },
      { texto: 'col', destaque: true },
      { texto: 'ante', destaque: false },
    ])
  })
})
