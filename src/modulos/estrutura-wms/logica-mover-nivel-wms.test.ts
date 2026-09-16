import { describe, expect, it } from 'vitest'
import { paiAposMovimento, validarMovimento } from './logica-mover-nivel-wms.js'

describe('validarMovimento', () => {
  it('permite reordenar irmãos do mesmo nível', () => {
    expect(
      validarMovimento({
        arrastadoId: 'a',
        alvoId: 'b',
        posicao: 'depois',
        nivelArrastado: 'rua',
        nivelAlvo: 'rua',
        idsSubarvore: new Set(['a']),
      })
    ).toBeNull()
  })

  it('permite aninhar só no nível seguinte', () => {
    expect(
      validarMovimento({
        arrastadoId: 'rua-1',
        alvoId: 'area-1',
        posicao: 'dentro',
        nivelArrastado: 'rua',
        nivelAlvo: 'area',
        idsSubarvore: new Set(['rua-1']),
      })
    ).toBeNull()
    expect(
      validarMovimento({
        arrastadoId: 'rua-1',
        alvoId: 'local-1',
        posicao: 'dentro',
        nivelArrastado: 'rua',
        nivelAlvo: 'local',
        idsSubarvore: new Set(['rua-1']),
      })
    ).toBe('Só é possível aninhar no nível seguinte da hierarquia')
  })

  it('recusa mover para a própria subárvore', () => {
    expect(
      validarMovimento({
        arrastadoId: 'area-1',
        alvoId: 'rua-1',
        posicao: 'depois',
        nivelArrastado: 'area',
        nivelAlvo: 'rua',
        idsSubarvore: new Set(['area-1', 'rua-1']),
      })
    ).toBe('Não é possível mover um item para dentro da própria subárvore')
  })
})

describe('paiAposMovimento', () => {
  it('dentro usa o alvo como pai', () => {
    expect(paiAposMovimento({ posicao: 'dentro', alvoParentId: 'x', alvoId: 'area-1' })).toBe(
      'area-1'
    )
  })
  it('depois mantém o pai do alvo', () => {
    expect(paiAposMovimento({ posicao: 'depois', alvoParentId: 'local-1', alvoId: 'area-2' })).toBe(
      'local-1'
    )
  })
})
