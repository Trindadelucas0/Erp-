import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PerfilDoUsuario } from '@/types/sessao'

const estado = vi.hoisted(() => ({
  params: new URLSearchParams('aba=integracoes'),
  replace: vi.fn(),
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
vi.mock('@/services/api', () => ({ clienteHttp: { get: vi.fn().mockResolvedValue({ data: [] }) } }))
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

beforeEach(() => {
  estado.replace.mockClear()
  estado.params = new URLSearchParams('aba=integracoes')
  estado.perfil = {
    ehAdmin: true,
    usuario: { id: 'admin', name: 'Admin', email: 'admin@example.test', active: true },
    paginasPermitidas: [{ chave: 'configuracoes', caminho: '/configuracoes', rotulo: 'Configurações' }],
    permissoesEfetivas: [], empresas: [],
  }
})
afterEach(cleanup)

describe('Configurações — Integrações', () => {
  it('mostra as três seções e seleciona Assinatura ao abrir sem seção', () => {
    render(<PaginaDeConfiguracoes />)
    const nomes = screen.getAllByRole('button').map((b) => b.textContent)
    expect(nomes).toContain('Integrações')
    expect(nomes.indexOf('Assinatura digital')).toBeLessThan(nomes.indexOf('Buscador de NF'))
    expect(nomes.indexOf('Buscador de NF')).toBeLessThan(nomes.indexOf('Boleto'))
    expect(screen.getByText('Painel ZapSign')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Documentos' }))
    expect(screen.getByText('Confirmar senha de administrador')).toBeInTheDocument()
    expect(screen.queryByText('Documentos protegidos')).not.toBeInTheDocument()
  })

  it.each(['assinatura', 'buscador', 'boleto'])('abre seção %s pela URL e após recarga', (secao) => {
    estado.params = new URLSearchParams(`aba=integracoes&secao=${secao}`)
    const texto = { assinatura: 'Painel ZapSign', buscador: 'Painel Focus', boleto: 'Painel Boleto' }[secao]!
    const { unmount } = render(<PaginaDeConfiguracoes />)
    expect(screen.getByText(texto)).toBeInTheDocument()
    unmount()
    render(<PaginaDeConfiguracoes />)
    expect(screen.getByText(texto)).toBeInTheDocument()
  })

  it.each([['geral', 'assinatura'], ['fiscal', 'buscador'], ['financeiro', 'boleto']])(
    'normaliza link antigo %s/%s preservando parâmetros', (aba, secao) => {
      estado.params = new URLSearchParams(`aba=${aba}&secao=${secao}&extra=preservado`)
      render(<PaginaDeConfiguracoes />)
      expect(estado.replace).toHaveBeenCalledWith(`/configuracoes?aba=integracoes&secao=${secao}&extra=preservado`)
    },
  )

  it('troca seção por clique e acompanha mudanças da URL', () => {
    const { rerender } = render(<PaginaDeConfiguracoes />)
    fireEvent.click(screen.getByRole('button', { name: 'Boleto' }))
    expect(estado.replace).toHaveBeenCalledWith('/configuracoes?aba=integracoes&secao=boleto')
    estado.params = new URLSearchParams('aba=integracoes&secao=boleto')
    rerender(<PaginaDeConfiguracoes />)
    expect(screen.getByText('Painel Boleto')).toBeInTheDocument()
    estado.params = new URLSearchParams('aba=integracoes&secao=assinatura')
    rerender(<PaginaDeConfiguracoes />)
    expect(screen.getByText('Painel ZapSign')).toBeInTheDocument()
  })

  it.each(['assinatura', 'buscador', 'boleto', 'invalida'])('perfil restrito ao Boleto não abre %s sem permissão', (secao) => {
    estado.perfil!.ehAdmin = false
    estado.perfil!.permissoesEfetivas = ['financeiro:view']
    estado.perfil!.abasPorPagina = { configuracoes: ['financeiro:boleto'] }
    estado.params = new URLSearchParams(`aba=integracoes&secao=${secao}`)
    render(<PaginaDeConfiguracoes />)
    expect(screen.getByText('Painel Boleto')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Assinatura digital' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Buscador de NF' })).not.toBeInTheDocument()
    expect(screen.queryByText('Painel ZapSign')).not.toBeInTheDocument()
    expect(screen.queryByText('Painel Focus')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Financeiro' })).not.toBeInTheDocument()
  })

  it('oculta Integrações quando nenhuma seção é permitida', () => {
    estado.perfil!.ehAdmin = false
    estado.perfil!.permissoesEfetivas = ['financeiro:view']
    estado.perfil!.abasPorPagina = { configuracoes: ['fiscal:cfop'] }
    render(<PaginaDeConfiguracoes />)
    expect(screen.queryByRole('button', { name: 'Integrações' })).not.toBeInTheDocument()
    expect(screen.queryByText('Painel Boleto')).not.toBeInTheDocument()
  })

  it.each(['geral', 'fiscal', 'financeiro'])('remove as integrações do agrupamento %s', (aba) => {
    estado.params = new URLSearchParams(`aba=${aba}`)
    render(<PaginaDeConfiguracoes />)
    for (const nome of ['Assinatura digital', 'Buscador de NF', 'Boleto']) {
      expect(screen.queryByRole('button', { name: nome })).not.toBeInTheDocument()
    }
  })
})
