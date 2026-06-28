'use client'

/**
 * Hook compartilhado para o fluxo "blur no campo documento":
 *  1. Valida CPF/CNPJ
 *  2. (PJ) Busca dados na BrasilAPI — dedup garantido em brasil-api.ts
 *  3. Verifica duplicidade no ERP via /por-documento
 *
 * Proteção de concorrência:
 *  - consultandoRef (mutex): bloqueia nova execução enquanto uma já está em andamento
 *  - paramsRef: mantém callbacks sempre atualizados sem invalidar useCallback
 */

import { useCallback, useRef, useState } from 'react'
import { buscarDadosCnpj, type DadosCnpj } from '@/lib/brasil-api'
import { clienteHttp } from '@/services/api'
import { validarCpf, validarCnpj } from '@/lib/documentos'

export type RespostaPorDocumento = {
  encontrado: boolean
  pessoa?: { id: string; nome: string } | null
  papeis?: string[]
  [key: string]: unknown
}

type Params = {
  /** Lê o documento e tipo atuais do formulário sem causar stale closure. */
  getForm: () => { documento: string; tipo: 'PF' | 'PJ' }
  getModoEdicao: () => boolean
  /** Quando true, não dispara BrasilAPI nem verificação de duplicidade (modo visualização). */
  getSomenteLeitura?: () => boolean
  /** Ex.: '/clientes/por-documento' */
  endpointPorDocumento: string
  tocarCampo: (campo: string) => void
  aoAplicarDadosCnpj: (dados: DadosCnpj) => void
  aoProcessarResposta: (data: RespostaPorDocumento) => void
}

type Retorno = {
  aoSairDocumento: () => Promise<void>
  carregandoBrasilApi: boolean
  verificandoDocumento: boolean
  resetarConsulta: () => void
}

export function useConsultaDocumento(params: Params): Retorno {
  // Ref de params: callbacks sempre frescos, sem invalidar useCallback
  const paramsRef = useRef(params)
  paramsRef.current = params

  // Mutex simples: impede 2ª execução paralela
  const consultandoRef = useRef(false)

  const [carregandoBrasilApi, setCarregandoBrasilApi] = useState(false)
  const [verificandoDocumento, setVerificandoDocumento] = useState(false)

  const resetarConsulta = useCallback(() => {
    consultandoRef.current = false
    setCarregandoBrasilApi(false)
    setVerificandoDocumento(false)
  }, [])

  const aoSairDocumento = useCallback(async () => {
    const p = paramsRef.current

    p.tocarCampo('documento')
    if (p.getModoEdicao() || p.getSomenteLeitura?.()) return
    // Mutex: se já está consultando, ignora o 2º blur
    if (consultandoRef.current) return

    const form = p.getForm()
    const nums = form.documento.replace(/\D/g, '')

    if (form.tipo === 'PF') {
      if (nums.length !== 11 || !validarCpf(nums)) return
    } else {
      if (nums.length !== 14 || !validarCnpj(nums)) return
    }

    consultandoRef.current = true

    try {
      if (form.tipo === 'PJ') {
        setCarregandoBrasilApi(true)
        const dados = await buscarDadosCnpj(nums)
        setCarregandoBrasilApi(false)
        if (dados) p.aoAplicarDadosCnpj(dados)
      }

      setVerificandoDocumento(true)
      try {
        const { data } = await clienteHttp.get(
          `${p.endpointPorDocumento}/${nums}`,
        )
        p.aoProcessarResposta(data)
      } catch {
        // Ignora erros de duplicidade — não bloquear o usuário
      } finally {
        setVerificandoDocumento(false)
      }
    } finally {
      setCarregandoBrasilApi(false)
      consultandoRef.current = false
    }
  }, [])

  return { aoSairDocumento, carregandoBrasilApi, verificandoDocumento, resetarConsulta }
}
