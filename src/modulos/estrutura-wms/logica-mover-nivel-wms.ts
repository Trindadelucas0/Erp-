import type { NivelEstruturaWms } from './esquema-estrutura-wms.js'
import { FILHO_DO_NIVEL, PAI_DO_NIVEL } from '../enderecos-wms/nomenclatura-endereco-wms.js'

export type PosicaoMoverWms = 'antes' | 'depois' | 'dentro'

export function nivelFilhoLegal(nivelPai: string): NivelEstruturaWms | null {
  return FILHO_DO_NIVEL[nivelPai as NivelEstruturaWms] ?? null
}

export function podeSoltarDentro(nivelArrastado: string, nivelAlvo: string): boolean {
  return nivelFilhoLegal(nivelAlvo) === nivelArrastado
}

export function podeSoltarIrmao(nivelArrastado: string, nivelAlvo: string): boolean {
  return nivelArrastado === nivelAlvo
}

export function validarMovimento(params: {
  arrastadoId: string
  alvoId: string
  posicao: PosicaoMoverWms
  nivelArrastado: string
  nivelAlvo: string
  idsSubarvore: Set<string>
}): string | null {
  if (params.arrastadoId === params.alvoId) {
    return 'Não é possível mover um item para ele mesmo'
  }
  if (params.idsSubarvore.has(params.alvoId)) {
    return 'Não é possível mover um item para dentro da própria subárvore'
  }
  if (params.posicao === 'dentro') {
    if (!podeSoltarDentro(params.nivelArrastado, params.nivelAlvo)) {
      return 'Só é possível aninhar no nível seguinte da hierarquia'
    }
    return null
  }
  if (!podeSoltarIrmao(params.nivelArrastado, params.nivelAlvo)) {
    return 'Só é possível reordenar itens do mesmo nível'
  }
  return null
}

export function paiAposMovimento(params: {
  posicao: PosicaoMoverWms
  alvoParentId: string | null
  alvoId: string
}): string | null {
  if (params.posicao === 'dentro') return params.alvoId
  return params.alvoParentId
}

export { PAI_DO_NIVEL }
