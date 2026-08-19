import { describe, expect, it } from 'vitest'
import { decodificarEntidadesXml, decodificarTextoXml } from './entidades-xml.js'

describe('decodificarEntidadesXml', () => {
  it('converte &amp; em & no nome da empresa', () => {
    expect(decodificarEntidadesXml('POSTO &amp; MOTEL RODOBELO LTDA')).toBe(
      'POSTO & MOTEL RODOBELO LTDA'
    )
  })

  it('decodifica entidades nomeadas e numericas comuns', () => {
    expect(decodificarEntidadesXml('A &lt; B &gt; &quot;C&quot; &apos;D&apos;')).toBe('A < B > "C" \'D\'')
    expect(decodificarEntidadesXml('E &#38; F')).toBe('E & F')
    expect(decodificarEntidadesXml('G &#x26; H')).toBe('G & H')
  })

  it('nao altera texto sem entidade', () => {
    expect(decodificarEntidadesXml('FORNECEDOR SA')).toBe('FORNECEDOR SA')
    expect(decodificarTextoXml(null)).toBeNull()
  })
})
