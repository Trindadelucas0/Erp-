import { describe, expect, it } from 'vitest'
import { listarAbasDaPagina, tabKeyConfiguracoes } from './registro-de-abas.js'

describe('Integrações — compatibilidade de permissões', () => {
  it.each([
    ['geral', 'assinatura', 'configuracao', 'geral:assinatura:configuracao'],
    ['geral', 'assinatura', 'documentos', 'geral:assinatura:documentos'],
    ['fiscal', 'buscador', null, 'fiscal:buscador'],
    ['financeiro', 'boleto', null, 'financeiro:boleto'],
  ])('preserva a chave de %s/%s/%s nas URLs novas e antigas', (aba, secao, sub, chave) => {
    expect(tabKeyConfiguracoes(aba!, secao, sub)).toBe(chave)
    expect(tabKeyConfiguracoes('integracoes', secao, sub)).toBe(chave)
    expect(listarAbasDaPagina('configuracoes').find((a) => a.id === chave)?.rotulo)
      .toMatch(/^Integrações — /)
  })

  it('não associa seção desconhecida a uma permissão de integração', () => {
    expect(tabKeyConfiguracoes('integracoes', 'cfop')).toBeNull()
    expect(tabKeyConfiguracoes('integracoes', 'desconhecida')).toBeNull()
    expect(tabKeyConfiguracoes('fiscal', 'cfop')).toBe('fiscal:cfop')
  })
})
