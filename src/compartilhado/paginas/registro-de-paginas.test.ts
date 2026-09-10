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
  })

  it('não mostra Estrutura WMS nem para admin', () => {
    const paginas = montarPaginasPermitidasParaUsuario(true, [], [])
    expect(paginas.some((p) => p.chave === 'estrutura-wms')).toBe(false)
    expect(paginas.some((p) => p.chave === 'configuracoes')).toBe(true)
  })

  it('rótulo do item cadastros no menu é Empresas', () => {
    const pagina = listarPaginasVinculaveis().find((p) => p.chave === 'cadastros')
    expect(pagina?.rotulo).toBe('Empresas')
  })
})
