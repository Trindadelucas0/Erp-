const TECLAS_ESPECIAIS: Record<string, string> = {
  ' ': 'Space',
  Escape: 'Escape',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
}

export function normalizarTecla(tecla: string): string {
  const partes = tecla
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)

  const modificadores: string[] = []
  let principal = ''

  for (const parte of partes) {
    const lower = parte.toLowerCase()
    if (lower === 'ctrl' || lower === 'control') {
      modificadores.push('Ctrl')
    } else if (lower === 'alt') {
      modificadores.push('Alt')
    } else if (lower === 'shift') {
      modificadores.push('Shift')
    } else if (lower === 'meta' || lower === 'cmd') {
      modificadores.push('Meta')
    } else {
      principal = parte.length === 1 ? parte.toUpperCase() : parte
    }
  }

  if (!principal) return modificadores.join('+')

  if (principal.startsWith('F') && /^F\d+$/i.test(principal)) {
    principal = principal.toUpperCase()
  } else if (principal === 'Esc') {
    principal = 'Escape'
  }

  modificadores.sort()
  return [...modificadores, principal].join('+')
}

export function interpretarTecla(evento: KeyboardEvent): string {
  const partes: string[] = []

  if (evento.ctrlKey) partes.push('Ctrl')
  if (evento.altKey) partes.push('Alt')
  if (evento.shiftKey) partes.push('Shift')
  if (evento.metaKey) partes.push('Meta')

  let tecla = evento.key

  if (TECLAS_ESPECIAIS[tecla]) {
    tecla = TECLAS_ESPECIAIS[tecla]
  } else if (tecla.length === 1) {
    tecla = tecla.toUpperCase()
  } else if (/^F\d+$/i.test(tecla)) {
    tecla = tecla.toUpperCase()
  }

  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(tecla)) {
    partes.push(tecla)
  }

  return partes.join('+')
}

export function formatarTeclaParaExibicao(tecla: string): string {
  return tecla.replace('Escape', 'Esc')
}

export function elementoAceitaTexto(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false

  const tag = alvo.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (alvo.isContentEditable) return true

  return false
}

const EXCECOES_EM_CAMPO_DE_TEXTO = new Set(['Escape', 'F8', 'F1'])

export function deveIgnorarEmCampoDeTexto(
  teclaInterpretada: string,
  acao: string | undefined
): boolean {
  if (!acao) return true
  if (EXCECOES_EM_CAMPO_DE_TEXTO.has(teclaInterpretada)) return false
  if (acao === 'salvar' && teclaInterpretada === 'F8') return false
  if (acao === 'ajuda' && teclaInterpretada === 'F1') return false
  if (acao === 'cancelar' && teclaInterpretada === 'Escape') return false
  return true
}

export function teclaDevePrevenirPadrao(tecla: string): boolean {
  const normalizada = normalizarTecla(tecla)
  return (
    normalizada.startsWith('F') ||
    normalizada.startsWith('Ctrl+') ||
    normalizada.startsWith('Alt+')
  )
}
