import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core'

export type PosicaoMoverPlano = 'antes' | 'depois' | 'dentro'

export type DicaDrop = {
  alvoId: string
  posicao: PosicaoMoverPlano
}

export type PreviewInsercao = {
  alvoId: string
  posicao: PosicaoMoverPlano
  indiceLista: number
  nivelPlaceholder: number
}

export type LinhaPlanaBase = {
  id: string
  codigo: string
  nome: string
  classificacao: string | null
  mostrarNaDre: boolean
  permiteLancamentoManual?: boolean
  exigeAnexoLancamento?: boolean
  permiteUsoConsumo?: boolean
  ativo: boolean
  nivel: number
  temFilhos: boolean
}

export type ItemListaRender =
  | { tipo: 'linha'; linha: LinhaPlanaBase }
  | { tipo: 'placeholder'; nivel: number }

export function calcularPosicaoDrop(evento: DragOverEvent | DragEndEvent): PosicaoMoverPlano {
  const rect = evento.over?.rect
  if (!rect) return 'dentro'

  const translated = evento.active.rect.current.translated
  const centroY = translated
    ? translated.top + translated.height / 2
    : rect.top + rect.height / 2

  const relY = centroY - rect.top
  const h = rect.height

  if (relY < h * 0.25) return 'antes'
  if (relY > h * 0.75) return 'depois'
  return 'dentro'
}

export function resolverDropPlano(
  posicao: PosicaoMoverPlano,
  alvo: LinhaPlanaBase,
  arrastando: LinhaPlanaBase
): { posicao: PosicaoMoverPlano; alvoId: string } | null {
  if (arrastando.nivel === 0) {
    if (alvo.nivel !== 0) return null
    if (posicao === 'dentro') {
      return { posicao: 'depois', alvoId: alvo.id }
    }
    return { posicao, alvoId: alvo.id }
  }

  if (alvo.nivel === 0) {
    return { posicao: 'dentro', alvoId: alvo.id }
  }

  if (posicao === 'dentro') {
    return { posicao: 'depois', alvoId: alvo.id }
  }

  return { posicao, alvoId: alvo.id }
}

export function calcularPreviewInsercao(
  linhas: LinhaPlanaBase[],
  arrastandoId: string | null,
  dicaDrop: DicaDrop | null
): PreviewInsercao | null {
  if (!arrastandoId || !dicaDrop) return null

  const idxAlvoOriginal = linhas.findIndex((l) => l.id === dicaDrop.alvoId)
  if (idxAlvoOriginal === -1) return null

  const linhaAlvo = linhas[idxAlvoOriginal]

  if (dicaDrop.posicao === 'antes') {
    return {
      alvoId: dicaDrop.alvoId,
      posicao: dicaDrop.posicao,
      indiceLista: idxAlvoOriginal,
      nivelPlaceholder: linhaAlvo.nivel,
    }
  }

  if (dicaDrop.posicao === 'depois') {
    return {
      alvoId: dicaDrop.alvoId,
      posicao: dicaDrop.posicao,
      indiceLista: idxAlvoOriginal + 1,
      nivelPlaceholder: linhaAlvo.nivel,
    }
  }

  return {
    alvoId: dicaDrop.alvoId,
    posicao: dicaDrop.posicao,
    indiceLista: idxAlvoOriginal + 1,
    nivelPlaceholder: linhaAlvo.nivel + 1,
  }
}

export function descricaoPreviewDrop(
  preview: PreviewInsercao,
  linhaArrastada: LinhaPlanaBase,
  linhas: LinhaPlanaBase[]
): { titulo: string; detalhe: string } {
  const linhaAlvo = linhas.find((l) => l.id === preview.alvoId)
  const alvoLabel = linhaAlvo ? `${linhaAlvo.codigo} - ${linhaAlvo.nome}` : preview.alvoId

  if (preview.posicao === 'antes') {
    return {
      titulo: `Antes de ${linhaAlvo?.codigo ?? preview.alvoId}`,
      detalhe: `${linhaArrastada.codigo} será reorganizado como irmão acima de ${alvoLabel}`,
    }
  }

  if (preview.posicao === 'depois') {
    return {
      titulo: `Depois de ${linhaAlvo?.codigo ?? preview.alvoId}`,
      detalhe: `${linhaArrastada.codigo} será reorganizado como irmão abaixo de ${alvoLabel}`,
    }
  }

  return {
    titulo: `Dentro de ${linhaAlvo?.codigo ?? preview.alvoId}`,
    detalhe: `${linhaArrastada.codigo} vira subgrupo de ${alvoLabel}`,
  }
}

export function montarLinhasComPreview(
  linhas: LinhaPlanaBase[],
  arrastandoId: string | null,
  preview: PreviewInsercao | null
): ItemListaRender[] {
  if (!arrastandoId || !preview) {
    return linhas.map((linha) => ({ tipo: 'linha', linha }))
  }

  const resultado: ItemListaRender[] = []

  for (let i = 0; i < linhas.length; i++) {
    if (preview.indiceLista === i) {
      resultado.push({ tipo: 'placeholder', nivel: preview.nivelPlaceholder })
    }
    resultado.push({ tipo: 'linha', linha: linhas[i] })
  }

  if (preview.indiceLista === linhas.length) {
    resultado.push({ tipo: 'placeholder', nivel: preview.nivelPlaceholder })
  }

  return resultado
}
