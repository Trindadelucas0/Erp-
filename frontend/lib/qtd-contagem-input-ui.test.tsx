import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { textoQtdParaNumero } from '@/lib/qtd-contagem-input'

/** Espelha o padrão de rascunho usado em /contagens/[id]. */
function CampoQtdEntradaDemo({ inicial = 0 }: { inicial?: number }) {
  const [qtdContada, setQtdContada] = useState(inicial)
  const [rascunho, setRascunho] = useState<string | undefined>(undefined)

  return (
    <input
      type="number"
      aria-label="Qtd. Entrada"
      value={rascunho !== undefined ? rascunho : String(qtdContada)}
      onFocus={(e) => {
        setRascunho(rascunho !== undefined ? rascunho : String(qtdContada))
        e.target.select()
      }}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={(e) => {
        const valor = textoQtdParaNumero(e.target.value)
        setQtdContada(valor)
        setRascunho(undefined)
      }}
    />
  )
}

describe('Qtd. Entrada — rascunho permite apagar 0', () => {
  it('backspace no 0 deixa o campo em branco', async () => {
    const user = userEvent.setup()
    render(<CampoQtdEntradaDemo inicial={0} />)
    const input = screen.getByLabelText('Qtd. Entrada') as HTMLInputElement

    await user.click(input)
    await user.keyboard('{Backspace}')

    expect(input.value).toBe('')
  })

  it('digitar 54 a partir do vazio mostra 54', async () => {
    const user = userEvent.setup()
    render(<CampoQtdEntradaDemo inicial={0} />)
    const input = screen.getByLabelText('Qtd. Entrada') as HTMLInputElement

    await user.click(input)
    await user.keyboard('{Backspace}54')

    expect(input.value).toBe('54')
  })

  it('blur com vazio grava 0', async () => {
    const user = userEvent.setup()
    render(<CampoQtdEntradaDemo inicial={0} />)
    const input = screen.getByLabelText('Qtd. Entrada') as HTMLInputElement

    await user.click(input)
    await user.keyboard('{Backspace}')
    await user.tab()

    expect(input.value).toBe('0')
  })
})
