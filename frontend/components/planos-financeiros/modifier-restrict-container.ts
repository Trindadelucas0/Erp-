import type { Modifier } from '@dnd-kit/core'

export function criarRestrictToContainer(getContainer: () => HTMLElement | null): Modifier {
  return ({ transform, draggingNodeRect, activeNodeRect }) => {
    const container = getContainer()
    const rect = draggingNodeRect ?? activeNodeRect
    if (!container || !rect) return transform

    const bounds = container.getBoundingClientRect()
    const minX = bounds.left - rect.left
    const maxX = bounds.right - rect.right
    const minY = bounds.top - rect.top
    const maxY = bounds.bottom - rect.bottom

    return {
      ...transform,
      x: Math.min(Math.max(transform.x, minX), maxX),
      y: Math.min(Math.max(transform.y, minY), maxY),
    }
  }
}
