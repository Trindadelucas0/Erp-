'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Headphones, Search } from 'lucide-react'
import { ComprovanteRecebimento } from '@/components/receber-pagamento/comprovante-recebimento'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { InputPadrao } from '@/components/ui/input-padrao'
import { usePermissao } from '@/hooks/use-permissao'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  FORMAS_TOTEM_UI,
  fraseSeparacoes,
  type FormaPagamentoUi,
} from '@/lib/receber-pagamento-desenvolvimento'
import {
  formaConfirmavelNoTotem,
  formaEhCartao,
  formaPadraoDoOrcamento,
  formatarMoeda,
  rotuloCondicaoPagamento,
  totalLinhaOrcamento,
  type OrcamentoRecebimento,
} from '@/lib/receber-pagamento-orcamento'
import { clienteHttp } from '@/services/api'

type PassoTotem = 'identificacao' | 'pagamento' | 'confirmacao'
type ModoBusca = 'numero' | 'documento'

function PassoIndicador({ passo }: { passo: PassoTotem }) {
  const passos: Array<{ id: PassoTotem; rotulo: string }> = [
    { id: 'identificacao', rotulo: 'Identificação' },
    { id: 'pagamento', rotulo: 'Pagamento' },
    { id: 'confirmacao', rotulo: 'Confirmação' },
  ]
  const ordem = passos.findIndex((item) => item.id === passo)
  return (
    <ol className="flex flex-wrap items-center justify-center gap-2 text-sm print:hidden">
      {passos.map((item, indice) => {
        const ativo = indice <= ordem
        return (
          <li
            key={item.id}
            className={`rounded-full px-3 py-1 ${ativo ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            {indice + 1}. {item.rotulo}
          </li>
        )
      })}
    </ol>
  )
}

function ConteudoTotem() {
  const { perfil, encerrarSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('vendas:create')
  const [passo, setPasso] = useState<PassoTotem>('identificacao')
  const [modoBusca, setModoBusca] = useState<ModoBusca>('numero')
  const [termo, setTermo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultados, setResultados] = useState<OrcamentoRecebimento[]>([])
  const [orcamento, setOrcamento] = useState<OrcamentoRecebimento | null>(null)
  const [alterarForma, setAlterarForma] = useState(false)
  const [forma, setForma] = useState<FormaPagamentoUi>('pix')
  const [chavePix, setChavePix] = useState<string | null>(null)
  const [gravando, setGravando] = useState(false)
  const [mensagemOk, setMensagemOk] = useState('')
  const [formaConfirmada, setFormaConfirmada] = useState<string | null>(null)

  const empresaNome = useMemo(() => {
    const empresaId = typeof window !== 'undefined' ? localStorage.getItem('empresaAtivaId') : null
    const empresas = perfil?.empresas ?? []
    const ativa = empresas.find((e) => e.company.id === empresaId) ?? empresas[0]
    return ativa?.company.name ?? 'Autoatendimento'
  }, [perfil])

  const agora = useMemo(() => {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date())
  }, [])

  useEffect(() => {
    if (!podeCriar) return
    clienteHttp
      .get<{ chavePix: string | null }>('/receber-pagamento/chave-pix')
      .then(({ data }) => setChavePix(data.chavePix))
      .catch(() => setChavePix(null))
  }, [podeCriar])

  const podeConfirmarForma = useMemo(() => {
    if (!orcamento) return false
    return formaConfirmavelNoTotem(orcamento.condicaoPagamento, forma)
  }, [orcamento, forma])

  const reiniciar = useCallback(() => {
    setPasso('identificacao')
    setTermo('')
    setResultados([])
    setOrcamento(null)
    setAlterarForma(false)
    setForma('pix')
    setErro('')
    setMensagemOk('')
    setFormaConfirmada(null)
  }, [])

  async function buscar() {
    const limpo = termo.trim()
    if (!limpo) return
    setBuscando(true)
    setErro('')
    setResultados([])
    try {
      const { data } = await clienteHttp.get<{ orcamentos: OrcamentoRecebimento[] }>(
        '/receber-pagamento/orcamentos/busca',
        { params: { termo: limpo } }
      )
      const lista = data.orcamentos ?? []
      if (lista.length === 0) {
        setErro('Orçamento não encontrado.')
        return
      }
      const recebidos = lista.filter((item) => item.jaRecebido)
      if (recebidos.length === lista.length && lista.length === 1) {
        setErro('Este orçamento já foi recebido.')
        return
      }
      const abertos = lista.filter((item) => !item.jaRecebido)
      if (abertos.length === 1) {
        abrirOrcamento(abertos[0]!)
        return
      }
      setResultados(abertos)
    } catch (falha: unknown) {
      setErro(extrairMensagemApi(falha, 'Não foi possível buscar o orçamento.'))
    } finally {
      setBuscando(false)
    }
  }

  function abrirOrcamento(item: OrcamentoRecebimento) {
    setOrcamento(item)
    setForma(formaPadraoDoOrcamento(item.condicaoPagamento))
    setAlterarForma(false)
    setPasso('pagamento')
    setErro('')
    setResultados([])
  }

  async function chamarAtendente() {
    if (!orcamento) return
    setGravando(true)
    setErro('')
    try {
      await clienteHttp.post(`/receber-pagamento/orcamentos/${orcamento.id}/chamar`)
      setMensagemOk('Um atendente foi chamado. Aguarde na loja.')
      setPasso('identificacao')
      setOrcamento(null)
      setResultados([])
      setTermo('')
    } catch (falha: unknown) {
      setErro(extrairMensagemApi(falha, 'Não foi possível chamar o atendente.'))
    } finally {
      setGravando(false)
    }
  }

  async function confirmarPagamento() {
    if (!orcamento || !podeConfirmarForma) return
    setGravando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.post<{ venda: { separacoes: number[] } }>(
        `/receber-pagamento/orcamentos/${orcamento.id}`,
        { formaPagamento: forma, origem: 'totem' }
      )
      setFormaConfirmada(forma)
      setMensagemOk(fraseSeparacoes(data.venda.separacoes ?? []))
      setPasso('confirmacao')
      window.setTimeout(() => window.print(), 300)
    } catch (falha: unknown) {
      setErro(extrairMensagemApi(falha, 'Não foi possível confirmar o pagamento.'))
    } finally {
      setGravando(false)
    }
  }

  if (!podeCriar) {
    return (
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-4 p-6">
        <p className="text-lg text-muted-foreground">Sem permissão para confirmar o pagamento.</p>
        <Button type="button" variant="outline" onClick={encerrarSessao}>
          Sair
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-sm text-muted-foreground">Autoatendimento</p>
          <h1 className="text-2xl font-bold text-foreground">{empresaNome}</h1>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>{agora}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => {
              if (!orcamento) {
                setErro('Informe o orçamento antes de chamar um atendente.')
                return
              }
              void chamarAtendente()
            }}
          >
            <Headphones className="mr-1 size-4" />
            Precisa de ajuda?
          </Button>
        </div>
      </header>

      <PassoIndicador passo={passo} />

      {passo === 'identificacao' ? (
        <CardPadrao titulo="Olá! Vamos receber o seu pedido?">
          <p className="mb-4 text-muted-foreground">
            Informe o número do orçamento ou o seu CPF/CNPJ para continuar.
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant={modoBusca === 'numero' ? 'default' : 'outline'}
              onClick={() => setModoBusca('numero')}
            >
              Número do orçamento
            </Button>
            <Button
              type="button"
              variant={modoBusca === 'documento' ? 'default' : 'outline'}
              onClick={() => setModoBusca('documento')}
            >
              CPF/CNPJ
            </Button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <InputPadrao
              rotulo={modoBusca === 'numero' ? 'Número do orçamento' : 'CPF/CNPJ'}
              value={termo}
              onChange={(evento) => setTermo(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter') void buscar()
              }}
              placeholder={modoBusca === 'numero' ? 'Digite ou bipe o número' : 'Somente números'}
            />
            <BotaoPrimario
              type="button"
              className="min-h-11 sm:self-end"
              disabled={buscando || !termo.trim()}
              onClick={() => void buscar()}
            >
              <Search className="mr-1 size-4" />
              {buscando ? 'Buscando…' : 'Buscar'}
            </BotaoPrimario>
          </div>
          {resultados.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {resultados.map((item) => (
                <li key={item.id}>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full justify-start py-3 text-left"
                    onClick={() => abrirOrcamento(item)}
                  >
                    <span className="font-medium">{item.numero}</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span>{item.clienteNome}</span>
                    <span className="ml-auto">{formatarMoeda(item.total)}</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </CardPadrao>
      ) : null}

      {passo === 'pagamento' && orcamento ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <CardPadrao titulo="Forma de pagamento do seu pedido">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                Pré-definida: {rotuloCondicaoPagamento(orcamento.condicaoPagamento)}
              </span>
              <Button type="button" size="sm" variant="outline" onClick={() => setAlterarForma((v) => !v)}>
                Alterar
              </Button>
            </div>
            {(alterarForma || !orcamento.condicaoPagamento) && (
              <div className="mb-4 grid gap-2 sm:grid-cols-2">
                {FORMAS_TOTEM_UI.map((opcao) => (
                  <Button
                    key={opcao.valor}
                    type="button"
                    size="lg"
                    variant={forma === opcao.valor ? 'default' : 'outline'}
                    disabled={gravando}
                    onClick={() => setForma(opcao.valor)}
                  >
                    {opcao.rotulo}
                  </Button>
                ))}
              </div>
            )}

            {forma === 'pix' && podeConfirmarForma ? (
              <div className="mb-4 rounded-lg border border-border bg-muted/40 p-4">
                <p className="font-medium">Pix — aprovação imediata</p>
                {chavePix ? (
                  <p className="mt-2 break-all text-lg">{chavePix}</p>
                ) : (
                  <p className="mt-2 text-muted-foreground">Chave Pix não cadastrada.</p>
                )}
                <BotaoPrimario
                  type="button"
                  className="mt-4 min-h-12 w-full"
                  disabled={gravando}
                  onClick={() => void confirmarPagamento()}
                >
                  {gravando ? 'Confirmando…' : 'Confirmar pagamento'}
                </BotaoPrimario>
              </div>
            ) : null}

            {formaEhCartao(forma) && podeConfirmarForma ? (
              <div className="mb-4 rounded-lg border border-border bg-muted/40 p-4">
                <p className="font-medium">Passe o cartão na maquininha.</p>
                <p className="text-sm text-muted-foreground">A venda só conclui após aprovação.</p>
                <BotaoPrimario
                  type="button"
                  className="mt-4 min-h-12 w-full"
                  disabled={gravando}
                  onClick={() => void confirmarPagamento()}
                >
                  {gravando ? 'Aguardando…' : 'Aprovado na maquininha'}
                </BotaoPrimario>
              </div>
            ) : null}

            {forma === 'boleto' && podeConfirmarForma ? (
              <div className="mb-4">
                <p className="mb-3 text-sm text-muted-foreground">Boleto — confirme para registrar e separar o pedido.</p>
                <BotaoPrimario
                  type="button"
                  className="min-h-12 w-full"
                  disabled={gravando}
                  onClick={() => void confirmarPagamento()}
                >
                  Confirmar pagamento
                </BotaoPrimario>
              </div>
            ) : null}

            {!podeConfirmarForma ? (
              <p className="text-sm text-muted-foreground">
                Para dinheiro ou à vista, chame um atendente no caixa.
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3 print:hidden">
              <Button type="button" variant="outline" onClick={() => setPasso('identificacao')}>
                Voltar
              </Button>
              <Button type="button" variant="outline" disabled={gravando} onClick={() => void chamarAtendente()}>
                Chame um atendente
              </Button>
            </div>
          </CardPadrao>

          <CardPadrao titulo={`Orçamento ${orcamento.numero}`}>
            <p className="font-medium">{orcamento.clienteNome}</p>
            <p className="text-sm text-muted-foreground">{orcamento.data}</p>
            <ul className="mt-4 space-y-3">
              {orcamento.itens.map((item) => (
                <li key={item.id} className="flex justify-between gap-2 border-b border-border/60 pb-2 text-sm">
                  <span>
                    {item.descricao || item.codigo} · {item.quantidade} {item.unidade}
                  </span>
                  <span>{formatarMoeda(totalLinhaOrcamento(item))}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span>Desconto</span>
                <span>{formatarMoeda(orcamento.descontoTotal)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-primary">
                <span>Total do pedido</span>
                <span>{formatarMoeda(orcamento.total)}</span>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Após a confirmação do pagamento, seu pedido será liberado automaticamente para separação.
            </p>
          </CardPadrao>
        </div>
      ) : null}

      {passo === 'confirmacao' && orcamento ? (
        <div className="space-y-4">
          <p className="text-center text-lg font-medium print:hidden" role="status">
            {mensagemOk}
          </p>
          <ComprovanteRecebimento
            empresaNome={empresaNome}
            orcamento={orcamento}
            formaPagamento={formaConfirmada}
            pago
          />
          <div className="flex flex-wrap justify-center gap-3 print:hidden">
            <Button type="button" variant="outline" onClick={() => window.print()}>
              Imprimir
            </Button>
            <BotaoPrimario type="button" onClick={reiniciar}>
              Novo recebimento
            </BotaoPrimario>
          </div>
        </div>
      ) : null}

      {erro ? (
        <p className="text-center text-sm text-destructive print:hidden" role="alert">
          {erro}
        </p>
      ) : null}

      <p className="text-center text-xs text-muted-foreground print:hidden">
        Pagamento 100% seguro — Seus dados são protegidos
      </p>

      <div className="print:hidden">
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={encerrarSessao}>
          Sair
        </Button>
      </div>
    </div>
  )
}

export default function PaginaTotemReceberPagamento() {
  return (
    <ProtegerRota chaveDaPagina="receber-pagamento">
      <ConteudoTotem />
    </ProtegerRota>
  )
}
