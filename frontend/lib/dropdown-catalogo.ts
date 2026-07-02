import { useCallback, useEffect, useId, useRef } from 'react'

const EVENTO_FECHAR_DROPDOWN_CATALOGO = 'erp:fechar-dropdown-catalogo'
const ATRASO_FECHAR_MOUSE_MS = 80

/** Fecha outros dropdowns de catálogo ao abrir um novo. */
export function notificarAberturaDropdownCatalogo(instanciaId: string) {
  window.dispatchEvent(
    new CustomEvent(EVENTO_FECHAR_DROPDOWN_CATALOGO, { detail: instanciaId })
  )
}

export function useOuvirFechamentoDropdownCatalogo(
  instanciaId: string,
  aoFechar: () => void
) {
  useEffect(() => {
    function aoAbrirOutro(e: Event) {
      const id = (e as CustomEvent<string>).detail
      if (id !== instanciaId) aoFechar()
    }
    window.addEventListener(EVENTO_FECHAR_DROPDOWN_CATALOGO, aoAbrirOutro)
    return () => window.removeEventListener(EVENTO_FECHAR_DROPDOWN_CATALOGO, aoAbrirOutro)
  }, [instanciaId, aoFechar])
}

export function useInstanciaDropdownCatalogo() {
  return useId()
}

/** Fecha o dropdown quando o mouse sai da zona (input + lista). */
export function useFecharAoSairComMouse(aoFechar: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelarFechamento = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const onMouseEnter = useCallback(() => {
    cancelarFechamento()
  }, [cancelarFechamento])

  const onMouseLeave = useCallback(() => {
    cancelarFechamento()
    timerRef.current = setTimeout(aoFechar, ATRASO_FECHAR_MOUSE_MS)
  }, [aoFechar, cancelarFechamento])

  useEffect(() => () => cancelarFechamento(), [cancelarFechamento])

  return { onMouseEnter, onMouseLeave }
}
