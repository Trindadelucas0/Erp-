'use client'

import { useCallback, useState } from 'react'
import { alternarEstadoOrdenacao, type EstadoOrdenacao } from '@/lib/ordenacao-lista'

export function useOrdenacaoColunas<T extends string>() {
  const [ordenacao, setOrdenacao] = useState<EstadoOrdenacao<T>>(null)

  const alternarOrdenacao = useCallback((coluna: T) => {
    setOrdenacao((atual) => alternarEstadoOrdenacao(coluna, atual))
  }, [])

  const limparOrdenacao = useCallback(() => {
    setOrdenacao(null)
  }, [])

  return { ordenacao, alternarOrdenacao, limparOrdenacao }
}
