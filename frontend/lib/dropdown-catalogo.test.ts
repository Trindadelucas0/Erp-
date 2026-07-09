import { describe, expect, it } from 'vitest'
import { elementoEstaNaZona } from './dropdown-catalogo'

describe('elementoEstaNaZona', () => {
  it('retorna true quando o alvo está dentro da ref', () => {
    const container = document.createElement('div')
    const input = document.createElement('input')
    container.appendChild(input)
    document.body.appendChild(container)

    const ref = { current: container }
    expect(elementoEstaNaZona([ref], input)).toBe(true)

    document.body.removeChild(container)
  })

  it('retorna false quando o alvo está fora da ref', () => {
    const container = document.createElement('div')
    const fora = document.createElement('button')
    document.body.appendChild(container)
    document.body.appendChild(fora)

    const ref = { current: container }
    expect(elementoEstaNaZona([ref], fora)).toBe(false)

    document.body.removeChild(container)
    document.body.removeChild(fora)
  })

  it('retorna true quando o alvo está em qualquer ref informada', () => {
    const container = document.createElement('div')
    const lista = document.createElement('ul')
    const item = document.createElement('li')
    lista.appendChild(item)
    document.body.appendChild(container)
    document.body.appendChild(lista)

    expect(
      elementoEstaNaZona([{ current: container }, { current: lista }], item)
    ).toBe(true)

    document.body.removeChild(container)
    document.body.removeChild(lista)
  })
})
