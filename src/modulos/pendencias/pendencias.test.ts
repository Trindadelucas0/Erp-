import { describe, expect, it } from 'vitest'
import {
  adicionarDias,
  competenciaDeData,
  diasAteVencimento,
  inicioDoDia,
  isoDataLocal,
  urgenciaPorVencimento,
} from './datas-pendencias.js'
import { tiposParaTela } from './mapa-tela-pendencias.js'
import { ORDEM_URGENCIA } from './tipos-pendencias.js'

describe('datas-pendencias', () => {
  it('diasAteVencimento: negativo = vencido, 0 = hoje', () => {
    const hoje = inicioDoDia(new Date('2026-08-27T15:00:00'))
    expect(diasAteVencimento(new Date('2026-08-25T10:00:00'), hoje)).toBe(-2)
    expect(diasAteVencimento(new Date('2026-08-27T23:59:00'), hoje)).toBe(0)
    expect(diasAteVencimento(new Date('2026-08-30T08:00:00'), hoje)).toBe(3)
  })

  it('urgenciaPorVencimento: janela de 7 dias', () => {
    const hoje = inicioDoDia(new Date('2026-08-27T12:00:00'))
    expect(urgenciaPorVencimento(adicionarDias(hoje, -1), hoje)).toBe('vencido')
    expect(urgenciaPorVencimento(hoje, hoje)).toBe('hoje')
    expect(urgenciaPorVencimento(adicionarDias(hoje, 7), hoje)).toBe('semana')
    expect(urgenciaPorVencimento(adicionarDias(hoje, 8), hoje)).toBeNull()
  })

  it('isoDataLocal e competencia', () => {
    const d = inicioDoDia(new Date('2026-08-27T12:00:00'))
    expect(isoDataLocal(d)).toBe('2026-08-27')
    expect(competenciaDeData(d)).toBe('2026-08')
  })
})

describe('mapa-tela-pendencias', () => {
  it('mapeia rotas operacionais', () => {
    expect(tiposParaTela('/inicio')).toBe('global')
    expect(tiposParaTela('/contas-a-pagar')).toContain('conta_pagar_vencida')
    expect(tiposParaTela('/pedidos-compra/abc')).toContain('pedido_anexo')
    expect(tiposParaTela('/entrada-notas?painel=analise')).toContain(
      'fila_entrada_analise'
    )
    expect(tiposParaTela('/produtos')).toBeNull()
    expect(tiposParaTela('/pendencias')).toBeNull()
  })
})

describe('ordem urgencia', () => {
  it('vencido antes de fila', () => {
    expect(ORDEM_URGENCIA.vencido).toBeLessThan(ORDEM_URGENCIA.hoje)
    expect(ORDEM_URGENCIA.hoje).toBeLessThan(ORDEM_URGENCIA.semana)
    expect(ORDEM_URGENCIA.semana).toBeLessThan(ORDEM_URGENCIA.fila)
  })
})

describe('filtro permissao (contrato)', () => {
  it('financeiro nao inclui estoque_bloqueado no mapa de CAP', () => {
    const tipos = tiposParaTela('/contas-a-pagar')
    expect(tipos).not.toContain('estoque_bloqueado')
    expect(tipos).not.toContain('fila_entrada_analise')
  })

  it('limite 3 e ordenacao: vencido primeiro', () => {
    const itens = [
      { urgencia: 'fila' as const, id: 'a' },
      { urgencia: 'vencido' as const, id: 'b' },
      { urgencia: 'semana' as const, id: 'c' },
      { urgencia: 'hoje' as const, id: 'd' },
    ]
    const ordenados = [...itens].sort(
      (a, b) => ORDEM_URGENCIA[a.urgencia] - ORDEM_URGENCIA[b.urgencia]
    )
    expect(ordenados.slice(0, 3).map((i) => i.id)).toEqual(['b', 'd', 'c'])
  })
})
