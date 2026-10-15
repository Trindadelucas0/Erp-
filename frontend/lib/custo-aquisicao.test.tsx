import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PainelCustoAquisicao } from '@/components/entrada-notas/painel-custo-aquisicao'
import type { DadosFormacaoCusto, MemoriaCusto } from '@/lib/custo-aquisicao'
const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }))
vi.mock('@/services/api', () => ({ clienteHttp: mocks }))
const memoria: MemoriaCusto = { original: null, componentes: [], bruto: 100, desconto: 0, frete: 0, seguro: 0, outras: 0, despesasAdicionais: 0, tributosNaoRecuperaveis: 0, creditos: {}, quantidadeNf: 1, quantidadeVenda: 1, multiplicador: 1, total: 100, unitarioNf: 100, unitarioVenda: 100, pendencias: [] }
const grade: DadosFormacaoCusto = { revisaoCusto: 'revisao-atual', ajustesCusto: { decisaoFrete: null, bases: [], despesas: [] }, basesCusto: [], pendenciasCusto: [], residuaisCusto: [], itens: [{ itemId: 'i', nItem: 1, descricao: 'Produto', estadoCusto: 'previa', confirmacao: null, memoria }] }
describe('Formação de custo na Precificação', () => {
  beforeEach(() => vi.resetAllMocks())
  it('consulta histórico sem exigir permissão de editar; confirmação é restrita', async () => {
    mocks.get.mockResolvedValue({ data: { memorias: [] } })
    render(<PainelCustoAquisicao notaId="n" grade={grade} podeEditar={false} ocupado={false} aoAtualizar={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Confirmar custos válidos' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Histórico de memórias' }))
    expect(await screen.findByText('Nenhuma confirmação registrada.')).toBeTruthy()
  })
  it('confirma somente itens sem pendências e envia a revisão', async () => {
    const atualizar = vi.fn(); mocks.post.mockResolvedValue({ data: grade })
    render(<PainelCustoAquisicao notaId="n" grade={{ ...grade, itens: [...grade.itens, { ...grade.itens[0], itemId: 'j', nItem: 2, estadoCusto: 'pendente', memoria: { ...memoria, pendencias: ['Regra ausente'] } }] }} podeEditar ocupado={false} aoAtualizar={atualizar} />)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar custos válidos' }))
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/entrada-notas/n/precificacao/confirmar-custo', { revisao: 'revisao-atual', itemIds: ['i'] }))
    expect(atualizar).toHaveBeenCalledWith(grade)
  })
  it('cria despesa, simula sem salvar e preserva edição após conflito', async () => {
    mocks.post.mockResolvedValue({ data: { itens: [{ itemId: 'i', nItem: 1, memoria: { ...memoria, despesasAdicionais: 10.5, total: 110.5 } }] } })
    mocks.put.mockRejectedValue(new Error('O custo mudou'))
    render(<PainelCustoAquisicao notaId="n" grade={grade} podeEditar ocupado={false} aoAtualizar={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Despesas e rateio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nova despesa' }))
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Despesa adicional' } })
    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '10,50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar à lista' }))
    fireEvent.click(screen.getByRole('button', { name: 'Simular rateio' }))
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/entrada-notas/n/precificacao/ajustes/previa', expect.objectContaining({ ajustes: expect.objectContaining({ despesas: [expect.objectContaining({ descricao: 'Despesa adicional', valor: 10.5 })] }) })))
    expect(mocks.put).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar ajustes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('O custo mudou')
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByLabelText('Descrição')).toHaveValue('Despesa adicional')
    expect(screen.getByLabelText('Valor (R$)')).toHaveValue('10.5')
  })
  it('excluir despesa exige salvar antes de confirmar, sem apagar memória histórica', async () => {
    render(<PainelCustoAquisicao notaId="n" grade={{ ...grade, ajustesCusto: { ...grade.ajustesCusto, despesas: [{ id: 'd', descricao: 'Frete extra', valor: 10, compoeCusto: true, nItem: null, criterio: 'valor', origem: 'externa' }] } }} podeEditar ocupado={false} aoAtualizar={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Despesas e rateio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar custos válidos' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Salve os ajustes')
    expect(mocks.post).not.toHaveBeenCalled()
  })
  it('permite digitar peso e volume com vírgula sem perder o separador decimal', async () => {
    mocks.post.mockResolvedValue({ data: { itens: [] } })
    render(<PainelCustoAquisicao notaId="n" grade={grade} podeEditar ocupado={false} aoAtualizar={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Despesas e rateio' }))
    const peso = screen.getByLabelText('Peso total (kg) do item 1')
    fireEvent.change(peso, { target: { value: '1' } }); fireEvent.change(peso, { target: { value: '1,' } }); fireEvent.change(peso, { target: { value: '1,5' } })
    expect(peso).toHaveValue('1,5')
    fireEvent.click(screen.getByRole('button', { name: 'Simular rateio' }))
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/entrada-notas/n/precificacao/ajustes/previa', expect.objectContaining({ ajustes: expect.objectContaining({ bases: [{ nItem: 1, peso: 1.5, volume: null }] }) })))
  })
})
