'use client'

import { useCallback, useState } from 'react'

export type StatusDaAba = 'idle' | 'valid' | 'error'

export type ConfigDeAba = {
  id: string
  /** Retorna true se a aba estiver válida, false se houver erro. */
  validar: () => boolean
}

type RetornoDoHook = {
  /** Status atual de cada aba por id. */
  statusDasAbas: Record<string, StatusDaAba>
  /**
   * Roda os validadores de todas as abas e atualiza os status.
   * Retorna true se todas passarem, false se alguma falhar.
   */
  validarTodasAsAbas: () => boolean
  /**
   * Retorna o id da primeira aba com status 'error', ou null se não houver.
   * Use para redirecionar o usuário automaticamente ao tentar salvar.
   */
  irParaAbaComErro: () => string | null
  /**
   * Marca uma aba como visitada.
   * Se já tiver um validador, roda e marca como 'valid' ou 'error'.
   * Se ainda não tiver sido validada, mantém 'idle'.
   */
  marcarAbaVisitada: (abaId: string) => void
  /** Reseta todos os status para 'idle'. */
  resetarStatus: () => void
}

export function useValidacaoDeAbas(abas: ConfigDeAba[]): RetornoDoHook {
  const statusInicial = Object.fromEntries(
    abas.map((aba) => [aba.id, 'idle' as StatusDaAba])
  )

  const [statusDasAbas, setStatusDasAbas] = useState<Record<string, StatusDaAba>>(statusInicial)

  const validarTodasAsAbas = useCallback((): boolean => {
    const novosStatus: Record<string, StatusDaAba> = {}
    let todasValidas = true

    for (const aba of abas) {
      const valida = aba.validar()
      novosStatus[aba.id] = valida ? 'valid' : 'error'
      if (!valida) todasValidas = false
    }

    setStatusDasAbas(novosStatus)
    return todasValidas
  }, [abas])

  const irParaAbaComErro = useCallback((): string | null => {
    for (const aba of abas) {
      if (statusDasAbas[aba.id] === 'error') return aba.id
    }
    return null
  }, [abas, statusDasAbas])

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

  const resetarStatus = useCallback(() => {
    setStatusDasAbas(statusInicial)
  }, [statusInicial])

  return {
    statusDasAbas,
    validarTodasAsAbas,
    irParaAbaComErro,
    marcarAbaVisitada,
    resetarStatus,
  }
}
