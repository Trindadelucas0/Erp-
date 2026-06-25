'use client'

import { useCallback, useState } from 'react'
import { estaDesbloqueado, limparTokenReauth } from '@/lib/reauth-assinatura'

/**
 * Gerencia o estado de desbloqueio da seção de documentos de assinatura
 * para uso em fluxos pontuais (ex: botão "Enviar contrato").
 */
export function useDesbloqueioAssinatura() {
  const [desbloqueado, setDesbloqueado] = useState(() => estaDesbloqueado())
  const [pedindoSenha, setPedindoSenha] = useState(false)

  const solicitarDesbloqueio = useCallback(() => {
    setPedindoSenha(true)
  }, [])

  const aoDesbloquear = useCallback(() => {
    setDesbloqueado(true)
    setPedindoSenha(false)
  }, [])

  const cancelarDesbloqueio = useCallback(() => {
    setPedindoSenha(false)
  }, [])

  const bloquear = useCallback(() => {
    limparTokenReauth()
    setDesbloqueado(false)
    setPedindoSenha(false)
  }, [])

  return {
    desbloqueado,
    pedindoSenha,
    solicitarDesbloqueio,
    aoDesbloquear,
    cancelarDesbloqueio,
    bloquear,
  }
}
