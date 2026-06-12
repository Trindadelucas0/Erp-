import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from '@/components/ui/modal'

describe('Modal', () => {
  it('não renderiza nada quando aberto=false', () => {
    render(
      <Modal aberto={false} aoFechar={vi.fn()} titulo="Teste">
        <p>Conteúdo</p>
      </Modal>
    )
    expect(screen.queryByText('Teste')).not.toBeInTheDocument()
    expect(screen.queryByText('Conteúdo')).not.toBeInTheDocument()
  })

  it('renderiza título quando aberto=true', () => {
    render(
      <Modal aberto={true} aoFechar={vi.fn()} titulo="Meu Modal">
        <p>Corpo do modal</p>
      </Modal>
    )
    expect(screen.getByText('Meu Modal')).toBeInTheDocument()
  })

  it('renderiza o conteúdo filho quando aberto', () => {
    render(
      <Modal aberto={true} aoFechar={vi.fn()} titulo="Modal">
        <p data-testid="corpo">Conteúdo interno</p>
      </Modal>
    )
    expect(screen.getByTestId('corpo')).toBeInTheDocument()
    expect(screen.getByText('Conteúdo interno')).toBeInTheDocument()
  })

  it('renderiza descrição quando fornecida', () => {
    render(
      <Modal
        aberto={true}
        aoFechar={vi.fn()}
        titulo="Modal"
        descricao="Descrição do modal"
      >
        <span />
      </Modal>
    )
    expect(screen.getByText('Descrição do modal')).toBeInTheDocument()
  })

  it('não renderiza descrição quando não fornecida', () => {
    render(
      <Modal aberto={true} aoFechar={vi.fn()} titulo="Modal Sem Descrição">
        <span />
      </Modal>
    )
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument()
  })

  it('chama aoFechar ao clicar no botão X', () => {
    const aoFechar = vi.fn()
    render(
      <Modal aberto={true} aoFechar={aoFechar} titulo="Modal">
        <span />
      </Modal>
    )
    fireEvent.click(screen.getByRole('button', { name: /fechar/i }))
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it('chama aoFechar ao clicar no overlay (fora do modal)', () => {
    const aoFechar = vi.fn()
    const { container } = render(
      <Modal aberto={true} aoFechar={aoFechar} titulo="Modal">
        <span />
      </Modal>
    )
    // O overlay é o div com fixed inset-0
    const overlay = container.firstChild as HTMLElement
    fireEvent.click(overlay)
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it('não chama aoFechar ao clicar dentro do conteúdo', () => {
    const aoFechar = vi.fn()
    render(
      <Modal aberto={true} aoFechar={aoFechar} titulo="Modal">
        <button>Botão interno</button>
      </Modal>
    )
    fireEvent.click(screen.getByText('Botão interno'))
    expect(aoFechar).not.toHaveBeenCalled()
  })

  it('renderiza rodapé quando fornecido', () => {
    render(
      <Modal
        aberto={true}
        aoFechar={vi.fn()}
        titulo="Modal"
        rodape={<button>Salvar</button>}
      >
        <span />
      </Modal>
    )
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument()
  })
})
