import { describe, expect, it } from 'vitest'
import { haEnderecoEstoqueDuplicado } from './enderecos-estoque-produto'

describe('haEnderecoEstoqueDuplicado', () => {
  it('ignora linhas vazias', () => {
    expect(haEnderecoEstoqueDuplicado([{ endereco: '' }, { endereco: '  ' }])).toBe(false)
  })

  it('detecta o mesmo código em duas linhas', () => {
    expect(
      haEnderecoEstoqueDuplicado([
        { endereco: 'A-RC-20-01-2-05' },
        { endereco: 'a-rc-20-01-2-05' },
      ])
    ).toBe(true)
  })
})
