'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { usePermissao } from '@/hooks/use-permissao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { TelaSeparacaoPedido } from '@/components/requisicoes-wms/tela-separacao-pedido'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { formatarNumeroRequisicao, type RequisicaoWms } from '@/lib/requisicoes-wms'

export default function PaginaSeparacaoItem() {
  return (
    <ProtegerRota chaveDaPagina="requisicoes">
      <Conteudo />
    </ProtegerRota>
  )
}

function Conteudo() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { perfil } = useSessaoDoUsuario()
  const podeEditar = usePermissao('estoque:edit')
  const [item, setItem] = useState<RequisicaoWms | null>(null)
  const [erro, setErro] = useState('')
  const [confirmado, setConfirmado] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [resultadoConcluir, setResultadoConcluir] = useState<
    { ok: true; numero: string } | { ok: false; mensagem: string } | null
  >(null)

  const carregar = useCallback(async () => {
    setErro('')
    try {
      const { data } = await clienteHttp.get<{ requisicao: RequisicaoWms }>(`/requisicoes/${id}`)
      if (data.requisicao.tipoOperacao !== 'separacao') {
        router.replace(`/requisicoes/${id}/executar`)
        return
      }
      setItem(data.requisicao)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível abrir a separação.'))
      setItem(null)
    }
  }, [id, router])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function bipar(valor: string) {
    setOcupado('bipar')
    setErro('')
    setConfirmado(false)
    try {
      const { data } = await clienteHttp.post<{ requisicao: RequisicaoWms }>(
        `/requisicoes/${id}/bipar`,
        { valor }
      )
      setItem(data.requisicao)
      setConfirmado(true)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível confirmar o produto.'))
    } finally {
      setOcupado(null)
    }
  }

  async function acao(nome: 'iniciar' | 'pausar' | 'retomar' | 'concluir' | 'cancelar', motivo?: string) {
    setOcupado(nome)
    setErro('')
    setConfirmado(false)
    try {
      const { data } = await clienteHttp.post<{ requisicao: RequisicaoWms }>(
        `/requisicoes/${id}/${nome}`,
        nome === 'cancelar' ? { motivo } : undefined
      )
      setItem(data.requisicao)
      if (nome === 'cancelar') router.push('/separacao')
      if (nome === 'concluir') {
        setResultadoConcluir({
          ok: true,
          numero: formatarNumeroRequisicao(data.requisicao.numero),
        })
      }
    } catch (e) {
      const mensagem = extrairMensagemApi(e, 'Não foi possível executar a ação.')
      if (nome === 'concluir') {
        setResultadoConcluir({ ok: false, mensagem })
      } else {
        setErro(mensagem)
      }
    } finally {
      setOcupado(null)
    }
  }

  if (!item) {
    return erro ? (
      <p className="text-sm text-destructive">{erro}</p>
    ) : (
      <p className="text-sm text-muted-foreground">Carregando…</p>
    )
  }

  return (
    <>
    <TelaSeparacaoPedido
      item={item}
      usuarioId={perfil?.usuario.id ?? ''}
      podeEditar={podeEditar}
      ocupado={ocupado}
      erro={erro}
      confirmado={confirmado}
      onBipar={bipar}
      onIniciar={() => void acao('iniciar')}
      onPausar={() => void acao('pausar')}
      onRetomar={() => void acao('retomar')}
      onConcluir={() => void acao('concluir')}
      onCancelar={(motivo) => void acao('cancelar', motivo)}
    />
    {resultadoConcluir ? (
      <Modal
        aberto
        aoFechar={() => setResultadoConcluir(null)}
        titulo={resultadoConcluir.ok ? 'Separação concluída' : 'Separação não concluída'}
        largura="sm"
        rodape={
          <Button type="button" onClick={() => setResultadoConcluir(null)}>
            Fechar
          </Button>
        }
      >
        <p className="text-sm">
          {resultadoConcluir.ok
            ? `A ordem ${resultadoConcluir.numero} foi concluída.`
            : resultadoConcluir.mensagem}
        </p>
      </Modal>
    ) : null}
    </>
  )
}
