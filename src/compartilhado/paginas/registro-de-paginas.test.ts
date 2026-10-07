import { describe, expect, it } from 'vitest'
import {
  listarPaginasVinculaveis,
  montarPaginasPermitidasParaUsuario,
} from './registro-de-paginas.js'

describe('montarPaginasPermitidasParaUsuario', () => {
  it('não lista Estrutura WMS no menu e injeta Configurações para estoque:view', () => {
    const paginas = montarPaginasPermitidasParaUsuario(false, [], ['estoque:view'])
    const chaves = paginas.map((p) => p.chave)

    expect(chaves).not.toContain('estrutura-wms')
    expect(chaves).toContain('configuracoes')
    expect(chaves).toContain('enderecos-wms')
    expect(chaves).toContain('estoque')
    expect(chaves).toContain('requisicoes')
    expect(chaves).toContain('guardar-mercadorias')
    expect(chaves).toContain('separacao')
  })

  it('quem só tem a página Requisições também vê Separação de pedidos', () => {
    const paginas = montarPaginasPermitidasParaUsuario(false, ['requisicoes'], [])
    const chaves = paginas.map((p) => p.chave)

    expect(chaves).toContain('requisicoes')
    expect(chaves).toContain('separacao')
  })

  it('não mostra Estrutura WMS nem para admin', () => {
    const paginas = montarPaginasPermitidasParaUsuario(true, [], [])
    expect(paginas.some((p) => p.chave === 'estrutura-wms')).toBe(false)
    expect(paginas.some((p) => p.chave === 'configuracoes')).toBe(true)
  })

  it('não lista Usuários nem Papéis no menu e mantém Aprovação de clientes', () => {
    const paginas = montarPaginasPermitidasParaUsuario(true, [], [])
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

  it('admin e financeiro:view veem Contas; estoque:view não', () => {
    const admin = montarPaginasPermitidasParaUsuario(true, [], []).map((p) => p.chave)
    const financeiro = montarPaginasPermitidasParaUsuario(false, [], ['financeiro:view']).map(
      (p) => p.chave
    )
    const estoque = montarPaginasPermitidasParaUsuario(false, [], ['estoque:view']).map(
      (p) => p.chave
    )

    expect(admin).toContain('contas')
    expect(financeiro).toContain('contas')
    expect(estoque).not.toContain('contas')
  })

  it('papel comprador vê Pedidos e Entrada sem Auditoria nem Pendências', () => {
    const paginas = montarPaginasPermitidasParaUsuario(
      false,
      [],
      ['compras:view', 'compras:create', 'compras:edit'],
      [{ nome: 'comprador' }]
    )
    const chaves = paginas.map((p) => p.chave)

    expect(chaves).toContain('pedidos-compra')
    expect(chaves).toContain('entrada-notas')
    expect(chaves).not.toContain('auditoria-entradas')
    expect(chaves).not.toContain('contagens')
    expect(chaves).not.toContain('pendencias')
    expect(chaves).not.toContain('configuracoes')
  })

  it('papel administrativo vê só Entrada de notas', () => {
    const paginas = montarPaginasPermitidasParaUsuario(false, [], [], [
      { nome: 'administrativo' },
    ])
    const chaves = paginas.map((p) => p.chave)

    expect(chaves).toEqual(['entrada-notas'])
  })

  it('papel logistica vê grupo Logística sem Configurações', () => {
    const paginas = montarPaginasPermitidasParaUsuario(
      false,
      [],
      ['estoque:view', 'estoque:create', 'estoque:edit'],
      [{ nome: 'logistica' }]
    )
    const chaves = paginas.map((p) => p.chave)

    expect(chaves).toContain('contagens')
    expect(chaves).toContain('estoque')
    expect(chaves).toContain('enderecos-wms')
    expect(chaves).toContain('requisicoes')
    expect(chaves).toContain('guardar-mercadorias')
    expect(chaves).toContain('separacao')
    expect(chaves).not.toContain('configuracoes')
    expect(chaves).not.toContain('pendencias')
  })

  it('admin vê Orçamentos e usuário sem a página não', () => {
    const admin = montarPaginasPermitidasParaUsuario(true, [], []).map((p) => p.chave)
    const estoque = montarPaginasPermitidasParaUsuario(false, [], ['estoque:view']).map((p) => p.chave)

    expect(admin).toContain('orcamentos')
    expect(estoque).not.toContain('orcamentos')

    const vendedor = montarPaginasPermitidasParaUsuario(false, [], ['vendas:view']).map((p) => p.chave)
    expect(vendedor).toContain('orcamentos')
    expect(vendedor).toContain('receber-pagamento')
    expect(listarPaginasVinculaveis().find((p) => p.chave === 'orcamentos')?.modulo).toBe('vendas')
    expect(listarPaginasVinculaveis().find((p) => p.chave === 'receber-pagamento')?.rotulo).toBe(
      'Receber pagamento'
    )
  })
})
