'use client'

import { useEffect, useRef } from 'react'
import { useAtalhos } from '@/components/compartilhado/provedor-de-atalhos'
import type { CondicoesDeAtalhos, HandlersDeAtalhos } from '@/lib/atalhos/tipos'

export function useRegistrarAtalhos(
  handlers: HandlersDeAtalhos,
  quando: CondicoesDeAtalhos = {}
) {
  const { registrarPagina } = useAtalhos()
  const handlersRef = useRef(handlers)
  const quandoRef = useRef(quando)

  handlersRef.current = handlers
  quandoRef.current = quando

  useEffect(() => {
    return registrarPagina({
      get handlers() {
        return handlersRef.current
      },
      get quando() {
        return quandoRef.current
      },
    })
  }, [registrarPagina])
}
