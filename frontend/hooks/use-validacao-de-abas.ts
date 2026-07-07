'use client'

import { useCallback, useRef, useState } from 'react'

export type StatusDaAba = 'idle' | 'valid' | 'error'

export type ConfigDeAba = {
  id: string
  /** Retorna true se a aba estiver válida, false se houver erro. */
  validar: () => boolean
}

export type ResultadoValidacaoAbas = {
  todasValidas: boolean
  primeiraAbaComErro: string | null
}

type RetornoDoHook = {
  /** Status atual de cada aba por id. */
  statusDasAbas: Record<string, StatusDaAba>
  /**
   * Roda os validadores de todas as abas e atualiza os status.
   * Retorna se todas passaram e o id da primeira aba inválida (síncrono).
   */
  validarTodasAsAbas: () => ResultadoValidacaoAbas
  /**
   * Retorna o id da primeira aba inválida da última chamada a validarTodasAsAbas.
   * Preferir usar o retorno síncrono de validarTodasAsAbas().
   */
  irParaAbaComErro: () => string | null
  /**
   * Marca uma aba como visitada.
   * Se já tiver um validador, roda e marca como 'valid' ou 'error'.
   * Se ainda não tiver sido validada, mantém 'idle'.
   */
  marcarAbaVisitada: (abaId: string) => void
  /** Valida só uma aba e atualiza seu status. Retorna true se válida. */
  validarAba: (abaId: string) => boolean
  /** Retorna true se a aba estiver com status 'valid'. */
  abaLiberada: (abaId: string) => boolean
  /** Reseta todos os status para 'idle'. */
  resetarStatus: () => void
}

export function useValidacaoDeAbas(abas: ConfigDeAba[]): RetornoDoHook {
  const statusInicial = Object.fromEntries(
    abas.map((aba) => [aba.id, 'idle' as StatusDaAba])
  )

  const [statusDasAbas, setStatusDasAbas] = useState<Record<string, StatusDaAba>>(statusInicial)
  const primeiraAbaComErroRef = useRef<string | null>(null)

  const validarTodasAsAbas = useCallback((): ResultadoValidacaoAbas => {
    const novosStatus: Record<string, StatusDaAba> = {}
    let todasValidas = true
    let primeiraAbaComErro: string | null = null

    for (const aba of abas) {
      const valida = aba.validar()
      novosStatus[aba.id] = valida ? 'valid' : 'error'
      if (!valida) {
        todasValidas = false
        if (!primeiraAbaComErro) primeiraAbaComErro = aba.id
      }
    }

    primeiraAbaComErroRef.current = primeiraAbaComErro
    setStatusDasAbas(novosStatus)
    return { todasValidas, primeiraAbaComErro }
  }, [abas])

  const irParaAbaComErro = useCallback((): string | null => {
    return primeiraAbaComErroRef.current
  }, [])

  const marcarAbaVisitada = useCallback(
    (abaId: string) => {
      const aba = abas.find((a) => a.id === abaId)
      if (!aba) return

      setStatusDasAbas((anterior) => {
        if (anterior[abaId] === 'idle') {
          return { ...anterior, [abaId]: 'idle' }
        }
        const valida = aba.validar()
        return { ...anterior, [abaId]: valida ? 'valid' : 'error' }
      })
    },
    [abas]
  )

  const validarAba = useCallback(
    (abaId: string): boolean => {
      const aba = abas.find((a) => a.id === abaId)
      if (!aba) return false

      const valida = aba.validar()
      setStatusDasAbas((anterior) => ({
        ...anterior,
        [abaId]: valida ? 'valid' : 'error',
      }))
      return valida
    },
    [abas]
  )

  const abaLiberada = useCallback(
    (abaId: string): boolean => statusDasAbas[abaId] === 'valid',
    [statusDasAbas]
  )

  const resetarStatus = useCallback(() => {
    setStatusDasAbas(statusInicial)
  }, [statusInicial])

  return {
    statusDasAbas,
    validarTodasAsAbas,
    irParaAbaComErro,
    marcarAbaVisitada,
    validarAba,
    abaLiberada,
    resetarStatus,
  }
}
