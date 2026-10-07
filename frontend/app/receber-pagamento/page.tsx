'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Banknote, Plus } from 'lucide-react'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { BadgeStatus } from '@/components/ui/badge-status'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { usePermissao } from '@/hooks/use-permissao'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  CHAVE_AVISO,
  FORMAS_PAGAMENTO_UI,
  fraseSeparacoes,
  rotuloFormaPagamento,
  type FormaPagamentoUi,
} from '@/lib/receber-pagamento-desenvolvimento'
import { clienteHttp } from '@/services/api'

type VendaPaga = {
  id: string
  numero: number
  clienteNome: string
  status: string
  formaPagamento: string | null
  separacoes: number[]
}

type ChamadoTotem = {
  id: string
  numero: number
  clienteNome: string
  status: string
  itens: Array<{ produtoId: string; quantidade: number; produtoNome?: string }>
}

function rotuloStatus(status: string) {
  if (status === 'paga') return 'Paga'
  if (status === 'chamado_atendente') return 'Chamado'
  return status
}

function ConteudoDaPagina() {
  const roteador = useRouter()
  const podeCriar = usePermissao('vendas:create')
  const [vendas, setVendas] = useState<VendaPaga[]>([])
  const [chamados, setChamados] = useState<ChamadoTotem[]>([])
  const [chamadoAbertoId, setChamadoAbertoId] = useState<string | null>(null)
  const [formaChamado, setFormaChamado] = useState<FormaPagamentoUi>('dinheiro')
  const [erro, setErro] = useState('')
  const [erroChamado, setErroChamado] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [gravandoChamado, setGravandoChamado] = useState(false)
  const [aviso, setAviso] = useState('')

  const carregar = useCallback(() => {
    setCarregando(true)
    setErro('')
    clienteHttp
      .get<{ vendas: VendaPaga[]; chamados: ChamadoTotem[] }>('/receber-pagamento')
      .then(({ data }) => {
        setVendas(data.vendas ?? [])
        setChamados(data.chamados ?? [])
      })
      .catch((falha: unknown) => {
        setErro(extrairMensagemApi(falha, 'Não foi possível carregar as vendas.'))
      })
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    const texto = sessionStorage.getItem(CHAVE_AVISO)
    if (texto) {
      sessionStorage.removeItem(CHAVE_AVISO)
      setAviso(texto)
    }
    carregar()
  }, [carregar])

  const chamadoAberto = chamados.find((item) => item.id === chamadoAbertoId) ?? null

  async function confirmarChamado() {
    if (!chamadoAberto) return
    setGravandoChamado(true)
    setErroChamado('')
    try {
      const { data } = await clienteHttp.post<{ venda: { separacoes: number[] } }>(
        `/receber-pagamento/${chamadoAberto.id}/confirmar`,
        { formaPagamento: formaChamado }
      )
      setAviso(fraseSeparacoes(data.venda.separacoes ?? []))
      setChamadoAbertoId(null)
      setFormaChamado('dinheiro')
      carregar()
    } catch (falha: unknown) {
      const status = (falha as { response?: { status?: number } }).response?.status
      setErroChamado(
        extrairMensagemApi(
          falha,
          status === 409 ? 'Este chamado já foi recebido.' : 'Não foi possível receber o chamado.'
        )
      )
      if (status === 409) carregar()
    } finally {
      setGravandoChamado(false)
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <TituloPagina
        caminho="Vendas > Receber pagamento"
        subtitulo="Totem confirma formas eletrônicas. Aqui só dinheiro ou chamado do totem."
      >
        Receber pagamento
      </TituloPagina>

      {aviso ? (
        <p className="text-sm text-foreground" role="status">
          {aviso}
        </p>
      ) : null}

      <CardPadrao
        titulo="Chamados do totem"
        acoes={
          podeCriar ? (
            <BotaoPrimario type="button" onClick={() => roteador.push('/receber-pagamento/novo')}>
              <Banknote className="mr-1 size-4 inline" />
              Receber em dinheiro
            </BotaoPrimario>
          ) : null
        }
      >
        {erro ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive" role="alert">
              {erro}
            </p>
            <Button type="button" variant="outline" onClick={carregar}>
              Tentar de novo
            </Button>
          </div>
        ) : carregando ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : chamados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum chamado do totem.</p>
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">Chamados do totem</caption>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Nº</th>
                  <th className="px-2 py-2 font-medium">Cliente</th>
                  <th className="px-2 py-2 font-medium">Itens</th>
                  <th className="px-2 py-2 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {chamados.map((chamado) => (
                  <tr key={chamado.id} className="border-b border-border/70">
                    <td className="px-2 py-3 font-medium">{chamado.numero}</td>
                    <td className="px-2 py-3">{chamado.clienteNome}</td>
                    <td className="px-2 py-3">
                      {(chamado.itens ?? [])
                        .map(
                          (item) =>
                            `${item.produtoNome ?? 'Produto'} · ${item.quantidade}`
                        )
                        .join('; ')}
                    </td>
                    <td className="px-2 py-3">
                      {podeCriar ? (
                        <Button
                          type="button"
                          size="sm"
                          variant={chamadoAbertoId === chamado.id ? 'default' : 'outline'}
                          onClick={() => {
                            setChamadoAbertoId(chamado.id)
                            setErroChamado('')
                            setFormaChamado('dinheiro')
                          }}
                        >
                          Receber
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardPadrao>

      {chamadoAberto ? (
        <CardPadrao titulo={`Receber este chamado · Pedido ${chamadoAberto.numero}`}>
          <p className="mb-2 text-sm">
            <span className="text-muted-foreground">Cliente:</span> {chamadoAberto.clienteNome}
          </p>
          <ul className="mb-4 list-inside list-disc text-sm">
            {(chamadoAberto.itens ?? []).map((item) => (
              <li key={`${item.produtoId}-${item.quantidade}`}>
                {item.produtoNome ?? 'Produto'} · {item.quantidade}
              </li>
            ))}
          </ul>
          <p className="mb-2 text-sm font-medium">Forma de pagamento</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {FORMAS_PAGAMENTO_UI.map((opcao) => (
              <Button
                key={opcao.valor}
                type="button"
                size="sm"
                variant={formaChamado === opcao.valor ? 'default' : 'outline'}
                disabled={gravandoChamado}
                onClick={() => setFormaChamado(opcao.valor)}
              >
                {opcao.rotulo}
              </Button>
            ))}
          </div>
          {erroChamado ? (
            <p className="mb-3 text-sm text-destructive" role="alert">
              {erroChamado}
            </p>
          ) : null}
          <BotaoPrimario
            type="button"
            disabled={gravandoChamado}
            onClick={() => void confirmarChamado()}
          >
            {gravandoChamado ? 'Confirmando…' : 'Confirmar pagamento'}
          </BotaoPrimario>
        </CardPadrao>
      ) : null}

      <CardPadrao
        titulo="Vendas pagas"
        acoes={
          podeCriar ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => roteador.push('/receber-pagamento/totem')}
            >
              <Plus className="mr-1 size-4 inline" />
              Abrir totem
            </Button>
          ) : null
        }
      >
        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : vendas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma venda paga.</p>
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Vendas pagas</caption>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Nº</th>
                  <th className="px-2 py-2 font-medium">Cliente</th>
                  <th className="px-2 py-2 font-medium">Forma</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Separações</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((venda) => (
                  <tr key={venda.id} className="border-b border-border/70">
                    <td className="px-2 py-3 font-medium">{venda.numero}</td>
                    <td className="px-2 py-3">{venda.clienteNome}</td>
                    <td className="px-2 py-3">{rotuloFormaPagamento(venda.formaPagamento)}</td>
                    <td className="px-2 py-3">
                      <BadgeStatus variante="info">{rotuloStatus(venda.status)}</BadgeStatus>
                    </td>
                    <td className="px-2 py-3">{venda.separacoes.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardPadrao>
    </div>
  )
}

export default function PaginaReceberPagamento() {
  return (
    <ProtegerRota chaveDaPagina="receber-pagamento">
      <ConteudoDaPagina />
    </ProtegerRota>
  )
}
