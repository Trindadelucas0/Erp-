'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Printer, Plus } from 'lucide-react'
import { ComprovanteRecebimento } from '@/components/receber-pagamento/comprovante-recebimento'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { BadgeStatus } from '@/components/ui/badge-status'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { InputPadrao } from '@/components/ui/input-padrao'
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
import {
  formaPadraoDoOrcamento,
  formatarMoeda,
  rotuloCondicaoPagamento,
  totalLinhaOrcamento,
  type OrcamentoListaReceber,
  type OrcamentoRecebimento,
} from '@/lib/receber-pagamento-orcamento'
import { OPCOES_VENDEDOR_ORCAMENTO } from '@/lib/orcamento-layout'
import { clienteHttp } from '@/services/api'
import { useRouter } from 'next/navigation'

type VendaPaga = {
  id: string
  numero: number
  clienteNome: string
  status: string
  formaPagamento: string | null
  separacoes: number[]
}

function rotuloVendedor(id: string) {
  const rotulo = OPCOES_VENDEDOR_ORCAMENTO.find((item) => item.value === id)?.label
  return rotulo ?? (id || '—')
}

function ConteudoDaPagina() {
  const roteador = useRouter()
  const { perfil } = useSessaoDoUsuario()
  const podeCriar = usePermissao('vendas:create')
  const [lista, setLista] = useState<OrcamentoListaReceber[]>([])
  const [vendas, setVendas] = useState<VendaPaga[]>([])
  const [filtro, setFiltro] = useState('')
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<OrcamentoRecebimento | null>(null)
  const [forma, setForma] = useState<FormaPagamentoUi>('dinheiro')
  const [valorRecebido, setValorRecebido] = useState('')
  const [observacao, setObservacao] = useState('')
  const [alterarForma, setAlterarForma] = useState(false)
  const [erro, setErro] = useState('')
  const [erroReceber, setErroReceber] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [ultimaFormaPaga, setUltimaFormaPaga] = useState<string | null>(null)

  const empresaNome = useMemo(() => {
    const empresaId = typeof window !== 'undefined' ? localStorage.getItem('empresaAtivaId') : null
    const empresas = perfil?.empresas ?? []
    const ativa = empresas.find((e) => e.company.id === empresaId) ?? empresas[0]
    return ativa?.company.name ?? 'Empresa'
  }, [perfil])

  const carregar = useCallback(() => {
    setCarregando(true)
    setErro('')
    Promise.all([
      clienteHttp.get<{ orcamentos: OrcamentoListaReceber[] }>('/receber-pagamento/a-receber'),
      clienteHttp.get<{ vendas: VendaPaga[] }>('/receber-pagamento'),
    ])
      .then(([aReceber, pagas]) => {
        setLista(aReceber.data.orcamentos ?? [])
        setVendas(pagas.data.vendas ?? [])
      })
      .catch((falha: unknown) => {
        setErro(extrairMensagemApi(falha, 'Não foi possível carregar os orçamentos.'))
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

  const filtrados = useMemo(() => {
    const termo = filtro.trim().toLowerCase()
    if (!termo) return lista
    return lista.filter(
      (item) =>
        item.numero.toLowerCase().includes(termo) ||
        item.clienteNome.toLowerCase().includes(termo)
    )
  }, [filtro, lista])

  const selecionado = filtrados.find((item) => item.id === selecionadoId) ?? null

  const troco = useMemo(() => {
    if (!detalhe || forma !== 'dinheiro') return 0
    const recebido = Number(valorRecebido.replace(',', '.'))
    if (!Number.isFinite(recebido)) return 0
    return Math.max(0, recebido - detalhe.total)
  }, [detalhe, forma, valorRecebido])

  const podeReceber = useMemo(() => {
    if (!detalhe || !podeCriar) return false
    if (forma === 'dinheiro') {
      const recebido = Number(valorRecebido.replace(',', '.'))
      return Number.isFinite(recebido) && recebido + 0.0001 >= detalhe.total
    }
    return true
  }, [detalhe, forma, podeCriar, valorRecebido])

  async function carregarDetalhe(id: string, condicao: string) {
    setCarregandoDetalhe(true)
    setErroReceber('')
    setSelecionadoId(id)
    setUltimaFormaPaga(null)
    try {
      const { data } = await clienteHttp.get<{ orcamento: OrcamentoRecebimento }>(
        `/receber-pagamento/orcamentos/${id}`
      )
      setDetalhe(data.orcamento)
      const cond = condicao || data.orcamento.condicaoPagamento
      setForma(
        cond === 'dinheiro' || cond === 'a_vista'
          ? 'dinheiro'
          : formaPadraoDoOrcamento(cond)
      )
      setValorRecebido(String(data.orcamento.total))
      setObservacao('')
      setAlterarForma(false)
    } catch (falha: unknown) {
      setDetalhe(null)
      setErroReceber(extrairMensagemApi(falha, 'Não foi possível abrir o orçamento.'))
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  async function receberPagamento() {
    if (!detalhe || !podeReceber) return
    setGravando(true)
    setErroReceber('')
    try {
      const corpo: {
        formaPagamento: FormaPagamentoUi
        origem: 'caixa'
        valorRecebido?: number
        observacao?: string
      } = {
        formaPagamento: forma,
        origem: 'caixa',
      }
      if (forma === 'dinheiro') {
        corpo.valorRecebido = Number(valorRecebido.replace(',', '.'))
      }
      if (observacao.trim()) corpo.observacao = observacao.trim()

      const { data } = await clienteHttp.post<{ venda: { separacoes: number[] } }>(
        `/receber-pagamento/orcamentos/${detalhe.id}`,
        corpo
      )
      setUltimaFormaPaga(forma)
      setAviso(fraseSeparacoes(data.venda.separacoes ?? []))
      carregar()
      window.setTimeout(() => window.print(), 300)
    } catch (falha: unknown) {
      setErroReceber(extrairMensagemApi(falha, 'Não foi possível receber o pagamento.'))
    } finally {
      setGravando(false)
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <TituloPagina
        caminho="Vendas > Receber pagamento"
        subtitulo="Receba orçamentos enviados. Dinheiro e chamados do totem ficam aqui."
      >
        Receber pagamento
      </TituloPagina>

      {aviso ? (
        <p className="text-sm text-foreground" role="status">
          {aviso}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <CardPadrao
          titulo="A receber"
          acoes={
            podeCriar ? (
              <Button type="button" variant="outline" onClick={() => roteador.push('/receber-pagamento/totem')}>
                <Plus className="mr-1 size-4 inline" />
                Abrir totem
              </Button>
            ) : null
          }
        >
          <InputPadrao
            rotulo="Buscar"
            value={filtro}
            onChange={(evento) => setFiltro(evento.target.value)}
            placeholder="Número, cliente…"
            className="mb-4 print:hidden"
          />
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
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum orçamento a receber.</p>
          ) : (
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <caption className="sr-only">Orçamentos a receber</caption>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Nº</th>
                    <th className="px-2 py-2 font-medium">Data</th>
                    <th className="px-2 py-2 font-medium">Cliente</th>
                    <th className="px-2 py-2 font-medium">Total</th>
                    <th className="px-2 py-2 font-medium">Forma</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((item) => (
                    <tr
                      key={item.id}
                      className={`cursor-pointer border-b border-border/70 ${selecionadoId === item.id ? 'bg-primary/10' : ''}`}
                      onClick={() => void carregarDetalhe(item.id, item.condicaoPagamento)}
                    >
                      <td className="px-2 py-3 font-medium">{item.numero}</td>
                      <td className="px-2 py-3">{item.data}</td>
                      <td className="px-2 py-3">{item.clienteNome}</td>
                      <td className="px-2 py-3">{formatarMoeda(item.total)}</td>
                      <td className="px-2 py-3">
                        {item.chamadoAtendente ? (
                          <BadgeStatus variante="pendente">Chamado</BadgeStatus>
                        ) : (
                          rotuloCondicaoPagamento(item.condicaoPagamento)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardPadrao>

        <CardPadrao titulo={detalhe ? `Orçamento ${detalhe.numero}` : 'Detalhe do pagamento'}>
          {carregandoDetalhe ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !detalhe ? (
            <p className="text-sm text-muted-foreground">Selecione um orçamento na lista.</p>
          ) : (
            <>
              <div className="print:hidden">
                <p className="font-medium">{detalhe.clienteNome}</p>
                <p className="text-sm text-muted-foreground">
                  {detalhe.data} · {rotuloVendedor(detalhe.vendedorId)}
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {detalhe.itens.map((item) => (
                    <li key={item.id} className="flex justify-between gap-2 border-b border-border/60 pb-1">
                      <span>
                        {item.descricao || item.codigo} · {item.quantidade}
                      </span>
                      <span>{formatarMoeda(totalLinhaOrcamento(item))}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-lg font-bold text-primary">
                  Total: {formatarMoeda(detalhe.total)}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Forma: {rotuloFormaPagamento(forma)}
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={() => setAlterarForma((v) => !v)}>
                    Alterar
                  </Button>
                </div>
                {alterarForma ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {FORMAS_PAGAMENTO_UI.map((opcao) => (
                      <Button
                        key={opcao.valor}
                        type="button"
                        size="sm"
                        variant={forma === opcao.valor ? 'default' : 'outline'}
                        onClick={() => setForma(opcao.valor)}
                      >
                        {opcao.rotulo}
                      </Button>
                    ))}
                  </div>
                ) : null}

                <p className="mt-4 text-sm font-medium">Valor a receber: {formatarMoeda(detalhe.total)}</p>

                {forma === 'dinheiro' ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <InputPadrao
                      rotulo="Valor recebido"
                      inputMode="decimal"
                      value={valorRecebido}
                      onChange={(evento) => setValorRecebido(evento.target.value)}
                    />
                    <InputPadrao rotulo="Troco" value={formatarMoeda(troco)} readOnly className="bg-muted" />
                  </div>
                ) : null}

                <InputPadrao
                  rotulo="Observações"
                  value={observacao}
                  onChange={(evento) => setObservacao(evento.target.value)}
                  className="mt-3"
                />

                {erroReceber ? (
                  <p className="mt-3 text-sm text-destructive" role="alert">
                    {erroReceber}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <BotaoPrimario type="button" disabled={gravando || !podeReceber} onClick={() => void receberPagamento()}>
                    {gravando ? 'Recebendo…' : 'Receber pagamento'}
                  </BotaoPrimario>
                  <Button type="button" variant="outline" onClick={() => window.print()}>
                    <Printer className="mr-1 size-4" />
                    Imprimir
                  </Button>
                </div>
              </div>

              {ultimaFormaPaga ? (
                <div className="mt-6 border-t pt-4">
                  <ComprovanteRecebimento
                    empresaNome={empresaNome}
                    orcamento={detalhe}
                    formaPagamento={ultimaFormaPaga}
                    valorRecebido={
                      ultimaFormaPaga === 'dinheiro'
                        ? Number(valorRecebido.replace(',', '.'))
                        : null
                    }
                    pago
                  />
                </div>
              ) : (
                <div className="hidden print:block">
                  <ComprovanteRecebimento
                    empresaNome={empresaNome}
                    orcamento={detalhe}
                    formaPagamento={forma}
                    valorRecebido={
                      forma === 'dinheiro' ? Number(valorRecebido.replace(',', '.')) : null
                    }
                    pago={false}
                  />
                </div>
              )}
            </>
          )}
        </CardPadrao>
      </div>

      <CardPadrao titulo="Vendas pagas">
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
                  <th className="px-2 py-2 font-medium">Separações</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((venda) => (
                  <tr key={venda.id} className="border-b border-border/70">
                    <td className="px-2 py-3 font-medium">{venda.numero}</td>
                    <td className="px-2 py-3">{venda.clienteNome}</td>
                    <td className="px-2 py-3">{rotuloFormaPagamento(venda.formaPagamento)}</td>
                    <td className="px-2 py-3">{venda.separacoes.join(', ') || '—'}</td>
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
