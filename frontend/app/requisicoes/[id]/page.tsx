'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { usePermissao } from '@/hooks/use-permissao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  BadgePrioridadeRequisicao,
  BadgeStatusRequisicao,
} from '@/components/requisicoes-wms/badges-requisicao'
import { BarraAcoesRequisicao } from '@/components/requisicoes-wms/barra-acoes-requisicao'
import { HistoricoRequisicao } from '@/components/requisicoes-wms/historico-requisicao'
import {
  FormularioCamposRequisicao,
  formParaPayload,
  requisicaoParaForm,
  type FormRequisicao,
} from '@/components/requisicoes-wms/formulario-campos-requisicao'
import {
  formatarNumeroRequisicao,
  rotuloNfDaRequisicao,
  ROTULO_TIPO_OPERACAO,
  type RequisicaoWms,
} from '@/lib/requisicoes-wms'

export default function PaginaFichaRequisicao() {
  return (
    <ProtegerRota chaveDaPagina="requisicoes">
      <ConteudoFicha />
    </ProtegerRota>
  )
}

function ConteudoFicha() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { perfil } = useSessaoDoUsuario()
  const podeEditar = usePermissao('estoque:edit')
  const [item, setItem] = useState<RequisicaoWms | null>(null)
  const [form, setForm] = useState<FormRequisicao | null>(null)
  const [operadores, setOperadores] = useState<Array<{ id: string; name: string }>>([])
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setErro('')
    try {
      const { data } = await clienteHttp.get<{ requisicao: RequisicaoWms }>(`/requisicoes/${id}`)
      setItem(data.requisicao)
      setForm(requisicaoParaForm(data.requisicao))
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível abrir a requisição.'))
      setItem(null)
    }
  }, [id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    void clienteHttp
      .get<{ operadores: Array<{ id: string; name: string }> }>('/requisicoes/operadores')
      .then((r) => setOperadores(r.data.operadores ?? []))
      .catch(() => setOperadores([]))
  }, [])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    setOcupado('salvar')
    setErro('')
    try {
      const { data } = await clienteHttp.patch(`/requisicoes/${id}`, formParaPayload(form))
      setItem(data.requisicao)
      setForm(requisicaoParaForm(data.requisicao))
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível salvar.'))
    } finally {
      setOcupado(null)
    }
  }

  async function onAcao(acao: string, extra?: { motivo?: string; usuarioId?: string }) {
    setOcupado(acao)
    setErro('')
    try {
      const body =
        acao === 'atribuir'
          ? { usuarioId: extra?.usuarioId }
          : acao === 'cancelar' || acao === 'bloquear'
            ? { motivo: extra?.motivo }
            : undefined
      const { data } = await clienteHttp.post(`/requisicoes/${id}/${acao}`, body)
      setItem(data.requisicao)
      setForm(requisicaoParaForm(data.requisicao))
      if (acao === 'iniciar' && item?.tipoOperacao === 'contagem_entrada') {
        const destino = item.nfeRecebidaId
          ? `/contagens?nfeRecebidaId=${encodeURIComponent(item.nfeRecebidaId)}`
          : '/contagens'
        router.push(destino)
      } else if (acao === 'iniciar') {
        router.push(`/requisicoes/${id}/executar`)
      }
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível executar a ação.'))
    } finally {
      setOcupado(null)
    }
  }

  const encerrada = item?.status === 'concluida' || item?.status === 'cancelada'

  return (
    <div className="space-y-4">
      <TituloPagina
        caminho={<Link href="/requisicoes">Requisições</Link>}
        subtitulo="Ordem operacional — Separação reserva e baixa o kardex ao concluir; reposição não altera o total."
        aoLadoDoTitulo={
          item ? (
            <span className="flex flex-wrap items-center gap-2">
              <BadgePrioridadeRequisicao prioridade={item.prioridade} />
              <BadgeStatusRequisicao status={item.status} />
            </span>
          ) : null
        }
      >
        {item ? formatarNumeroRequisicao(item.numero) : 'Requisição'}
      </TituloPagina>

      {erro ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{erro}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void carregar()}>
            Tentar de novo
          </Button>
        </div>
      ) : null}

      {!item || !form ? (
        !erro ? <p className="text-sm text-muted-foreground">Carregando…</p> : null
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {ROTULO_TIPO_OPERACAO[item.tipoOperacao]} · criada em{' '}
            {new Date(item.createdAt).toLocaleString('pt-BR')}
            {item.produtoNome ? ` · ${item.produtoNome}` : ''}
            {rotuloNfDaRequisicao(item.nfeRecebidaChave)
              ? ` · ${rotuloNfDaRequisicao(item.nfeRecebidaChave)}`
              : ''}
          </p>
          <CardPadrao titulo="Dados">
            <form onSubmit={(e) => void salvar(e)}>
              <FormularioCamposRequisicao
                form={form}
                aoMudar={setForm}
                operadores={operadores}
                disabled={!podeEditar || encerrada || item.tipoOperacao === 'contagem_entrada'}
              />
              {podeEditar && !encerrada ? (
                <div className="mt-4">
                  <BotaoPrimario type="submit" disabled={ocupado !== null}>
                    {ocupado === 'salvar' ? 'Salvando…' : 'Salvar'}
                  </BotaoPrimario>
                </div>
              ) : null}
            </form>
          </CardPadrao>
          <CardPadrao titulo="Execução">
            <BarraAcoesRequisicao
              item={item}
              usuarioId={perfil?.usuario.id ?? ''}
              podeEditar={podeEditar}
              ocupado={ocupado}
              operadores={operadores}
              onAcao={(acao, extra) => void onAcao(acao, extra)}
            />
          </CardPadrao>
          <CardPadrao titulo="Histórico">
            <HistoricoRequisicao eventos={item.eventos ?? []} />
          </CardPadrao>
        </>
      )}
    </div>
  )
}
