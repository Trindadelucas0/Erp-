import { useEffect, useId } from 'react'

const EVENTO_FECHAR_DROPDOWN_CATALOGO = 'erp:fechar-dropdown-catalogo'

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
