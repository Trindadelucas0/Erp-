import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PerfilDoUsuario } from '@/types/sessao'

const estado = vi.hoisted(() => ({
  params: new URLSearchParams('aba=integracoes'),
  replace: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  perfil: null as PerfilDoUsuario | null,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: estado.replace }),
  useSearchParams: () => estado.params,
}))
vi.mock('@/components/compartilhado/sessao-do-usuario', () => ({
  useSessaoDoUsuario: () => ({ perfil: estado.perfil, carregando: false, estaAutenticado: true }),
}))
vi.mock('@/components/compartilhado/provedor-de-atalhos', () => ({ useAtalhos: () => ({}) }))
vi.mock('@/services/api', () => ({ clienteHttp: { get: estado.get, post: estado.post, put: estado.put, patch: estado.patch } }))
vi.mock('@/components/assinatura-zapsign/painel-configuracao-zapsign', () => ({ PainelConfiguracaoZapsign: () => <p>Painel ZapSign</p> }))
vi.mock('@/components/assinatura-zapsign/lista-documentos-zapsign', () => ({ ListaDocumentosZapsign: () => <p>Documentos protegidos</p> }))
vi.mock('@/components/compartilhado/portao-assinatura-com-senha', () => ({ PortaoAssinaturaComSenha: () => <p>Confirmar senha de administrador</p> }))
vi.mock('@/components/focus-nfe/painel-configuracao-focus-nfe', () => ({ PainelConfiguracaoFocusNfe: () => <p>Painel Focus</p> }))
vi.mock('@/components/parametros-boleto/painel-parametros-boleto', () => ({ PainelParametrosBoleto: () => <p>Painel Boleto</p> }))
vi.mock('@/components/configuracoes/painel-unidades-medida', () => ({ PainelUnidadesMedida: () => null }))
vi.mock('@/components/configuracoes/painel-parametrizacao-custos', () => ({ PainelParametrizacaoCustos: () => null }))
vi.mock('@/components/configuracoes/painel-tipos-veiculo', () => ({ PainelTiposVeiculo: () => null }))
vi.mock('@/components/configuracoes/painel-regras-fiscais', () => ({ PainelRegrasFiscais: () => null }))
vi.mock('@/app/estrutura-wms/conteudo-pagina-estrutura-wms', () => ({ ConteudoDaPaginaEstruturaWms: () => null }))
vi.mock('@/app/cfops/conteudo-pagina-cfops', () => ({ ConteudoDaPaginaCfops: () => null }))
vi.mock('@/app/planos-financeiros/conteudo-pagina-planos-financeiros', () => ({ ConteudoDaPaginaPlanosFinanceiros: () => null }))
vi.mock('@/components/recorrencias-financeiras/painel-recorrencias-financeiras', () => ({ PainelRecorrenciasFinanceiras: () => null }))
vi.mock('@/components/adquirentes/painel-adquirentes', () => ({ PainelAdquirentes: () => null }))
vi.mock('@/components/cartoes-pagamento/painel-cartoes-pagamento', () => ({ PainelCartoesPagamento: () => null }))
vi.mock('@/app/users/conteudo-pagina-usuarios', () => ({ ConteudoDaPaginaDeUsuarios: () => null }))
vi.mock('@/app/papeis/conteudo-pagina-papeis', () => ({ ConteudoDaPaginaDePapeis: () => null }))

import PaginaDeConfiguracoes from '@/app/configuracoes/page'
import PaginaContas from '@/app/contas/page'

const conta = {
  id: 'conta-1', nome: 'Caixa loja', tipo: 'caixa', ativo: true,
  banco: null, agencia: null, digitoAgencia: null, conta: null,
  digitoConta: null, limiteChequeEspecial: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  estado.params = new URLSearchParams('aba=financeiro&secao=contas')
  estado.perfil = {
    ehAdmin: false,
    usuario: { id: 'financeiro', name: 'Financeiro', email: 'financeiro@example.test', active: true },
    paginasPermitidas: [{ chave: 'contas', caminho: '/configuracoes?aba=financeiro&secao=contas', rotulo: 'Contas' }],
    permissoesEfetivas: ['financeiro:view'], empresas: [],
  }
  estado.get.mockImplementation((url: string) => Promise.resolve({ data:
    url === '/integracoes/bancos'
      ? { bancos: [{ code: '341', ispb: '60701190', name: 'ITAÚ', fullName: 'ITAÚ UNIBANCO S.A.', rotulo: '341 - ITAÚ' }] }
      : { contas: [conta] },
  }))
  estado.post.mockResolvedValue({ data: {} })
  estado.put.mockResolvedValue({ data: {} })
  estado.patch.mockResolvedValue({ data: {} })
})

afterEach(cleanup)

