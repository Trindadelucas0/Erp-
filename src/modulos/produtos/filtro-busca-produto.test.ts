import { describe, expect, it } from 'vitest'
import { escaparCuringasLike, orProdutoPorToken } from './filtro-busca-produto.js'

function skuContains(or: unknown): string[] {
  const bloco = or as { OR: Array<{ sku?: { contains: string } }> }
  return bloco.OR.filter((parte) => parte.sku?.contains).map((parte) => parte.sku!.contains)
}

function nomeContains(or: unknown): string[] {
  const bloco = or as { OR: Array<{ nomeVenda?: { contains: string } }> }
  return bloco.OR.filter((parte) => parte.nomeVenda?.contains).map(
    (parte) => parte.nomeVenda!.contains
  )
}

describe('orProdutoPorToken', () => {
  it('com ponto no termo também busca SKU e nome sem ponto', () => {
    const filtro = orProdutoPorToken('9.325')
    expect(skuContains(filtro)).toEqual(['9.325', '9325'])
    expect(nomeContains(filtro)).toEqual(['9.325', '9325'])
  })

  it('sem ponto não duplica o token no SKU', () => {
    const filtro = orProdutoPorToken('9325')
    expect(skuContains(filtro)).toEqual(['9325'])
  })

  it('inclui ids extra no OR (cadastro com ponto no nome)', () => {
    const filtro = orProdutoPorToken('6500', ['abc'])
    const bloco = filtro as { OR: Array<{ id?: { in: string[] } }> }
    expect(bloco.OR.some((parte) => parte.id?.in?.includes('abc'))).toBe(true)
  })
})

describe('escaparCuringasLike', () => {
  it('remove curingas para não ampliar o ILIKE', () => {
    expect(escaparCuringasLike('65%00')).toBe('6500')
    expect(escaparCuringasLike('a_b')).toBe('ab')
  })
})
