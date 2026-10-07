import { describe, expect, it } from 'vitest'
import {
  PERMISSOES_PADRAO_POR_PAPEL,
  resolverChavesDoPapel,
  gerarTodasAsChavesDePermissao,
} from './registro-de-permissoes.js'

describe('PERMISSOES_PADRAO_POR_PAPEL — papéis novos', () => {
  it('comprador opera compras sem excluir', () => {
    const chaves = PERMISSOES_PADRAO_POR_PAPEL.comprador
    expect(chaves).toContain('compras:view')
    expect(chaves).toContain('compras:create')
    expect(chaves).toContain('compras:edit')
    expect(chaves).not.toContain('compras:delete')
  })

  it('administrativo não recebe chaves de módulo no seed', () => {
    expect(PERMISSOES_PADRAO_POR_PAPEL.administrativo).toEqual([])
  })

  it('logistica opera estoque sem excluir', () => {
    const chaves = PERMISSOES_PADRAO_POR_PAPEL.logistica
    expect(chaves).toContain('estoque:view')
    expect(chaves).not.toContain('estoque:delete')
  })

  it('resolverChavesDoPapel expande comprador', () => {
    const todas = gerarTodasAsChavesDePermissao()
    expect(resolverChavesDoPapel('comprador', todas)).toEqual(
      PERMISSOES_PADRAO_POR_PAPEL.comprador
    )
  })
})
