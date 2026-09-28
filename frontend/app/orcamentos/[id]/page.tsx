'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { FormularioOrcamentoLayout } from '@/components/orcamentos/formulario-orcamento-layout'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { deOrcamentoApi, type OrcamentoApi } from '@/lib/orcamento-api'
import { clienteHttp } from '@/services/api'

function Conteudo() {
  const { id } = useParams<{ id: string }>()
  const roteador = useRouter()
  const parametros = useSearchParams()
  const [iniciais, setIniciais] = useState<ReturnType<typeof deOrcamentoApi> | null>(null)
  const [erro, setErro] = useState('')
  const imprimiu = useRef(false)

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

  useEffect(() => {
    if (!iniciais || imprimiu.current) return
    if (parametros.get('imprimir') !== '1') return
    imprimiu.current = true
    const timer = window.setTimeout(() => {
      window.print()
      roteador.replace(`/orcamentos/${id}`)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [iniciais, parametros, id, roteador])

  if (erro) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {erro}
      </p>
    )
  }

  if (!iniciais) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>
  }

  return <FormularioOrcamentoLayout orcamentoId={id} iniciais={iniciais} />
}

export default function PaginaOrcamento() {
  return (
    <ProtegerRota chaveDaPagina="orcamentos">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
        <Conteudo />
      </Suspense>
    </ProtegerRota>
  )
}
