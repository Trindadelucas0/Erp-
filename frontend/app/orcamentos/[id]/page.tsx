'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { FormularioOrcamentoLayout } from '@/components/orcamentos/formulario-orcamento-layout'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { deOrcamentoApi, type OrcamentoApi } from '@/lib/orcamento-api'
import { clienteHttp } from '@/services/api'

export default function PaginaOrcamento() {
  const { id } = useParams<{ id: string }>()
  const [iniciais, setIniciais] = useState<ReturnType<typeof deOrcamentoApi> | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    clienteHttp
      .get<{ orcamento: OrcamentoApi }>(`/orcamentos/${id}`)
      .then(({ data }) => {
        if (ativo) setIniciais(deOrcamentoApi(data.orcamento))
      })
      .catch((falha: unknown) => {
        if (ativo) setErro(extrairMensagemApi(falha, 'Orçamento não encontrado.'))
      })
    return () => {
      ativo = false
    }
  }, [id])

  return (
    <ProtegerRota chaveDaPagina="orcamentos">
      {erro ? (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : !iniciais ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <FormularioOrcamentoLayout orcamentoId={id} iniciais={iniciais} />
      )}
    </ProtegerRota>
  )
}
