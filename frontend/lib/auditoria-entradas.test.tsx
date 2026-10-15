import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import Pagina from '@/app/auditoria-entradas/page'

const mocks = vi.hoisted(() => ({ get: vi.fn(), push: vi.fn() }))
vi.mock('@/services/api', () => ({ clienteHttp: { get: mocks.get } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('@/components/compartilhado/proteger-rota', () => ({ ProtegerRota: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('@/components/ui/grade-rolavel', () => ({ GradeRolavel: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))

describe('auditoria pendente e concluída', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const base = { tipoDocumento: 'nfe55', statusEntrada: 'entrada_consolidada', valorTotal: 10, dataEmissao: null, chaveNfe: '123' }
    mocks.get.mockResolvedValue({ data: { notas: [
      { ...base, id: 'r', nomeEmitente: 'Revenda', finalidadeEntrada: 'revenda' },
      { ...base, id: 'u', nomeEmitente: 'Consumo', finalidadeEntrada: 'uso_consumo' },
      { ...base, id: 's', nomeEmitente: 'Serviço', tipoDocumento: 'nfse' },
      { ...base, id: 'c', nomeEmitente: 'Frete', tipoDocumento: 'cte' },
      { ...base, id: 'a', nomeEmitente: 'Concluída', auditadaEm: '2026-10-14T12:00:00Z', auditadaPorNome: 'Gustavo' },
    ] } })
  })
  it('inclui uso/serviço, exclui CT-e e mostra precificar apenas para revenda', async () => {
    render(<Pagina />)
    expect(await screen.findByText('Serviço')).toBeTruthy()
    expect(screen.getByText('Consumo')).toBeTruthy()
    expect(screen.queryByText('Frete')).toBeNull()
    expect(screen.queryByText('Concluída')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Precificar' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Precificar' }))
    expect(mocks.push).toHaveBeenCalledWith('/auditoria-entradas/r/precificacao')
    expect(mocks.push).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Concluídas' }))
    expect(screen.getByText('Concluída')).toBeTruthy()
    expect(screen.getByText('Gustavo')).toBeTruthy()
    expect(screen.queryByText('Consumo')).toBeNull()
  })
})
