import { describe, expect, it } from 'vitest'
import { GRUPOS_DO_MENU, montarEntradasDoMenu } from './menu-grupos'
import type { PaginaDoSistema } from '@/types/sessao'

const paginas: PaginaDoSistema[] = [
  { chave: 'pedidos-compra', caminho: '/pedidos-compra', rotulo: 'Pedidos de Compra' },
  { chave: 'entrada-notas', caminho: '/entrada-notas', rotulo: 'Entrada de Notas' },
  { chave: 'contagens', caminho: '/contagens', rotulo: 'Contagens de entrada' },
  { chave: 'auditoria-entradas', caminho: '/auditoria-entradas', rotulo: 'Auditoria de entradas' },
  { chave: 'estoque', caminho: '/estoque', rotulo: 'Estoque' },
  { chave: 'enderecos-wms', caminho: '/enderecos-wms', rotulo: 'Endereços WMS' },
  { chave: 'requisicoes', caminho: '/requisicoes', rotulo: 'Requisições' },
  { chave: 'guardar-mercadorias', caminho: '/guardar-mercadorias', rotulo: 'Guardar mercadorias' },
]

describe('GRUPOS_DO_MENU', () => {
  it('Logística agrupa contagens, estoque e endereços WMS', () => {
    const logistica = GRUPOS_DO_MENU.find((grupo) => grupo.id === 'logistica')
    expect(logistica?.rotulo).toBe('Logística')
    expect(logistica?.chaves).toEqual([
      'contagens',
      'estoque',
      'enderecos-wms',
      'requisicoes',
      'guardar-mercadorias',
    ])
  })

  it('Compras não contém contagens', () => {
    const compras = GRUPOS_DO_MENU.find((grupo) => grupo.id === 'compras')
    expect(compras?.chaves).toEqual(['pedidos-compra', 'entrada-notas', 'auditoria-entradas'])
    expect(compras?.chaves).not.toContain('contagens')
  })
})

describe('montarEntradasDoMenu', () => {
  it('monta Logística com os itens e Compras sem contagens', () => {
    const entradas = montarEntradasDoMenu(paginas)
    const compras = entradas.find((entrada) => entrada.tipo === 'grupo' && entrada.id === 'compras')
    const logistica = entradas.find(
      (entrada) => entrada.tipo === 'grupo' && entrada.id === 'logistica'
    )

    expect(compras?.tipo).toBe('grupo')
    expect(logistica?.tipo).toBe('grupo')
    if (compras?.tipo !== 'grupo' || logistica?.tipo !== 'grupo') return

    expect(compras.filhos.map((filho) => filho.chave)).toEqual([
      'pedidos-compra',
      'entrada-notas',
      'auditoria-entradas',
    ])
    expect(logistica.rotulo).toBe('Logística')
    expect(logistica.filhos.map((filho) => filho.chave)).toEqual([
      'contagens',
      'estoque',
      'enderecos-wms',
      'requisicoes',
      'guardar-mercadorias',
    ])
  })
})
