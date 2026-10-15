import { describe, expect, it } from 'vitest'
import {
  listarPaginasVinculaveis,
  montarPaginasPermitidasParaUsuario,
} from './registro-de-paginas.js'

describe('montarPaginasPermitidasParaUsuario', () => {
  it('preserva Contas na sessão sem liberar Configurações ao perfil restrito', () => {
    const paginas = montarPaginasPermitidasParaUsuario(false, ['contas'])
    expect(paginas).toEqual([expect.objectContaining({
      chave: 'contas',
      caminho: '/configuracoes?aba=financeiro&secao=contas',
      exibirNoMenu: false,
    })])
    expect(listarPaginasVinculaveis().some((p) => p.chave === 'contas')).toBe(true)
  })

  it('preserva Contas para admin e não a concede a quem tem apenas Configurações', () => {
    expect(montarPaginasPermitidasParaUsuario(true, []).some((p) => p.chave === 'contas')).toBe(true)
    expect(montarPaginasPermitidasParaUsuario(false, ['configuracoes']).some((p) => p.chave === 'contas')).toBe(false)
  })
  it('não-admin usa apenas telas dos papéis', () => {
    const paginas = montarPaginasPermitidasParaUsuario(false, ['entrada-notas'])
    const chaves = paginas.map((p) => p.chave)
    expect(chaves).toEqual(['entrada-notas'])
  })

  it('quem só tem Requisições também vê Separação de pedidos', () => {
    const paginas = montarPaginasPermitidasParaUsuario(false, ['requisicoes'])
    const chaves = paginas.map((p) => p.chave)

    expect(chaves).toContain('requisicoes')
    expect(chaves).toContain('separacao')
  })

  it('não mostra Estrutura WMS nem para admin', () => {
    const paginas = montarPaginasPermitidasParaUsuario(true, [])
    expect(paginas.some((p) => p.chave === 'estrutura-wms')).toBe(false)
    expect(paginas.some((p) => p.chave === 'configuracoes')).toBe(true)
  })

  it('não lista Usuários nem Papéis no menu e mantém Aprovação de clientes', () => {
    const paginas = montarPaginasPermitidasParaUsuario(true, [])
    const chaves = paginas.map((p) => p.chave)

    expect(chaves).not.toContain('usuarios')
    expect(chaves).not.toContain('papeis')
    expect(chaves).toContain('clientes-aprovacao')
    expect(chaves).toContain('configuracoes')
  })

  it('rótulo do item cadastros no menu é Empresas', () => {
    const pagina = listarPaginasVinculaveis().find((p) => p.chave === 'cadastros')
    expect(pagina?.rotulo).toBe('Empresas')
  })

  it('admin vê Orçamentos; lista explícita de telas define menu do não-admin', () => {
    const admin = montarPaginasPermitidasParaUsuario(true, []).map((p) => p.chave)
    const comprador = montarPaginasPermitidasParaUsuario(false, [
      'pedidos-compra',
      'entrada-notas',
    ]).map((p) => p.chave)

    expect(admin).toContain('orcamentos')
    expect(admin).toContain('pedidos-venda')
    expect(comprador).toContain('pedidos-compra')
    expect(comprador).toContain('entrada-notas')
    expect(comprador).not.toContain('orcamentos')
  })
})
