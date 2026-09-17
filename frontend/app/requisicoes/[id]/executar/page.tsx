'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import {
  BadgePrioridadeRequisicao,
  BadgeStatusRequisicao,
} from '@/components/requisicoes-wms/badges-requisicao'
import { TelaExecucaoRequisicao } from '@/components/requisicoes-wms/tela-execucao-requisicao'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  formatarNumeroRequisicao,
  type EtapaConferencia,
  type RequisicaoWms,
} from '@/lib/requisicoes-wms'

export default function PaginaExecutarRequisicao() {
  return (
    <ProtegerRota chaveDaPagina="requisicoes">
      <ConteudoExecutar />
    </ProtegerRota>
  )
}

function ConteudoExecutar() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { perfil } = useSessaoDoUsuario()
  const [item, setItem] = useState<RequisicaoWms | null>(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setErro('')
    try {
      const { data } = await clienteHttp.get<{ requisicao: RequisicaoWms }>(`/requisicoes/${id}`)
      setItem(data.requisicao)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível abrir a execução.'))
      setItem(null)
    }
  }, [id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function conferir(etapa: EtapaConferencia, valor: string) {
    setOcupado('conferir')
    setErro('')
    try {
      const { data } = await clienteHttp.post<{ requisicao: RequisicaoWms }>(
        `/requisicoes/${id}/conferir`,
        { etapa, valor }
      )
      setItem(data.requisicao)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Conferência recusada.'))
    } finally {
      setOcupado(null)
    }
  }

  async function acao(nome: 'pausar' | 'retomar' | 'concluir') {
    setOcupado(nome)
    setErro('')
    try {
      const { data } = await clienteHttp.post<{ requisicao: RequisicaoWms }>(
        `/requisicoes/${id}/${nome}`
      )
      setItem(data.requisicao)
      if (nome === 'concluir') router.push(`/requisicoes/${id}`)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível executar a ação.'))
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="space-y-4">
      <TituloPagina
        caminho={<Link href={`/requisicoes/${id}`}>Requisição</Link>}
        subtitulo="Confirme origem, produto, quantidade e destino. Concluir só libera com os passos gravados."
        aoLadoDoTitulo={
          item ? (
            <span className="flex flex-wrap items-center gap-2">
              <BadgePrioridadeRequisicao prioridade={item.prioridade} />
              <BadgeStatusRequisicao status={item.status} />
            </span>
          ) : null
        }
      >
        {item ? `Executar ${formatarNumeroRequisicao(item.numero)}` : 'Executar requisição'}
      </TituloPagina>

      {erro && !item ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{erro}</p>
        </div>
      ) : null}

      {!item ? (
        !erro ? <p className="text-sm text-muted-foreground">Carregando…</p> : null
      ) : item.status !== 'em_execucao' && item.status !== 'pausada' ? (
        <p className="text-sm text-muted-foreground">
          Esta requisição não está em execução.{' '}
          <Link className="underline" href={`/requisicoes/${id}`}>
            Voltar à ficha
          </Link>
        </p>
      ) : (
        <TelaExecucaoRequisicao
          item={item}
          usuarioId={perfil?.usuario.id ?? ''}
          ocupado={ocupado}
          erro={erro}
          onConferir={conferir}
          onPausar={() => void acao('pausar')}
          onRetomar={() => void acao('retomar')}
          onConcluir={() => void acao('concluir')}
        />
      )}
    </div>
  )
}
