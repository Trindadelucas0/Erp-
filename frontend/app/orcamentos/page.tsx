'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { ModalConfirmacao } from '@/components/compartilhado/modal-confirmacao'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { CampoBuscaLista } from '@/components/compartilhado/campo-busca-lista'
import { BadgeStatus } from '@/components/ui/badge-status'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { usePermissao } from '@/hooks/use-permissao'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { textosContemTodosTermos } from '@/lib/normalizar-busca'
import { type OrcamentoListaApi } from '@/lib/orcamento-api'
import { formatarDataCivil, rotuloStatusOrcamento } from '@/lib/orcamento-layout'
import { formatarMoeda } from '@/lib/pedido-compra-shared'
import { clienteHttp } from '@/services/api'

function ConteudoDaPagina() {
  const roteador = useRouter()
  const podeEditar = usePermissao('vendas:edit')
  const [busca, setBusca] = useState('')
  const [orcamentos, setOrcamentos] = useState<OrcamentoListaApi[]>([])
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [finalizandoId, setFinalizandoId] = useState<string | null>(null)
  const [confirmarFinalizar, setConfirmarFinalizar] = useState<{
    id: string
    numero: string
  } | null>(null)

  const carregar = useCallback(() => {
    setCarregando(true)
    setErro('')
    return clienteHttp
      .get<{ orcamentos: OrcamentoListaApi[] }>('/orcamentos')
      .then(({ data }) => {
        setOrcamentos(data.orcamentos)
      })
      .catch((falha: unknown) => {
        setErro(extrairMensagemApi(falha, 'Não foi possível carregar os orçamentos.'))
      })
      .finally(() => {
        setCarregando(false)
      })
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const lista = useMemo(
    () =>
      orcamentos.filter((orcamento) =>
        textosContemTodosTermos([orcamento.numero, orcamento.clienteNome], busca)
      ),
    [busca, orcamentos]
  )

  async function executarFinalizar(id: string) {
    setFinalizandoId(id)
    setErro('')
    setAviso('')
    try {
      await clienteHttp.post(`/orcamentos/${id}/finalizar`)
      setAviso('Orçamento finalizado.')
      await carregar()
    } catch (falha: unknown) {
      setErro(extrairMensagemApi(falha, 'Não foi possível finalizar o orçamento.'))
    } finally {
      setFinalizandoId(null)
      setConfirmarFinalizar(null)
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <TituloPagina caminho="Vendas > Orçamentos">Orçamentos</TituloPagina>

      <CardPadrao
        titulo="Orçamentos"
        acoes={
          <BotaoPrimario type="button" onClick={() => roteador.push('/orcamentos/novo')}>
            <Plus className="mr-1 size-4 inline" />
            Novo orçamento
          </BotaoPrimario>
        }
      >
        <div className="mb-3 print:hidden">
          <CampoBuscaLista
            nomeCampo="busca-lista-orcamentos"
            rotulo="Busca"
            className="sm:max-w-xs"
            placeholder="Nº ou cliente"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </div>

        {aviso ? (
          <p className="mb-3 text-sm text-primary" role="status">
            {aviso}
          </p>
        ) : null}

        {erro ? (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        ) : carregando ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum orçamento</p>
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Lista de orçamentos</caption>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Nº</th>
                  <th className="px-2 py-2 font-medium">Cliente</th>
                  <th className="px-2 py-2 font-medium">Data</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 text-right font-medium">Total</th>
                  <th className="px-2 py-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((orcamento) => (
                  <tr
                    key={orcamento.id}
                    className="cursor-pointer border-b border-border/70 hover:bg-muted/40"
                    onClick={() => roteador.push(`/orcamentos/${orcamento.id}`)}
                    onKeyDown={(evento) => {
                      if (evento.key === 'Enter' || evento.key === ' ') {
                        evento.preventDefault()
                        roteador.push(`/orcamentos/${orcamento.id}`)
                      }
                    }}
                    tabIndex={0}
                  >
                    <td className="px-2 py-3 font-medium">{orcamento.numero}</td>
                    <td className="px-2 py-3">{orcamento.clienteNome}</td>
                    <td className="px-2 py-3">{formatarDataCivil(orcamento.data)}</td>
                    <td className="px-2 py-3">
                      <BadgeStatus variante="info">{rotuloStatusOrcamento(orcamento.status)}</BadgeStatus>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">{formatarMoeda(orcamento.total)}</td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      {podeEditar && orcamento.status === 'em_elaboracao' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={finalizandoId === orcamento.id}
                          onClick={() =>
                            setConfirmarFinalizar({ id: orcamento.id, numero: orcamento.numero })
                          }
                        >
                          {finalizandoId === orcamento.id ? 'Finalizando…' : 'Finalizar'}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardPadrao>

      <ModalConfirmacao
        aberto={confirmarFinalizar !== null}
        titulo="Finalizar proposta?"
        mensagem={
          confirmarFinalizar
            ? `A proposta ${confirmarFinalizar.numero} passará para status Enviado.`
            : ''
        }
        textoConfirmar="Finalizar"
        textoCancelar="Cancelar"
        aoConfirmar={() => {
          if (confirmarFinalizar) void executarFinalizar(confirmarFinalizar.id)
        }}
        aoCancelar={() => setConfirmarFinalizar(null)}
      />
    </div>
  )
}

export default function PaginaOrcamentos() {
  return (
    <ProtegerRota chaveDaPagina="orcamentos">
      <ConteudoDaPagina />
    </ProtegerRota>
  )
}
