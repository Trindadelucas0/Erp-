import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import Pagina from '@/app/auditoria-entradas/[id]/precificacao/page'
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'n' }) }))
vi.mock('@/components/compartilhado/proteger-rota', () => ({ ProtegerRota: ({ children }: { children: ReactNode }) => children }))
vi.mock('@/hooks/use-permissao', () => ({ usePermissao: () => true }))
const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }))
vi.mock('@/services/api', () => ({ clienteHttp: mocks }))
const memoria = { original: { seguro: 0, outras: 0 }, componentes: [], bruto: 100, desconto: 0, frete: 0, seguro: 0, outras: 0, despesasAdicionais: 0, tributosNaoRecuperaveis: 0, creditos: {}, quantidadeNf: 1, quantidadeVenda: 1, multiplicador: 1, total: 100, unitarioNf: 100, unitarioVenda: 100, pendencias: [] }
const item = { itemId: 'i1', nItem: 1, descricao: 'Produto', quantidade: 1, quantidadeVenda: 1, produtoId: 'p', produtoNome: 'Produto', sku: '001', vinculado: true, custoContabil: 100, custoTotal: 100, valorBruto: 100, valorDesconto: 0, freteAquisicao: 0, creditoIcms: 0, creditoIcmsFrete: 0, creditoPis: 0, creditoCofins: 0, tributosNaoRecuperaveis: 0, outrasDespesas: 0, despesasSeguro: 0, encargosPercentual: 0, vrAdicPercentual: 0, margemPercentual: 0, precoSugerido: 100, precoAtual: 90, memoria, estadoCusto: 'previa', confirmacao: null }
const grade = { nota: { id: 'n', chaveNfe: '', nomeEmitente: 'Fornecedor teste', dataEmissao: null }, revisaoCusto: 'r', regrasFiscais: { mercadoria: { modo: 'nota', aliquota: null }, transporte: { modo: 'nota', aliquota: null } }, ajustesCusto: { decisaoFrete: null, bases: [], despesas: [] }, basesCusto: [], residuaisCusto: [], pendenciasCusto: [], parametrizacaoCadastrada: true, parametrizacao: { totalVenda: 0 }, encargosPercentual: 0, itens: [item] }
describe('Grade de Precificação com confirmação de custo', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); mocks.get.mockResolvedValue({ data: grade }) })
  it('mantém a margem editada ao confirmar e preserva campos após 409 ao gravar', async () => {
    mocks.post.mockResolvedValue({ data: { ...grade, itens: [{ ...item, estadoCusto: 'confirmado', confirmacao: { usuarioNome: 'Operador', createdAt: '2026-10-14T12:00:00Z' } }] } })
    mocks.put.mockRejectedValue(new Error('O custo mudou'))
    render(<Pagina />)
    const margem = await screen.findByLabelText('Margem % do item 1')
    fireEvent.change(margem, { target: { value: '10' } })
    expect(screen.getByRole('button', { name: 'Gravar preços válidos' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar custos válidos' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Gravar preços válidos' })).not.toBeDisabled())
    expect(margem).toHaveValue('10')
    fireEvent.click(screen.getByRole('button', { name: 'Gravar preços válidos' }))
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/entrada-notas/n/precificacao', expect.objectContaining({ revisaoCusto: 'r', itens: [expect.objectContaining({ itemId: 'i1', produtoId: 'p', margemPercentual: 10 })] })))
    expect(await screen.findByText('O custo mudou')).toBeTruthy()
    expect(margem).toHaveValue('10')
  })
  it('produto repetido só grava a linha explicitamente selecionada', async () => {
    mocks.get.mockResolvedValue({ data: { ...grade, itens: [{ ...item, estadoCusto: 'confirmado' }, { ...item, itemId: 'i2', nItem: 2, estadoCusto: 'confirmado' }] } })
    mocks.put.mockResolvedValue({ data: grade })
    render(<Pagina />)
    const escolhas = await screen.findAllByLabelText('Usar esta linha para o preço')
    expect(screen.getByRole('button', { name: 'Gravar preços válidos' })).toBeDisabled()
    fireEvent.click(escolhas[1])
    fireEvent.click(screen.getByRole('button', { name: 'Gravar preços válidos' }))
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/entrada-notas/n/precificacao', expect.objectContaining({ itens: [expect.objectContaining({ itemId: 'i2' })] })))
  })
})