describe('Configurações — Contas', () => {
  it.each(['contas', 'planos', 'cartoes', 'invalida'])('perfil só de Contas não abre outras seções pela URL %s', async (secao) => {
    estado.params = new URLSearchParams(`aba=financeiro&secao=${secao}`)
    render(<PaginaDeConfiguracoes />)
    expect(await screen.findByText('Caixa loja')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Financeiro' })).toBeInTheDocument()
    for (const nome of ['Geral', 'Vendas', 'Logística', 'Fiscal', 'Integrações', 'Planos Financeiros', 'Recorrência', 'Adquirentes', 'Cartões de Pagamento']) {
      expect(screen.queryByRole('button', { name: nome })).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Nova conta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desativar' })).not.toBeInTheDocument()
  })

  it.each(['geral', 'integracoes', 'logistica', 'fiscal'])('perfil só de Contas permanece restrito ao forçar a aba %s', async (aba) => {
    estado.params = new URLSearchParams(`aba=${aba}`)
    render(<PaginaDeConfiguracoes />)
    expect(await screen.findByText('Caixa loja')).toBeInTheDocument()
    expect(screen.queryByText('Painel Boleto')).not.toBeInTheDocument()
    expect(screen.queryByText('Painel ZapSign')).not.toBeInTheDocument()
  })

  it('abre a mesma seção após recarga', async () => {
    const { unmount } = render(<PaginaDeConfiguracoes />)
    expect(await screen.findByText('Caixa loja')).toBeInTheDocument()
    unmount()
    render(<PaginaDeConfiguracoes />)
    expect(await screen.findByText('Caixa loja')).toBeInTheDocument()
  })

  it('admin acessa Contas e preserva as outras abas', async () => {
    estado.perfil!.ehAdmin = true
    estado.perfil!.paginasPermitidas = [{ chave: 'configuracoes', caminho: '/configuracoes', rotulo: 'Configurações' }]
    render(<PaginaDeConfiguracoes />)
    expect(await screen.findByText('Caixa loja')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nova conta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Integrações' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Planos Financeiros' })).toBeInTheDocument()
  })

  it('abre Contas por clique a partir de outra seção e acompanha a URL', async () => {
    estado.perfil!.ehAdmin = true
    estado.perfil!.paginasPermitidas.push({ chave: 'configuracoes', caminho: '/configuracoes', rotulo: 'Configurações' })
    estado.params = new URLSearchParams('aba=financeiro&secao=planos')
    const { rerender } = render(<PaginaDeConfiguracoes />)
    expect(estado.get).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Contas' }))
    expect(estado.replace).toHaveBeenCalledWith('/configuracoes?aba=financeiro&secao=contas')
    estado.params = new URLSearchParams('aba=financeiro&secao=contas')
    rerender(<PaginaDeConfiguracoes />)
    expect(await screen.findByText('Caixa loja')).toBeInTheDocument()
  })

  it('não libera outras configurações por permissões de módulo sem a página Configurações', async () => {
    estado.perfil!.permissoesEfetivas.push('configuracoes:view', 'produtos:view', 'estoque:view')
    render(<PaginaDeConfiguracoes />)
    expect(await screen.findByText('Caixa loja')).toBeInTheDocument()
    for (const nome of ['Geral', 'Logística', 'Fiscal', 'Integrações', 'Planos Financeiros']) {
      expect(screen.queryByRole('button', { name: nome })).not.toBeInTheDocument()
    }
  })

  it('preserva as abas restritas de Configurações e a autorização independente de Contas', async () => {
    estado.perfil!.paginasPermitidas.push({ chave: 'configuracoes', caminho: '/configuracoes', rotulo: 'Configurações' })
    estado.perfil!.abasPorPagina = { configuracoes: ['financeiro:cartoes'] }
    render(<PaginaDeConfiguracoes />)
    expect(await screen.findByText('Caixa loja')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cartões de Pagamento' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Planos Financeiros' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Recorrência' })).not.toBeInTheDocument()
  })

  it('perfil somente edição não recebe o botão Nova conta', async () => {
    estado.perfil!.permissoesEfetivas.push('financeiro:edit')
    render(<PaginaDeConfiguracoes />)
    await screen.findByText('Caixa loja')
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nova conta' })).not.toBeInTheDocument()
  })

  it('mostra lista vazia e mantém mensagem de falha no carregamento', async () => {
    estado.get.mockResolvedValueOnce({ data: { contas: [] } })
    render(<PaginaDeConfiguracoes />)
    expect(await screen.findByText('Nenhuma conta cadastrada.')).toBeInTheDocument()
    estado.get.mockRejectedValueOnce({})
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByText('Não foi possível carregar as contas')).toBeInTheDocument()
  })

  it('ativa uma conta inativa pela API existente', async () => {
    estado.perfil!.permissoesEfetivas.push('financeiro:edit')
    estado.get.mockResolvedValueOnce({ data: { contas: [{ ...conta, ativo: false }] } })
    render(<PaginaDeConfiguracoes />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ativar' }))
    await waitFor(() => expect(estado.patch).toHaveBeenCalledWith('/contas/conta-1/ativo', { ativo: true }))
  })

  it('Configurações sem a chave Contas não expõe o cadastro', () => {
    estado.perfil!.paginasPermitidas = [{ chave: 'configuracoes', caminho: '/configuracoes', rotulo: 'Configurações' }]
    render(<PaginaDeConfiguracoes />)
    expect(screen.queryByRole('button', { name: 'Contas' })).not.toBeInTheDocument()
    expect(screen.queryByText('Caixa loja')).not.toBeInTheDocument()
    expect(estado.get).not.toHaveBeenCalledWith('/contas', expect.anything())
  })

  it('chave Contas sem financeiro:view não expõe nem consulta o cadastro', () => {
    estado.perfil!.permissoesEfetivas = []
    render(<PaginaDeConfiguracoes />)
    expect(screen.queryByRole('button', { name: 'Contas' })).not.toBeInTheDocument()
    expect(estado.get).not.toHaveBeenCalled()
  })

  it('nega a página a um perfil sem Configurações nem Contas', () => {
    estado.perfil!.paginasPermitidas = []
    render(<PaginaDeConfiguracoes />)
    expect(estado.replace).toHaveBeenCalledWith('/inicio')
    expect(estado.get).not.toHaveBeenCalled()
  })

  it('busca contas na API existente', async () => {
    render(<PaginaDeConfiguracoes />)
    await screen.findByText('Caixa loja')
    fireEvent.change(screen.getByPlaceholderText('Buscar conta...'), { target: { value: 'Caixa loja' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(estado.get).toHaveBeenLastCalledWith('/contas', { params: { incluirInativos: true, q: 'Caixa loja' } })
  })

  it('cria Caixa só com nome e mantém os endpoints de edição e ativação', async () => {
    estado.perfil!.permissoesEfetivas.push('financeiro:create', 'financeiro:edit')
    render(<PaginaDeConfiguracoes />)
    await screen.findByText('Caixa loja')
    fireEvent.click(screen.getByRole('button', { name: 'Nova conta' }))
    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Caixa novo' } })
    fireEvent.click(screen.getByLabelText('Tipo *'))
    fireEvent.click(screen.getByRole('option', { name: 'Caixa' }))
    expect(screen.queryByLabelText('Agência *')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(estado.post).toHaveBeenCalledWith('/contas', { nome: 'Caixa novo', tipo: 'caixa', ativo: true }))
    await screen.findByText('Conta cadastrada.')
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Caixa editado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(estado.put).toHaveBeenCalledWith('/contas/conta-1', { nome: 'Caixa editado', tipo: 'caixa', ativo: true }))
    await screen.findByText('Conta atualizada.')
    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }))
    await waitFor(() => expect(estado.patch).toHaveBeenCalledWith('/contas/conta-1/ativo', { ativo: false }))
  })

  it('cria Bancária pelo seletor real de banco e fecha a lista ao retirar o mouse', async () => {
    estado.perfil!.permissoesEfetivas.push('financeiro:create')
    render(<PaginaDeConfiguracoes />)
    await screen.findByText('Caixa loja')
    fireEvent.click(screen.getByRole('button', { name: 'Nova conta' }))
    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Banco matriz' } })
    const banco = screen.getByLabelText('Banco *')
    await waitFor(() => expect(banco).not.toBeDisabled())
    fireEvent.click(banco)
    const buscaBanco = screen.getByPlaceholderText('Digite código ou nome...')
    fireEvent.change(buscaBanco, { target: { value: '341' } })
    fireEvent.click(screen.getByRole('button', { name: /341.*ITAÚ/ }))
    fireEvent.change(screen.getByLabelText('Agência *'), { target: { value: '1234' } })
    fireEvent.change(screen.getByLabelText('CC *'), { target: { value: '98765' } })
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Dígito conta *'), { target: { value: 'X' } })
    fireEvent.click(screen.getByLabelText('Banco *'))
    const campoBanco = screen.getByPlaceholderText('Digite código ou nome...')
    fireEvent.mouseLeave(campoBanco.parentElement!)
    await waitFor(() => expect(screen.queryByPlaceholderText('Digite código ou nome...')).not.toBeInTheDocument())
    expect(screen.getByLabelText('Nome *')).toHaveValue('Banco matriz')
    expect(screen.getByLabelText('Agência *')).toHaveValue('1234')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(estado.post).toHaveBeenCalledWith('/contas', expect.objectContaining({
      nome: 'Banco matriz', tipo: 'bancaria', banco: '341 - ITAÚ', agencia: '1234', conta: '98765', digitoConta: 'X',
    })))
  })
})

describe('/contas legado', () => {
  it('redireciona para a seção de Contas', () => {
    render(<PaginaContas />)
    expect(estado.replace).toHaveBeenCalledWith('/configuracoes?aba=financeiro&secao=contas')
  })

  it('recusa perfil sem autorização para Contas', () => {
    estado.perfil!.paginasPermitidas = []
    render(<PaginaContas />)
    expect(estado.replace).toHaveBeenCalledWith('/inicio')
    expect(estado.replace).not.toHaveBeenCalledWith('/configuracoes?aba=financeiro&secao=contas')
  })
})

