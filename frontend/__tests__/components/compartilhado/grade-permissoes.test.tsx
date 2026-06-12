import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GradePermissoes } from '@/components/compartilhado/grade-permissoes'
import type { Permissao } from '@/components/compartilhado/grade-permissoes'

const permissoesTeste: Permissao[] = [
  { id: 'p1', module: 'clientes', action: 'view', key: 'clientes:view' },
  { id: 'p2', module: 'clientes', action: 'create', key: 'clientes:create' },
  { id: 'p3', module: 'clientes', action: 'edit', key: 'clientes:edit' },
  { id: 'p4', module: 'clientes', action: 'delete', key: 'clientes:delete' },
  { id: 'p5', module: 'cadastros', action: 'view', key: 'cadastros:view' },
  { id: 'p6', module: 'cadastros', action: 'create', key: 'cadastros:create' },
]

describe('GradePermissoes', () => {
  it('renderiza cabeçalhos da tabela', () => {
    render(
      <GradePermissoes
        listaDePermissoes={permissoesTeste}
        idsSelecionados={[]}
        aoAlterar={vi.fn()}
      />
    )
    expect(screen.getByText('Módulo')).toBeInTheDocument()
    expect(screen.getByText('Ver')).toBeInTheDocument()
    expect(screen.getByText('Criar')).toBeInTheDocument()
    expect(screen.getByText('Editar')).toBeInTheDocument()
    expect(screen.getByText('Excluir')).toBeInTheDocument()
  })

  it('renderiza rótulos dos módulos em português', () => {
    render(
      <GradePermissoes
        listaDePermissoes={permissoesTeste}
        idsSelecionados={[]}
        aoAlterar={vi.fn()}
      />
    )
    expect(screen.getByText('Clientes')).toBeInTheDocument()
    expect(screen.getByText('Cadastros')).toBeInTheDocument()
  })

  it('exibe checkboxes marcados para ids selecionados', () => {
    render(
      <GradePermissoes
        listaDePermissoes={permissoesTeste}
        idsSelecionados={['p1', 'p5']}
        aoAlterar={vi.fn()}
      />
    )
    const checkboxes = screen.getAllByRole('checkbox')
    // O componente usa button[role=checkbox] com aria-checked e data-state
    const marcados = checkboxes.filter(
      (cb) =>
        cb.getAttribute('aria-checked') === 'true' ||
        cb.getAttribute('data-state') === 'checked'
    )
    expect(marcados).toHaveLength(2)
  })

  it('chama aoAlterar ao clicar em checkbox não marcado', () => {
    const aoAlterar = vi.fn()
    render(
      <GradePermissoes
        listaDePermissoes={permissoesTeste}
        idsSelecionados={[]}
        aoAlterar={aoAlterar}
      />
    )
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    expect(aoAlterar).toHaveBeenCalledTimes(1)
  })

  it('não chama aoAlterar quando desabilitado', () => {
    const aoAlterar = vi.fn()
    render(
      <GradePermissoes
        listaDePermissoes={permissoesTeste}
        idsSelecionados={[]}
        aoAlterar={aoAlterar}
        desabilitado={true}
      />
    )
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    expect(aoAlterar).not.toHaveBeenCalled()
  })

  it('renderiza separador para combinações módulo+ação inexistentes', () => {
    // clientes tem view, create, edit, delete mas cadastros só tem view e create
    // logo cadastros:edit e cadastros:delete devem mostrar '-'
    render(
      <GradePermissoes
        listaDePermissoes={permissoesTeste}
        idsSelecionados={[]}
        aoAlterar={vi.fn()}
      />
    )
    // o componente usa '-' (hífen) para ações indisponíveis
    const separadores = screen.getAllByText('-')
    expect(separadores.length).toBeGreaterThan(0)
  })

  it('renderiza corretamente com lista vazia', () => {
    render(
      <GradePermissoes
        listaDePermissoes={[]}
        idsSelecionados={[]}
        aoAlterar={vi.fn()}
      />
    )
    expect(screen.getByText('Módulo')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
