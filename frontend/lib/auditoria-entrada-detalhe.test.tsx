import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Pagina from '@/app/auditoria-entradas/[id]/page'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), push: vi.fn() }))
vi.mock('@/services/api', () => ({ clienteHttp: { get: mocks.get, post: mocks.post } }))
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'n1' }), useRouter: () => ({ push: mocks.push }) }))
vi.mock('@/components/compartilhado/proteger-rota', () => ({ ProtegerRota: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('@/components/ui/grade-rolavel', () => ({ GradeRolavel: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))

describe('concluir auditoria pelo detalhe', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/xml') ? {} : { nota: {
      id: 'n1', chaveNfe: '123', nomeEmitente: 'Fornecedor', tipoDocumento: 'nfse', finalidadeEntrada: null,
      statusEntrada: 'entrada_consolidada', auditadaEm: null, itens: [],
    } } }))
  })
  it('desabilita enquanto envia e volta a Pendentes após sucesso', async () => {
    let resolver!: () => void
    mocks.post.mockReturnValue(new Promise<void>((resolve) => { resolver = resolve }))
    render(<Pagina />)
    fireEvent.click(await screen.findByRole('button', { name: 'Auditada' }))
    expect(screen.getByRole('button', { name: 'Concluindo…' })).toBeDisabled()
    expect(mocks.post).toHaveBeenCalledWith('/entrada-notas/n1/auditar')
    expect(screen.queryByText('Precificar')).toBeNull()
    resolver()
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/auditoria-entradas'))
  })
  it('falha mantém detalhe aberto e permite tentar novamente', async () => {
    mocks.post.mockRejectedValue(new Error('falha'))
    render(<Pagina />)
    fireEvent.click(await screen.findByRole('button', { name: 'Auditada' }))
    await screen.findByText('falha')
    expect(screen.getByRole('button', { name: 'Auditada' })).not.toBeDisabled()
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
