'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ComprovanteRecebimento } from '@/components/receber-pagamento/comprovante-recebimento'
import { PassoPagamentoTotem } from '@/components/receber-pagamento/passo-pagamento-totem'
import { TecladoNumericoTotem } from '@/components/receber-pagamento/teclado-numerico-totem'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { usePermissao } from '@/hooks/use-permissao'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { fraseSeparacoes, type FormaPagamentoUi } from '@/lib/receber-pagamento-desenvolvimento'
import {
  formaConfirmavelNoTotem,
  formaPadraoDoOrcamento,
  formatarMoeda,
  formatarVisorTotem,
  limiteDigitosTotem,
  soDigitosTotem,
  termoBuscaLeitor,
  termoBuscaTotem,
  type ModoBuscaTotem,
  type OrcamentoRecebimento,
} from '@/lib/receber-pagamento-orcamento'
import {
  normalizarFormaTotemTouch,
  type FormaTotemTouch,
  type OpcoesTotemRecebimento,
} from '@/lib/receber-pagamento-totem'
import { cn } from '@/lib/utils'
import { clienteHttp } from '@/services/api'

type PassoTotem = 'identificacao' | 'pagamento' | 'confirmacao'

function PassoIndicador({ passo }: { passo: PassoTotem }) {
  const passos: Array<{ id: PassoTotem; rotulo: string }> = [
    { id: 'identificacao', rotulo: 'Identificação' },
    { id: 'pagamento', rotulo: 'Pagamento' },
    { id: 'confirmacao', rotulo: 'Confirmação' },
  ]
  const ordem = passos.findIndex((item) => item.id === passo)
  return (
    <ol className="flex flex-wrap items-center justify-center gap-2 text-xs print:hidden sm:text-sm">
      {passos.map((item, indice) => {
        const ativo = indice <= ordem
        return (
          <li
            key={item.id}
            className={cn(
              'rounded-full px-3 py-1.5',
              ativo ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            {indice + 1}. {item.rotulo}
          </li>
        )
      })}
    </ol>
  )
}

function CabecalhoTotem({ empresaNome, agora }: { empresaNome: string; agora: string }) {
  return (
    <header className="flex items-start justify-between gap-4 print:hidden">
      <div>
        <p className="text-sm text-muted-foreground">Autoatendimento</p>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{empresaNome}</h1>
      </div>
      <p className="shrink-0 text-right text-sm text-muted-foreground">{agora}</p>
    </header>
  )
}

function ConteudoTotem() {
  const { perfil, encerrarSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('vendas:create')
  const [passo, setPasso] = useState<PassoTotem>('identificacao')
  const [modoBusca, setModoBusca] = useState<ModoBuscaTotem>('numero')
  const [digitos, setDigitos] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultados, setResultados] = useState<OrcamentoRecebimento[]>([])
  const [orcamento, setOrcamento] = useState<OrcamentoRecebimento | null>(null)
  const [modoTrocarForma, setModoTrocarForma] = useState(false)
  const [forma, setForma] = useState<FormaTotemTouch>('pix')
  const [numeroParcelas, setNumeroParcelas] = useState<number | null>(null)
  const [opcoesTotem, setOpcoesTotem] = useState<OpcoesTotemRecebimento>({
    chavePix: null,
    parcelasCredito: [],
  })
  const [gravando, setGravando] = useState(false)
  const [mensagemOk, setMensagemOk] = useState('')
  const [formaConfirmada, setFormaConfirmada] = useState<string | null>(null)
  const [parcelasConfirmadas, setParcelasConfirmadas] = useState<number | null>(null)
  const [exibirItens, setExibirItens] = useState(false)

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

  const visor = useMemo(() => formatarVisorTotem(modoBusca, digitos), [modoBusca, digitos])
  const termoValido = useMemo(
    () => termoBuscaTotem(modoBusca, digitos),
    [modoBusca, digitos]
  )

  useEffect(() => {
    if (!podeCriar) return
    clienteHttp
      .get<OpcoesTotemRecebimento>('/receber-pagamento/opcoes-totem')
      .then(({ data }) =>
        setOpcoesTotem({
          chavePix: data.chavePix ?? null,
          parcelasCredito: data.parcelasCredito ?? [],
        })
      )
      .catch(() =>
        setOpcoesTotem({
          chavePix: null,
          parcelasCredito: [],
        })
      )
  }, [podeCriar])

  const podeConfirmarForma = useMemo(() => {
    if (!orcamento) return false
    return formaConfirmavelNoTotem(orcamento.condicaoPagamento, forma as FormaPagamentoUi)
  }, [orcamento, forma])

  const reiniciar = useCallback(() => {
    setPasso('identificacao')
    setDigitos('')
    setResultados([])
    setOrcamento(null)
    setModoTrocarForma(false)
    setForma('pix')
    setNumeroParcelas(null)
    setErro('')
    setMensagemOk('')
    setFormaConfirmada(null)
    setParcelasConfirmadas(null)
    setExibirItens(false)
  }, [])

  const abrirOrcamento = useCallback((item: OrcamentoRecebimento) => {
    const formaInicial = normalizarFormaTotemTouch(formaPadraoDoOrcamento(item.condicaoPagamento))
    setOrcamento(item)
    setForma(formaInicial)
    setNumeroParcelas(
      formaInicial === 'cartao_credito'
        ? (opcoesTotem.parcelasCredito[0]?.numeroParcelas ?? null)
        : null
    )
    setModoTrocarForma(false)
    setPasso('pagamento')
    setErro('')
    setResultados([])
    setExibirItens(false)
  }, [opcoesTotem.parcelasCredito])

  const executarBusca = useCallback(
    async (termoApi: string) => {
      setBuscando(true)
      setErro('')
      setResultados([])
      setMensagemOk('')
      try {
        const { data } = await clienteHttp.get<{ orcamentos: OrcamentoRecebimento[] }>(
          '/receber-pagamento/orcamentos/busca',
          { params: { termo: termoApi } }
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
    },
    [abrirOrcamento]
  )

  const buscar = useCallback(() => {
    const termo = termoBuscaTotem(modoBusca, digitos)
    if (!termo) return
    void executarBusca(termo)
  }, [modoBusca, digitos, executarBusca])

  useEffect(() => {
    if (passo !== 'identificacao' || resultados.length > 0) return

    let buffer = ''
    let timer: number | undefined

    function limparBuffer() {
      buffer = ''
    }

    function onKeyDown(evento: KeyboardEvent) {
      if (evento.ctrlKey || evento.altKey || evento.metaKey) return
      if (evento.key === 'Enter') {
        if (!buffer.trim()) return
        evento.preventDefault()
        const termo = termoBuscaLeitor(buffer)
        buffer = ''
        if (termo) void executarBusca(termo)
        return
      }
      if (evento.key.length === 1) {
        buffer += evento.key
        window.clearTimeout(timer)
        timer = window.setTimeout(limparBuffer, 500)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(timer)
    }
  }, [passo, resultados.length, executarBusca])

  function trocarModoBusca(modo: ModoBuscaTotem) {
    setModoBusca(modo)
    setDigitos('')
    setErro('')
    setResultados([])
  }

  function adicionarDigito(digito: string) {
    setErro('')
    setDigitos((atual) => {
      const limpo = soDigitosTotem(atual + digito)
      const max = limiteDigitosTotem(modoBusca)
      return limpo.slice(0, max)
    })
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
      setDigitos('')
      setExibirItens(false)
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
      const corpo: {
        formaPagamento: FormaTotemTouch
        origem: 'totem'
        numeroParcelas?: number
      } = { formaPagamento: forma, origem: 'totem' }
      if (forma === 'cartao_credito' && numeroParcelas) {
        corpo.numeroParcelas = numeroParcelas
      }
      const { data } = await clienteHttp.post<{
        venda: { separacoes: number[]; numeroParcelas?: number | null }
      }>(`/receber-pagamento/orcamentos/${orcamento.id}`, corpo)
      setFormaConfirmada(forma)
      setParcelasConfirmadas(data.venda.numeroParcelas ?? numeroParcelas)
      setMensagemOk(fraseSeparacoes(data.venda.separacoes ?? []))
      setPasso('confirmacao')
      window.setTimeout(() => window.print(), 300)
    } catch (falha: unknown) {
      setErro(extrairMensagemApi(falha, 'Não foi possível confirmar o pagamento.'))
    } finally {
      setGravando(false)
    }
  }

  function selecionarForma(nova: FormaTotemTouch) {
    setForma(nova)
    if (nova === 'cartao_credito') {
      setNumeroParcelas(opcoesTotem.parcelasCredito[0]?.numeroParcelas ?? null)
    } else {
      setNumeroParcelas(null)
    }
  }

  if (!podeCriar) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-4 p-6">
        <p className="text-lg text-muted-foreground">Sem permissão para confirmar o pagamento.</p>
        <Button type="button" variant="outline" onClick={encerrarSessao}>
          Sair
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh justify-center bg-background print:min-h-0">
      <div className="flex w-full max-w-3xl flex-col gap-5 p-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] sm:gap-6 sm:p-6">
        <CabecalhoTotem empresaNome={empresaNome} agora={agora} />
        <PassoIndicador passo={passo} />

        {mensagemOk && passo === 'identificacao' ? (
          <p className="text-center text-sm font-medium text-emerald-700 dark:text-emerald-300" role="status">
            {mensagemOk}
          </p>
        ) : null}

        {passo === 'identificacao' ? (
          <div className="flex flex-1 flex-col gap-5 print:hidden">
            {resultados.length === 0 ? (
              <>
                <div>
                  <p className="mb-3 text-center text-lg font-semibold text-foreground">
                    Como você quer buscar?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => trocarModoBusca('numero')}
                      className={cn(
                        'flex min-h-[88px] flex-col items-center justify-center rounded-xl border-2 px-3 py-4 text-center transition-colors',
                        modoBusca === 'numero'
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-card text-muted-foreground'
                      )}
                    >
                      <span className="text-base font-semibold">Número do</span>
                      <span className="text-base font-semibold">orçamento</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => trocarModoBusca('documento')}
                      className={cn(
                        'flex min-h-[88px] flex-col items-center justify-center rounded-xl border-2 px-3 py-4 text-center transition-colors',
                        modoBusca === 'documento'
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-card text-muted-foreground'
                      )}
                    >
                      <span className="text-base font-semibold">CPF / CNPJ</span>
                    </button>
                  </div>
                </div>

                <div
                  className="rounded-xl border border-border bg-muted/30 px-4 py-6 text-center"
                  aria-live="polite"
                >
                  <p className="font-mono text-2xl font-bold tracking-wide text-foreground sm:text-3xl">
                    {visor || (modoBusca === 'numero' ? 'ORC-' : '—')}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {modoBusca === 'numero'
                      ? 'Digite até 6 dígitos do orçamento'
                      : 'Informe CPF (11) ou CNPJ (14 dígitos)'}
                  </p>
                </div>

                {erro ? (
                  <p className="text-center text-sm text-destructive" role="alert">
                    {erro}
                  </p>
                ) : null}

                <TecladoNumericoTotem
                  buscando={buscando}
                  buscarHabilitado={Boolean(termoValido)}
                  onDigito={adicionarDigito}
                  onApagar={() => setDigitos((d) => soDigitosTotem(d).slice(0, -1))}
                  onLimpar={() => {
                    setDigitos('')
                    setErro('')
                  }}
                  onBuscar={buscar}
                />
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-center font-medium">Escolha o seu pedido</p>
                <ul className="space-y-2">
                  {resultados.map((item) => (
                    <li key={item.id}>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto min-h-14 w-full flex-col items-start gap-1 py-3 text-left sm:flex-row sm:items-center"
                        onClick={() => abrirOrcamento(item)}
                      >
                        <span className="font-semibold">{item.numero}</span>
                        <span className="text-muted-foreground">{item.clienteNome}</span>
                        <span className="sm:ml-auto sm:font-medium">{formatarMoeda(item.total)}</span>
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full min-h-11"
                  onClick={() => {
                    setResultados([])
                    setDigitos('')
                    setErro('')
                  }}
                >
                  Nova busca
                </Button>
              </div>
            )}
          </div>
        ) : null}

        {passo === 'pagamento' && orcamento ? (
          <PassoPagamentoTotem
            orcamento={orcamento}
            opcoes={opcoesTotem}
            forma={forma}
            numeroParcelas={numeroParcelas}
            modoTrocarForma={modoTrocarForma}
            exibirItens={exibirItens}
            gravando={gravando}
            erro={erro}
            podeConfirmarForma={podeConfirmarForma}
            onTrocarModoForma={setModoTrocarForma}
            onForma={selecionarForma}
            onParcelas={setNumeroParcelas}
            onToggleItens={() => setExibirItens((v) => !v)}
            onConfirmar={() => void confirmarPagamento()}
            onChamarAtendente={() => void chamarAtendente()}
            onVoltar={() => {
              setPasso('identificacao')
              setOrcamento(null)
              setErro('')
              setExibirItens(false)
              setModoTrocarForma(false)
            }}
          />
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
              numeroParcelas={parcelasConfirmadas}
              pago
            />
            <div className="flex flex-col gap-2 print:hidden">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => window.print()}>
                Imprimir
              </Button>
              <BotaoPrimario type="button" className="min-h-14" onClick={reiniciar}>
                Novo recebimento
              </BotaoPrimario>
            </div>
          </div>
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
