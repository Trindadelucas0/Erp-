'use client'

import { useCallback, useMemo, useState } from 'react'
import { ModalConfirmacao } from '@/components/compartilhado/modal-confirmacao'
import { formularioFoiAlterado } from '@/lib/formulario-alterado'

type OpcoesConfirmarSaida = {
  titulo?: string
  mensagem?: string
  textoConfirmar?: string
  textoCancelar?: string
}

export function useConfirmarSaida<T>(
  form: T,
  formInicial: T,
  aoFechar: () => void,
  opcoes?: OpcoesConfirmarSaida
) {
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false)

  const alterado = useMemo(
    () => formularioFoiAlterado(form, formInicial),
    [form, formInicial]
  )

  const solicitarFechar = useCallback(() => {
    if (alterado) {
      setConfirmacaoAberta(true)
    } else {
      aoFechar()
    }
  }, [alterado, aoFechar])

  const confirmarSaida = useCallback(() => {
    setConfirmacaoAberta(false)
    aoFechar()
  }, [aoFechar])

  const cancelarSaida = useCallback(() => {
    setConfirmacaoAberta(false)
  }, [])

  const dialogoConfirmacao = (
    <ModalConfirmacao
      aberto={confirmacaoAberta}
      titulo={opcoes?.titulo}
      mensagem={opcoes?.mensagem}
      textoConfirmar={opcoes?.textoConfirmar}
      textoCancelar={opcoes?.textoCancelar}
      aoConfirmar={confirmarSaida}
      aoCancelar={cancelarSaida}
    />
  )

  return { solicitarFechar, dialogoConfirmacao, alterado }
}
