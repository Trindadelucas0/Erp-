import { describe, expect, it } from 'vitest'
import {
  cfopEhConhecimentoFrete,
  inferirCfopDoCodigo,
  rotuloExibicaoCfop,
  SUBTIPO_CFOP_CONHECIMENTO_FRETE,
  tipoCfopFinal,
  variantesCodigoCfopParaBusca,
} from './classificacao-cfop.js'

describe('inferirCfopDoCodigo', () => {
  it('classifica prefixo 1 como entrada estadual', () => {
    const r = inferirCfopDoCodigo('1.101')
    expect(r.natureza).toBe('entrada')
    expect(r.abrangencia).toBe('estadual')
    expect(r.rotulo).toBe('Entrada — Estadual')
  })

  it('classifica prefixo 3 como importação', () => {
    const r = inferirCfopDoCodigo('3.102')
    expect(r.natureza).toBe('importacao')
    expect(r.abrangencia).toBeNull()
    expect(r.rotulo).toBe('Importação')
  })

  it('classifica prefixo 7 como exportação', () => {
    const r = inferirCfopDoCodigo('7.101')
    expect(r.natureza).toBe('exportacao')
    expect(r.tipo).toBe('saida')
  })
})

describe('tipoCfopFinal', () => {
  it('usa subtipo quando informado', () => {
    const classificacao = inferirCfopDoCodigo('1.101')
    expect(tipoCfopFinal(classificacao, '06')).toBe('06')
  })

  it('usa base quando subtipo ausente', () => {
    const classificacao = inferirCfopDoCodigo('5.101')
    expect(tipoCfopFinal(classificacao, null)).toBe('02')
  })
})

describe('rotuloExibicaoCfop', () => {
  it('concatena subtipo opcional', () => {
    expect(rotuloExibicaoCfop('entrada', 'estadual', '06')).toBe(
      'Entrada — Estadual · Doação'
    )
  })
})

describe('cfopEhConhecimentoFrete', () => {
  it('reconhece subtipo 03 como Conhecimento de frete', () => {
    expect(SUBTIPO_CFOP_CONHECIMENTO_FRETE).toBe('03')
    expect(cfopEhConhecimentoFrete('03')).toBe(true)
    expect(cfopEhConhecimentoFrete('04')).toBe(false)
    expect(cfopEhConhecimentoFrete(null)).toBe(false)
  })
})

describe('variantesCodigoCfopParaBusca', () => {
  it('gera 6102 e 6.102 a partir do XML sem ponto', () => {
    expect(variantesCodigoCfopParaBusca('6102').sort()).toEqual(['6.102', '6102'].sort())
  })

  it('gera as mesmas variantes a partir do cadastro com ponto', () => {
    expect(variantesCodigoCfopParaBusca('6.102').sort()).toEqual(['6.102', '6102'].sort())
  })

  it('ignora vazio', () => {
    expect(variantesCodigoCfopParaBusca('')).toEqual([])
    expect(variantesCodigoCfopParaBusca('   ')).toEqual([])
  })
})
