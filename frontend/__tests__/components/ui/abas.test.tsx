import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Abas } from '@/components/ui/abas'

const abasTeste = [
  { id: 'dados', rotulo: 'Dados básicos' },
  { id: 'acesso', rotulo: 'Acesso' },
  { id: 'permissoes', rotulo: 'Permissões' },
]

describe('Abas', () => {
  it('renderiza todas as abas', () => {
    render(
      <Abas abas={abasTeste} abaAtiva="dados" aoMudar={vi.fn()} />
    )
    expect(screen.getByText('Dados básicos')).toBeInTheDocument()
    expect(screen.getByText('Acesso')).toBeInTheDocument()
    expect(screen.getByText('Permissões')).toBeInTheDocument()
  })

  it('aba ativa tem estilo de selecionada', () => {
    render(
      <Abas abas={abasTeste} abaAtiva="acesso" aoMudar={vi.fn()} />
    )
    const abaAtiva = screen.getByText('Acesso').closest('button')
    expect(abaAtiva?.className).toContain('text-primary')
  })

  it('abas inativas não têm estilo de selecionada', () => {
    render(
      <Abas abas={abasTeste} abaAtiva="dados" aoMudar={vi.fn()} />
    )
    const abaInativa = screen.getByText('Acesso').closest('button')
    expect(abaInativa?.className).toContain('text-muted-foreground')
    expect(abaInativa?.className).not.toContain('border-primary')
  })

  it('chama aoMudar com o id correto ao clicar', () => {
    const aoMudar = vi.fn()
    render(
      <Abas abas={abasTeste} abaAtiva="dados" aoMudar={aoMudar} />
    )
    fireEvent.click(screen.getByText('Permissões'))
    expect(aoMudar).toHaveBeenCalledWith('permissoes')
  })

  it('chama aoMudar ao clicar em qualquer aba', () => {
    const aoMudar = vi.fn()
    render(
      <Abas abas={abasTeste} abaAtiva="dados" aoMudar={aoMudar} />
    )
    fireEvent.click(screen.getByText('Acesso'))
    expect(aoMudar).toHaveBeenCalledWith('acesso')

    fireEvent.click(screen.getByText('Dados básicos'))
    expect(aoMudar).toHaveBeenCalledWith('dados')
  })

  it('renderiza contador quando fornecido e maior que zero', () => {
    const abasComContador = [
      { id: 'erros', rotulo: 'Erros', contador: 3 },
      { id: 'avisos', rotulo: 'Avisos', contador: 0 },
    ]
    render(
      <Abas abas={abasComContador} abaAtiva="erros" aoMudar={vi.fn()} />
    )
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('renderiza com lista vazia sem erros', () => {
    const { container } = render(
      <Abas abas={[]} abaAtiva="" aoMudar={vi.fn()} />
    )
    expect(container.firstChild).toBeInTheDocument()
  })
})
