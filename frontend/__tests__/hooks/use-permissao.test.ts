import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePermissao } from '@/hooks/use-permissao'

vi.mock('@/components/compartilhado/sessao-do-usuario', () => ({
  useSessaoDoUsuario: vi.fn(),
}))

import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'

function mockPerfil(overrides: {
  ehAdmin?: boolean
  permissoesEfetivas?: string[]
} | null) {
  vi.mocked(useSessaoDoUsuario).mockReturnValue({
    perfil: overrides
      ? {
          ehAdmin: overrides.ehAdmin ?? false,
          permissoesEfetivas: overrides.permissoesEfetivas ?? [],
          usuario: { id: 'u1', name: 'Teste', email: 't@t.com', active: true },
          paginasPermitidas: [],
          empresas: [],
        }
      : null,
    estaAutenticado: overrides !== null,
    carregando: false,
    recarregar: vi.fn(),
    fazerLogout: vi.fn(),
  } as never)
}

describe('usePermissao', () => {
  it('retorna false quando não há perfil (não logado)', () => {
    mockPerfil(null)
    const { result } = renderHook(() => usePermissao('clientes:view'))
    expect(result.current).toBe(false)
  })

  it('retorna true para qualquer permissão quando usuário é admin', () => {
    mockPerfil({ ehAdmin: true, permissoesEfetivas: [] })

    const { result: r1 } = renderHook(() => usePermissao('clientes:delete'))
    expect(r1.current).toBe(true)

    const { result: r2 } = renderHook(() => usePermissao('configuracoes:delete'))
    expect(r2.current).toBe(true)
  })

  it('retorna true quando permissão específica está nas permissões efetivas', () => {
    mockPerfil({
      ehAdmin: false,
      permissoesEfetivas: ['clientes:view', 'cadastros:view'],
    })

    const { result } = renderHook(() => usePermissao('clientes:view'))
    expect(result.current).toBe(true)
  })

  it('retorna false quando permissão não está nas permissões efetivas', () => {
    mockPerfil({
      ehAdmin: false,
      permissoesEfetivas: ['clientes:view'],
    })

    const { result } = renderHook(() => usePermissao('clientes:delete'))
    expect(result.current).toBe(false)
  })

  it('retorna false para permissão desconhecida de usuário não-admin', () => {
    mockPerfil({ ehAdmin: false, permissoesEfetivas: [] })

    const { result } = renderHook(() => usePermissao('modulo-fantasma:view'))
    expect(result.current).toBe(false)
  })

  it('não-admin com lista vazia de permissões retorna false para tudo', () => {
    mockPerfil({ ehAdmin: false, permissoesEfetivas: [] })

    const permissoes = [
      'clientes:view', 'clientes:create', 'clientes:edit', 'clientes:delete',
      'cadastros:view', 'configuracoes:delete',
    ]

    for (const perm of permissoes) {
      const { result } = renderHook(() => usePermissao(perm))
      expect(result.current).toBe(false)
    }
  })
})
