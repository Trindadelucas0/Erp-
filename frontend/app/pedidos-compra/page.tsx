'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Copy, FileSearch, History, Package, Pencil, Plus, Trash2, Truck } from 'lucide-react'
import { BlocoPagamentoPrazos, type PrazoPagamento } from '@/components/pedidos-compra/bloco-pagamento-prazos'
import { ComboboxProduto } from '@/components/pedidos-compra/combobox-produto'
import { ModalCompararPdf } from '@/components/pedidos-compra/modal-comparar-pdf'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { usePermissao } from '@/hooks/use-permissao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { InputPadrao } from '@/components/ui/input-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { BadgeStatus } from '@/components/ui/badge-status'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  montarPrazosParaPayload,
  validarSomaParcelasManual,
} from '@/lib/parcelas-pagamento-pedido'
import { calcularDiasEntreDatas, calcularVencimentoPorDias } from '@/lib/prazos-pagamento'
import {
  preencherItemComProduto,
  rotuloOrigemPreco,
} from '@/lib/preencher-item-pedido-compra'
import {
  formatarPedido,
  podeConcluirPedido,
  rotuloStatusUi,
  tituloModalPedido,
  varianteStatusUi,
} from '@/lib/status-pedido-compra'

type FiltroStatus =
  | 'todos'
  | 'aberto'
  | 'rascunho'
  | 'enviado'
  | 'parcial'
  | 'recebido'
  | 'cancelado'

type ItemPedido = {
  id?: string
  produtoId: string
  produtoNome?: string
  produtoSku?: string | null
  codigoOriginal: string
  quantidade: string
  unidade: string
  precoUnitario: string
  percentualDesconto: string
  valorDesconto: string
  outrasDespesas: string
  previsaoEntrega: string
  origemPreco?: 'estoque' | 'historico' | ''
  total?: number
  totalLiquido?: number
}

type PedidoCompra = {
  id: string
  numero: number
  fornecedorPessoaId: string
  fornecedorNome: string
  transportadoraPessoaId: string | null
  transportadoraNome: string | null
  modalidadeTransporte: string | null
  condicaoPagamento: string | null
  status: string
  motivoCancelamento: string | null
  descricao: string | null
  observacoes: string | null
  pedidoVendaId: string | null
  creditoFornecedorId: string | null
  creditoAplicado: number | null
  totalPedido: number
  totalLiquido: number
  createdAt: string
  itens: ItemPedido[]
}

type ProdutoOpcao = {
  id: string
  nomeVenda: string
  sku: string | null
  unidade: string
  codigoOrigem: string | null
  precoCusto: number | null
  bloqueadoCompra: boolean
  fornecedores: {
    fornecedorPessoaId: string
    codigoFornecedor: string | null
    unidadeEntrada: string | null
  }[]
}
type PessoaOpcao = { id: string; nome: string }

type EntradaFornecedor = {
  id: string
  numero: number
  descricao: string | null
  status: string
  totalLiquido: number
  data: string
  itens: number
}

type HistoricoCompra = {
  pedidoNumero: number
  fornecedorNome: string
  data: string
  quantidade: number
  precoUnitario: number
  precoCusto: number
  status: string
}

type PedidoVendaOpcao = {
  id: string
  numero: number
  clienteNome: string
  status: string
}

type ContextoFornecedor = {
  pedidosAbertos: PedidoCompra[]
  creditos: { id: string; saldo: number; origem: string | null }[]
  pendencias: { id: string; tipo: string; descricao: string }[]
  ultimasEntradas: EntradaFornecedor[]
  historicoComprasProduto: HistoricoCompra[]
}

const FILTRO_STATUS_OPCOES: { value: FiltroStatus; label: string }[] = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'aberto', label: 'Em aberto' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'parcial', label: 'Recebimento parcial' },
  { value: 'recebido', label: 'Recebido' },
  { value: 'cancelado', label: 'Cancelado' },
]

const AVISO_CONFERENCIA_NF =
  'Na entrada da nota fiscal, o sistema conferirá preço, prazo de pagamento e modalidade de transporte contra este pedido.'

const MODALIDADES = [
  { value: '', label: '—' },
  { value: 'CIF', label: 'CIF' },
  { value: 'FOB_NOTA', label: 'FOB, frete na nota' },
  { value: 'FOB_CONHECIMENTO', label: 'FOB, frete no conhecimento' },
  { value: 'RETIRA', label: 'Retira' },
]

const TIPOS_COMPRA = [
  { value: 'revenda', label: 'Revenda' },
  { value: 'bonificacao', label: 'Bonificação' },
  { value: 'uso_consumo', label: 'Uso e consumo' },
]

const AVISO_BAIXA_CREDITO_NF =
  'O valor será reservado do saldo ao salvar o pedido. A baixa definitiva ocorre na entrada da nota fiscal.'

const itemVazio = (): ItemPedido => ({
  produtoId: '',
  codigoOriginal: '',
  quantidade: '1',
  unidade: 'UN',
  precoUnitario: '0',
  percentualDesconto: '0',
  valorDesconto: '0',
  outrasDespesas: '0',
  previsaoEntrega: '',
  origemPreco: '',
})

const TIPOS_PENDENCIA = [
  { value: 'produto_quebrado', label: 'Produto quebrado' },
  { value: 'defeito_fabrica', label: 'Defeito de fábrica' },
  { value: 'credito_pendente', label: 'Crédito pendente' },
]

const formVazio = {
  fornecedorPessoaId: '',
  transportadoraPessoaId: '',
  modalidadeTransporte: '',
  condicaoPagamento: '',
  tipoCompra: 'revenda',
  dataFaturamento: '',
  previsaoEntrega: '',
  valorFrete: '',
  valorFreteSugerido: '0',
  rateioParcelas: 'igual',
  prazos: [{ numero: 1, dias: '', vencimento: '', valor: '' }] as PrazoPagamento[],
  observacoes: '',
  observacoesInternas: '',
  descricao: '',
  pedidoVendaId: '',
  creditoFornecedorId: '',
  creditoAplicado: '',
  status: 'rascunho',
  motivoCancelamento: '',
  itens: [itemVazio()],
}

const pendenciaVazia = {
  tipo: 'produto_quebrado',
  descricao: '',
  produtoId: '',
}

const creditoVazio = {
  valor: '',
  origem: '',
  vencimento: '',
}

function parseNum(s: string): number {
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function mapearPrazosDoPedido(
  prazos: PrazoPagamento[],
  dataFaturamento: string
): PrazoPagamento[] {
  return prazos.map((pr) => ({
    numero: pr.numero,
    vencimento: pr.vencimento,
    valor: pr.valor != null ? String(pr.valor) : '',
    dias: pr.dias ?? calcularDiasEntreDatas(dataFaturamento, pr.vencimento),
  }))
}

function calcularTotalItem(item: ItemPedido): { bruto: number; liquido: number } {
  const q = parseNum(item.quantidade)
  const p = parseNum(item.precoUnitario)
  const bruto = Math.round(q * p * 100) / 100
  let desconto = parseNum(item.valorDesconto)
  const pct = parseNum(item.percentualDesconto)
  if (pct > 0) {
    desconto = Math.max(desconto, Math.round(bruto * (pct / 100) * 100) / 100)
  }
  const outras = parseNum(item.outrasDespesas)
  const liquido = Math.round((bruto - desconto + outras) * 100) / 100
  return { bruto, liquido }
}

function formatarDataIso(iso: string | Date | null | undefined): string {
  if (!iso) return ''
  const d = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function formatarMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

const FILTROS_VAZIOS = {
  status: 'todos' as FiltroStatus,
  fornecedorId: '',
  buscaNumero: '',
  dataInicio: '',
  dataFim: '',
}

function pedidoEditavel(status: string) {
  return !['cancelado', 'recebido'].includes(status)
}

function ConteudoDaPagina() {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('compras:create')
  const podeEditar = usePermissao('compras:edit')
  const podeCancelar = usePermissao('compras:delete')

  const [lista, setLista] = useState<PedidoCompra[]>([])
  const [fornecedores, setFornecedores] = useState<PessoaOpcao[]>([])
  const [transportadoras, setTransportadoras] = useState<PessoaOpcao[]>([])
  const [produtos, setProdutos] = useState<ProdutoOpcao[]>([])
  const [contexto, setContexto] = useState<ContextoFornecedor | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [modalPendenciaAberto, setModalPendenciaAberto] = useState(false)
  const [modalCreditoAberto, setModalCreditoAberto] = useState(false)
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false)
  const [modalEntradasAberto, setModalEntradasAberto] = useState(false)
  const [modalPedidosAbertosAberto, setModalPedidosAbertosAberto] = useState(false)
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false)
  const [modalCompararPdfAberto, setModalCompararPdfAberto] = useState(false)
  const [produtoHistoricoModal, setProdutoHistoricoModal] = useState('')
  const [pedidosVenda, setPedidosVenda] = useState<PedidoVendaOpcao[]>([])
  const [buscaPedidoVenda, setBuscaPedidoVenda] = useState('')
  const [copiando, setCopiando] = useState(false)
  const [idPedidoCancelando, setIdPedidoCancelando] = useState('')
  const [textoMotivoCancelamento, setTextoMotivoCancelamento] = useState('')
  const [erroMotivoCancelamento, setErroMotivoCancelamento] = useState('')
  const [cancelandoPedido, setCancelandoPedido] = useState(false)
  const [formPendencia, setFormPendencia] = useState(pendenciaVazia)
  const [formCredito, setFormCredito] = useState(creditoVazio)
  const [salvandoPendencia, setSalvandoPendencia] = useState(false)
  const [salvandoCredito, setSalvandoCredito] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [modoVisualizacao, setModoVisualizacao] = useState(false)
  const [idEmEdicao, setIdEmEdicao] = useState('')
  const [form, setForm] = useState(formVazio)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS)
  const [historicoProdutos, setHistoricoProdutos] = useState<Record<string, HistoricoCompra[]>>({})

  const filtrosAtivos =
    filtros.status !== 'todos' ||
    filtros.fornecedorId !== '' ||
    filtros.buscaNumero.trim() !== '' ||
    filtros.dataInicio !== '' ||
    filtros.dataFim !== ''

  const carregar = useCallback(async (filtrosAtuais = filtros) => {
    try {
      const params = new URLSearchParams()
      if (filtrosAtuais.fornecedorId) {
        params.set('fornecedorId', filtrosAtuais.fornecedorId)
      }
      if (filtrosAtuais.status === 'aberto') {
        params.set('statusAberto', 'true')
      } else if (filtrosAtuais.status !== 'todos') {
        params.set('status', filtrosAtuais.status)
      }
      const busca = filtrosAtuais.buscaNumero.trim()
      if (busca) {
        params.set('busca', busca)
      }
      if (filtrosAtuais.dataInicio) {
        params.set('dataInicio', filtrosAtuais.dataInicio)
      }
      if (filtrosAtuais.dataFim) {
        params.set('dataFim', filtrosAtuais.dataFim)
      }
      const qs = params.toString()
      const { data } = await clienteHttp.get(`/pedidos-compra${qs ? `?${qs}` : ''}`)
      setLista(data.pedidos ?? [])
    } catch {
      setErro('Erro ao carregar pedidos de compra.')
    }
  }, [filtros])

  const carregarCatalogos = useCallback(async () => {
    try {
      const [resForn, resTrans, resProd] = await Promise.all([
        clienteHttp.get('/fornecedores'),
        clienteHttp.get('/transportadoras'),
        clienteHttp.get('/produtos'),
      ])
      setFornecedores(
        (resForn.data.fornecedores ?? [])
          .filter((f: { ativo: boolean }) => f.ativo)
          .map((f: { id: string; nome: string }) => ({ id: f.id, nome: f.nome }))
      )
      setTransportadoras(
        (resTrans.data.transportadoras ?? [])
          .filter((t: { ativo: boolean }) => t.ativo)
          .map((t: { id: string; nome: string }) => ({ id: t.id, nome: t.nome }))
      )
      setProdutos(
        (resProd.data.produtos ?? [])
          .filter((p: { ativo: boolean }) => p.ativo)
          .map((p: {
            id: string
            nomeVenda: string
            sku: string | null
            unidade: string
            codigoOrigem: string | null
            precoCusto: number | null
            bloqueadoCompra: boolean
            fornecedores: {
              fornecedorPessoaId: string
              codigoFornecedor: string | null
              unidadeEntrada: string | null
            }[]
          }) => ({
            id: p.id,
            nomeVenda: p.nomeVenda,
            sku: p.sku,
            unidade: p.unidade,
            codigoOrigem: p.codigoOrigem ?? null,
            precoCusto: p.precoCusto ?? null,
            bloqueadoCompra: p.bloqueadoCompra ?? false,
            fornecedores: (p.fornecedores ?? []).map((f) => ({
              fornecedorPessoaId: f.fornecedorPessoaId,
              codigoFornecedor: f.codigoFornecedor ?? null,
              unidadeEntrada: f.unidadeEntrada ?? null,
            })),
          }))
      )
    } catch {
      setErro('Erro ao carregar catálogos.')
    }
  }, [])

  const carregarContexto = useCallback(async (fornecedorId: string) => {
    if (!fornecedorId) {
      setContexto(null)
      return
    }
    try {
      const { data } = await clienteHttp.get(`/pedidos-compra/fornecedor/${fornecedorId}/contexto`)
      setContexto(data)
    } catch {
      setContexto(null)
    }
  }, [])

  const carregarPedidosVenda = useCallback(async (busca?: string) => {
    try {
      const qs = busca?.trim() ? `?busca=${encodeURIComponent(busca.trim())}` : ''
      const { data } = await clienteHttp.get(`/pedidos-compra/pedidos-venda/encomenda${qs}`)
      setPedidosVenda(data.pedidos ?? [])
    } catch {
      setPedidosVenda([])
    }
  }, [])

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado) return
    carregarCatalogos()
  }, [carregandoSessao, estaAutenticado, carregarCatalogos])

  useEffect(() => {
    if (modalAberto) {
      void carregarPedidosVenda()
    }
  }, [modalAberto, carregarPedidosVenda])

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado) return
    const timer = setTimeout(() => {
      carregar(filtros)
    }, filtros.buscaNumero.trim() ? 300 : 0)
    return () => clearTimeout(timer)
  }, [carregandoSessao, estaAutenticado, filtros, carregar])

  function limparFiltros() {
    setFiltros(FILTROS_VAZIOS)
  }

  const carregarHistoricoProduto = useCallback(async (produtoId: string) => {
    if (!produtoId) return
    try {
      const { data } = await clienteHttp.get(`/pedidos-compra/produto/${produtoId}/historico`)
      setHistoricoProdutos((prev) => ({ ...prev, [produtoId]: data.historico ?? [] }))
    } catch {
      setHistoricoProdutos((prev) => ({ ...prev, [produtoId]: [] }))
    }
  }, [])

  useEffect(() => {
    if (form.fornecedorPessoaId) {
      carregarContexto(form.fornecedorPessoaId)
    } else {
      setContexto(null)
    }
  }, [form.fornecedorPessoaId, carregarContexto])

  function abrirNovo() {
    setForm(formVazio)
    setModoEdicao(false)
    setModoVisualizacao(false)
    setIdEmEdicao('')
    setContexto(null)
    setErro('')
    setModalAberto(true)
  }

  async function carregarPedidoNoForm(pedidoId: string) {
    const { data } = await clienteHttp.get(`/pedidos-compra/${pedidoId}`)
    const p = data.pedido
    setForm({
      fornecedorPessoaId: p.fornecedorPessoaId,
      transportadoraPessoaId: p.transportadoraPessoaId ?? '',
      modalidadeTransporte: p.modalidadeTransporte ?? '',
      condicaoPagamento: p.condicaoPagamento ?? '',
      tipoCompra: p.tipoCompra ?? 'revenda',
      dataFaturamento: formatarDataIso(p.dataFaturamento),
      previsaoEntrega: formatarDataIso(p.previsaoEntrega),
      valorFrete: p.valorFrete != null ? String(p.valorFrete) : '',
      valorFreteSugerido: p.valorFreteSugerido != null ? String(p.valorFreteSugerido) : '0',
      rateioParcelas: p.rateioParcelas ?? 'igual',
      prazos: Array.isArray(p.prazosPagamento) && p.prazosPagamento.length > 0
        ? mapearPrazosDoPedido(p.prazosPagamento as PrazoPagamento[], formatarDataIso(p.dataFaturamento))
        : [{ numero: 1, dias: '', vencimento: '', valor: '' }],
      observacoes: p.observacoes ?? '',
      observacoesInternas: p.observacoesInternas ?? '',
      descricao: p.descricao ?? '',
      pedidoVendaId: p.pedidoVendaId ?? '',
      creditoFornecedorId: p.creditoFornecedorId ?? '',
      creditoAplicado: p.creditoAplicado != null ? String(p.creditoAplicado) : '',
      status: p.status,
      motivoCancelamento: p.motivoCancelamento ?? '',
      itens: p.itens.map((i: ItemPedido & { produtoNome: string; produtoSku: string | null }) => ({
        id: i.id,
        produtoId: i.produtoId,
        produtoNome: i.produtoNome,
        produtoSku: i.produtoSku,
        codigoOriginal: i.codigoOriginal ?? '',
        quantidade: String(i.quantidade),
        unidade: i.unidade,
        precoUnitario: String(i.precoUnitario),
        percentualDesconto: i.percentualDesconto != null ? String(i.percentualDesconto) : '0',
        valorDesconto: i.valorDesconto != null ? String(i.valorDesconto) : '0',
        outrasDespesas: i.outrasDespesas != null ? String(i.outrasDespesas) : '0',
        previsaoEntrega: formatarDataIso(i.previsaoEntrega),
        total: i.total,
        totalLiquido: i.totalLiquido,
      })),
    })
    setIdEmEdicao(p.id)
    setModoEdicao(true)
    for (const item of p.itens) {
      if (item.produtoId) {
        void carregarHistoricoProduto(item.produtoId)
      }
    }
    return p
  }

  async function abrirVisualizacao(pedido: PedidoCompra) {
    try {
      await carregarPedidoNoForm(pedido.id)
      setModoVisualizacao(true)
      setErro('')
      setModalAberto(true)
    } catch {
      setErro('Erro ao carregar pedido.')
    }
  }

  async function abrirEdicao(pedido: PedidoCompra) {
    if (!pedidoEditavel(pedido.status) || !podeEditar) return
    try {
      await carregarPedidoNoForm(pedido.id)
      setModoVisualizacao(false)
      setErro('')
      setModalAberto(true)
    } catch {
      setErro('Erro ao carregar pedido.')
    }
  }

  async function duplicarPedido(pedidoId: string) {
    setCopiando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.post(`/pedidos-compra/${pedidoId}/copiar`)
      setMensagem(`${formatarPedido(data.pedido.numero, data.pedido.descricao)} criado como cópia.`)
      await carregar(filtros)
      await carregarPedidoNoForm(data.pedido.id)
      setModoVisualizacao(false)
      setModalAberto(true)
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao duplicar pedido'))
    } finally {
      setCopiando(false)
    }
  }

  function fecharModal() {
    setModalAberto(false)
    setModoVisualizacao(false)
  }

  function abrirHistoricoProduto(produtoId: string) {
    setProdutoHistoricoModal(produtoId)
    void carregarHistoricoProduto(produtoId)
    setModalHistoricoAberto(true)
  }

  function adicionarPrazo() {
    setForm((f) => ({
      ...f,
      prazos: [...f.prazos, { numero: f.prazos.length + 1, dias: '', vencimento: '', valor: '' }],
    }))
  }

  async function selecionarProdutoNoItem(index: number, produtoId: string) {
    if (!produtoId) {
      setForm((f) => {
        const itens = [...f.itens]
        itens[index] = itemVazio()
        return { ...f, itens }
      })
      return
    }

    const produto = produtos.find((p) => p.id === produtoId)
    if (!produto) return

    let historico: HistoricoCompra[] = historicoProdutos[produtoId] ?? []
    if (historicoProdutos[produtoId] === undefined) {
      try {
        const { data } = await clienteHttp.get(`/pedidos-compra/produto/${produtoId}/historico`)
        historico = data.historico ?? []
        setHistoricoProdutos((prev) => ({ ...prev, [produtoId]: historico }))
      } catch {
        historico = []
        setHistoricoProdutos((prev) => ({ ...prev, [produtoId]: [] }))
      }
    }

    setForm((f) => {
      const itens = [...f.itens]
      itens[index] = preencherItemComProduto(
        itens[index],
        produto,
        f.fornecedorPessoaId,
        f.previsaoEntrega,
        historico
      )
      return { ...f, itens }
    })
  }

  function atualizarItem(index: number, campo: keyof ItemPedido, valor: string) {
    setForm((f) => {
      const itens = [...f.itens]
      const item = { ...itens[index], [campo]: valor }

      if (campo === 'precoUnitario') {
        item.origemPreco = ''
      }

      itens[index] = item
      return { ...f, itens }
    })
  }

  function adicionarItem() {
    setForm((f) => ({ ...f, itens: [...f.itens, itemVazio()] }))
  }

  function removerItem(index: number) {
    setForm((f) => ({
      ...f,
      itens: f.itens.length > 1 ? f.itens.filter((_, i) => i !== index) : f.itens,
    }))
  }

  const totalForm = form.itens.reduce((s, i) => s + calcularTotalItem(i).liquido, 0)
  const freteForm = parseNum(form.valorFrete)
  const totalComFrete = totalForm + freteForm
  function aoSelecionarCredito(creditoId: string) {
    setForm((f) => {
      const credito = contexto?.creditos.find((c) => c.id === creditoId)
      return {
        ...f,
        creditoFornecedorId: creditoId,
        creditoAplicado: credito ? String(credito.saldo) : '',
      }
    })
  }

  function limparCredito() {
    setForm((f) => ({ ...f, creditoFornecedorId: '', creditoAplicado: '' }))
  }

  const creditoSelecionado = contexto?.creditos.find((c) => c.id === form.creditoFornecedorId)
  const saldoMaxCredito = creditoSelecionado?.saldo ?? 0

  const creditoNum = form.creditoAplicado
    ? Number(form.creditoAplicado.replace(',', '.'))
    : 0
  const creditoValido =
    !form.creditoFornecedorId ||
    (Number.isFinite(creditoNum) && creditoNum > 0 && creditoNum <= saldoMaxCredito)
  const totalLiquidoForm = totalComFrete - (Number.isFinite(creditoNum) && creditoValido ? creditoNum : 0)

  function montarPayload(concluir: boolean) {
    const creditoAplicadoNum = form.creditoAplicado
      ? Number(form.creditoAplicado.replace(',', '.'))
      : null

    const prazosValidos = montarPrazosParaPayload(
      form.prazos,
      form.rateioParcelas,
      totalLiquidoForm
    )

    return {
      fornecedorPessoaId: form.fornecedorPessoaId,
      transportadoraPessoaId: form.transportadoraPessoaId || null,
      modalidadeTransporte: form.modalidadeTransporte || undefined,
      condicaoPagamento: form.condicaoPagamento || undefined,
      tipoCompra: form.tipoCompra,
      dataFaturamento: form.dataFaturamento || null,
      previsaoEntrega: form.previsaoEntrega || null,
      valorFrete: form.valorFrete ? parseNum(form.valorFrete) : null,
      valorFreteSugerido: form.valorFreteSugerido ? parseNum(form.valorFreteSugerido) : null,
      prazosPagamento: prazosValidos && prazosValidos.length > 0 ? prazosValidos : null,
      rateioParcelas: form.rateioParcelas,
      observacoes: form.observacoes || undefined,
      observacoesInternas: form.observacoesInternas || undefined,
      descricao: form.descricao.trim() || undefined,
      concluir,
      pedidoVendaId: form.pedidoVendaId || null,
      creditoFornecedorId: form.creditoFornecedorId || null,
      creditoAplicado:
        form.creditoFornecedorId && creditoAplicadoNum != null && Number.isFinite(creditoAplicadoNum)
          ? creditoAplicadoNum
          : null,
      itens: form.itens.map((item, ordem) => ({
        produtoId: item.produtoId,
        codigoOriginal: item.codigoOriginal || null,
        quantidade: parseNum(item.quantidade),
        unidade: item.unidade,
        precoUnitario: parseNum(item.precoUnitario),
        percentualDesconto: parseNum(item.percentualDesconto) || null,
        valorDesconto: parseNum(item.valorDesconto) || null,
        outrasDespesas: parseNum(item.outrasDespesas) || null,
        previsaoEntrega: item.previsaoEntrega || null,
        ordem,
      })),
    }
  }

  async function aoSalvar(e?: FormEvent, concluir = false) {
    e?.preventDefault()
    if (!form.fornecedorPessoaId) {
      setErro('Selecione o fornecedor.')
      return
    }
    if (form.itens.some((i) => !i.produtoId)) {
      setErro('Todos os itens precisam de um produto.')
      return
    }
    if (form.creditoFornecedorId && !creditoValido) {
      setErro('Valor do crédito inválido ou excede o saldo disponível.')
      return
    }

    if (form.rateioParcelas === 'manual') {
      const erroParcelas = validarSomaParcelasManual(form.prazos, totalLiquidoForm)
      if (erroParcelas) {
        setErro(erroParcelas)
        return
      }
    }

    setSalvando(true)
    setErro('')
    try {
      const payload = montarPayload(concluir)
      if (modoEdicao) {
        await clienteHttp.put(`/pedidos-compra/${idEmEdicao}`, payload)
        const pedido = lista.find((p) => p.id === idEmEdicao)
        setMensagem(
          `${formatarPedido(pedido?.numero ?? 0, form.descricao || pedido?.descricao)} atualizado.`
        )
      } else {
        const { data } = await clienteHttp.post('/pedidos-compra', payload)
        setMensagem(`${formatarPedido(data.pedido.numero, data.pedido.descricao)} criado.`)
      }
      fecharModal()
      await carregar(filtros)
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao salvar pedido'))
    } finally {
      setSalvando(false)
    }
  }

  async function registrarPendencia(e: FormEvent) {
    e.preventDefault()
    if (!form.fornecedorPessoaId || formPendencia.descricao.trim().length < 3) {
      setErro('Informe a descrição da pendência (mín. 3 caracteres).')
      return
    }
    setSalvandoPendencia(true)
    setErro('')
    try {
      await clienteHttp.post('/pedidos-compra/pendencias-fornecedor', {
        fornecedorPessoaId: form.fornecedorPessoaId,
        tipo: formPendencia.tipo,
        descricao: formPendencia.descricao.trim(),
        produtoId: formPendencia.produtoId || null,
      })
      setModalPendenciaAberto(false)
      setFormPendencia(pendenciaVazia)
      setMensagem('Pendência registrada.')
      await carregarContexto(form.fornecedorPessoaId)
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao registrar pendência'))
    } finally {
      setSalvandoPendencia(false)
    }
  }

  async function registrarCredito(e: FormEvent) {
    e.preventDefault()
    if (!form.fornecedorPessoaId) return
    const valor = Number(formCredito.valor.replace(',', '.'))
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro('Informe um valor de crédito válido.')
      return
    }
    setSalvandoCredito(true)
    setErro('')
    try {
      await clienteHttp.post('/pedidos-compra/creditos-fornecedor', {
        fornecedorPessoaId: form.fornecedorPessoaId,
        valor,
        origem: formCredito.origem || undefined,
        vencimento: formCredito.vencimento
          ? new Date(formCredito.vencimento).toISOString()
          : undefined,
      })
      setModalCreditoAberto(false)
      setFormCredito(creditoVazio)
      setMensagem('Crédito cadastrado.')
      await carregarContexto(form.fornecedorPessoaId)
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao cadastrar crédito'))
    } finally {
      setSalvandoCredito(false)
    }
  }

  async function resolverPendencia(id: string) {
    try {
      await clienteHttp.patch(`/pedidos-compra/pendencias-fornecedor/${id}`, { resolvido: true })
      setMensagem('Pendência resolvida.')
      if (form.fornecedorPessoaId) {
        await carregarContexto(form.fornecedorPessoaId)
      }
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao resolver pendência'))
    }
  }

  function abrirCancelamentoPedido(pedidoId?: string) {
    const id = pedidoId ?? idEmEdicao
    if (!id) return
    setIdPedidoCancelando(id)
    setTextoMotivoCancelamento('')
    setErroMotivoCancelamento('')
    setModalCancelarAberto(true)
  }

  async function confirmarCancelamentoPedido() {
    const motivo = textoMotivoCancelamento.trim()
    if (motivo.length < 3) {
      setErroMotivoCancelamento('Informe o motivo do cancelamento (mínimo 3 caracteres).')
      return
    }

    setCancelandoPedido(true)
    setErroMotivoCancelamento('')
    try {
      await clienteHttp.patch(`/pedidos-compra/${idPedidoCancelando}/cancelar`, { motivo })
      const pedido = lista.find((p) => p.id === idPedidoCancelando)
      setMensagem(`${formatarPedido(pedido?.numero ?? 0, pedido?.descricao)} cancelado.`)
      setModalCancelarAberto(false)
      fecharModal()
      await carregar(filtros)
    } catch (err: unknown) {
      setErroMotivoCancelamento(extrairMensagemApi(err, 'Erro ao cancelar pedido'))
    } finally {
      setCancelandoPedido(false)
    }
  }

  const podeSalvar = modoEdicao ? podeEditar : podeCriar
  const pedidoBloqueado = modoEdicao && ['cancelado', 'recebido'].includes(form.status)
  const somenteLeitura = modoVisualizacao || pedidoBloqueado
  const camposDesabilitados = somenteLeitura || (modoEdicao ? !podeEditar : !podeCriar)
  const podeCancelarPedido =
    modoEdicao && podeCancelar && pedidoEditavel(form.status)
  const statusExibido = modoEdicao ? form.status : 'rascunho'

  const blocoTotaisRodape = (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <span>
        Itens: <strong>{formatarMoeda(totalForm)}</strong>
      </span>
      {freteForm > 0 && (
        <span>
          Frete: <strong>{formatarMoeda(freteForm)}</strong>
        </span>
      )}
      {creditoNum > 0 && creditoValido && (
        <span>
          Crédito: <strong>-{formatarMoeda(creditoNum)}</strong>
        </span>
      )}
      {form.creditoFornecedorId && !creditoValido && (
        <span className="text-destructive">Crédito excede saldo</span>
      )}
      <span>
        Líquido: <strong>{formatarMoeda(totalLiquidoForm)}</strong>
      </span>
    </div>
  )

  const rodapeModal = modoVisualizacao ? (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div className="shrink-0">
        {podeCancelarPedido && (
          <Button type="button" variant="destructive" onClick={() => abrirCancelamentoPedido()}>
            Cancelar pedido
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-4">
        {blocoTotaisRodape}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={fecharModal}>
            Fechar
          </Button>
          {podeEditar && !pedidoBloqueado && (
            <BotaoPrimario type="button" onClick={() => setModoVisualizacao(false)}>
              Editar
            </BotaoPrimario>
          )}
        </div>
      </div>
    </div>
  ) : (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div className="shrink-0">
        {podeCancelarPedido && (
          <Button type="button" variant="destructive" onClick={() => abrirCancelamentoPedido()}>
            Cancelar pedido
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-4">
        {blocoTotaisRodape}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={fecharModal}>
            Fechar
          </Button>
          {!somenteLeitura && podeSalvar && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void aoSalvar(undefined, false)}
                disabled={salvando}
              >
                {salvando ? 'Salvando...' : podeConcluirPedido(form.status) ? 'Salvar rascunho' : 'Salvar'}
              </Button>
              {podeConcluirPedido(form.status) && (
                <BotaoPrimario
                  type="button"
                  onClick={() => void aoSalvar(undefined, true)}
                  disabled={salvando}
                >
                  {salvando ? 'Salvando...' : 'Concluir pedido'}
                </BotaoPrimario>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Compras &gt; Pedidos de Compra</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Pedidos de Compra</h1>
      </div>

      {mensagem && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{mensagem}</p>
      )}
      {erro && !modalAberto && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
      )}

      <CardPadrao
        titulo="Pedidos"
        acoes={
          podeCriar && (
            <BotaoPrimario type="button" onClick={abrirNovo}>
              <Plus className="mr-1 size-4 inline" />
              Novo pedido
            </BotaoPrimario>
          )
        }
      >
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <input
            className="flex h-9 w-full max-w-[10rem] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Nº ou descrição"
            value={filtros.buscaNumero}
            onChange={(e) => setFiltros((f) => ({ ...f, buscaNumero: e.target.value }))}
          />
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filtros.status}
            onChange={(e) =>
              setFiltros((f) => ({ ...f, status: e.target.value as FiltroStatus }))
            }
          >
            {FILTRO_STATUS_OPCOES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className="flex h-9 min-w-[12rem] max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filtros.fornecedorId}
            onChange={(e) => setFiltros((f) => ({ ...f, fornecedorId: e.target.value }))}
          >
            <option value="">Todos os fornecedores</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filtros.dataInicio}
            onChange={(e) => setFiltros((f) => ({ ...f, dataInicio: e.target.value }))}
            title="Data inicial"
          />
          <input
            type="date"
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filtros.dataFim}
            onChange={(e) => setFiltros((f) => ({ ...f, dataFim: e.target.value }))}
            title="Data final"
          />
          {filtrosAtivos && (
            <Button type="button" variant="outline" size="sm" onClick={limparFiltros}>
              Limpar
            </Button>
          )}
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          {lista.length} pedido{lista.length !== 1 ? 's' : ''}
        </p>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Nº</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Fornecedor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Condição pag.</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    {filtrosAtivos ? (
                      <span>
                        Nenhum pedido encontrado com os filtros aplicados.{' '}
                        <button
                          type="button"
                          className="text-primary underline"
                          onClick={limparFiltros}
                        >
                          Limpar filtros
                        </button>
                      </span>
                    ) : (
                      'Nenhum pedido encontrado.'
                    )}
                  </td>
                </tr>
              )}
              {lista.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer border-b border-border hover:bg-muted/30"
                  onClick={() => abrirVisualizacao(p)}
                >
                  <td className="px-4 py-2 font-medium">{formatarPedido(p.numero, p.descricao)}</td>
                  <td className="px-4 py-2">{formatarData(p.createdAt)}</td>
                  <td className="px-4 py-2">{p.fornecedorNome}</td>
                  <td className="px-4 py-2">
                    <BadgeStatus
                      variante={varianteStatusUi(p.status)}
                      title={
                        p.status === 'cancelado' && p.motivoCancelamento
                          ? p.motivoCancelamento
                          : undefined
                      }
                    >
                      {rotuloStatusUi(p.status)}
                    </BadgeStatus>
                  </td>
                  <td className="px-4 py-2">{formatarMoeda(p.totalLiquido)}</td>
                  <td className="px-4 py-2">{p.condicaoPagamento ?? '—'}</td>
                  <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      {podeCriar && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          title="Duplicar"
                          disabled={copiando}
                          onClick={() => duplicarPedido(p.id)}
                        >
                          <Copy className="size-4" />
                        </Button>
                      )}
                      {podeEditar && pedidoEditavel(p.status) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          title="Editar"
                          onClick={() => abrirEdicao(p)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}
                      {podeCancelar && pedidoEditavel(p.status) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirCancelamentoPedido(p.id)}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardPadrao>

      <Modal
        aberto={modalAberto}
        aoFechar={fecharModal}
        titulo={
          modoEdicao
            ? tituloModalPedido(
                lista.find((p) => p.id === idEmEdicao)?.numero,
                form.descricao || lista.find((p) => p.id === idEmEdicao)?.descricao
              )
            : tituloModalPedido(undefined, undefined, true)
        }
        descricao={
          modoVisualizacao ? 'Consulta dos dados do pedido (somente leitura)' : undefined
        }
        cabecalhoExtra={
          <BadgeStatus variante={varianteStatusUi(statusExibido)} className="mt-2">
            {rotuloStatusUi(statusExibido)}
          </BadgeStatus>
        }
        largura="5xl"
        rodape={rodapeModal}
      >
        <form
          id="form-pedido-compra"
          onSubmit={(e) => {
            e.preventDefault()
            void aoSalvar(e, false)
          }}
        >
          {contexto && contexto.pendencias.length > 0 && (
            <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="text-sm font-medium text-amber-700">Pendências abertas do fornecedor</p>
              <p className="mt-1 text-xs text-amber-700/80">
                Informativo — o pedido pode ser salvo mesmo com pendências abertas.
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {contexto.pendencias.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-2">
                    <span>
                      {TIPOS_PENDENCIA.find((t) => t.value === p.tipo)?.label ?? p.tipo}: {p.descricao}
                    </span>
                    {podeEditar && !somenteLeitura && (
                      <button
                        type="button"
                        className="shrink-0 text-primary hover:underline"
                        onClick={() => resolverPendencia(p.id)}
                      >
                        Resolver
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <SelectPadrao
                    rotulo="Fornecedor *"
                    valor={form.fornecedorPessoaId}
                    aoMudar={(v) => setForm((f) => ({ ...f, fornecedorPessoaId: v }))}
                    opcoes={[
                      { value: '', label: 'Selecione' },
                      ...fornecedores.map((f) => ({ value: f.id, label: f.nome })),
                    ]}
                    disabled={camposDesabilitados}
                  />
                </div>
                <div className="sm:col-span-2">
                  <InputPadrao
                    rotulo="Descrição"
                    value={form.descricao}
                    onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                    disabled={camposDesabilitados}
                    placeholder="Ex.: Compra reposição estoque"
                    maxLength={120}
                  />
                </div>
                <SelectPadrao
                  rotulo="Transportadora"
                  valor={form.transportadoraPessoaId}
                  aoMudar={(v) => setForm((f) => ({ ...f, transportadoraPessoaId: v }))}
                  opcoes={[
                    { value: '', label: 'Nenhuma' },
                    ...transportadoras.map((t) => ({ value: t.id, label: t.nome })),
                  ]}
                  disabled={camposDesabilitados}
                />
                <SelectPadrao
                  rotulo="Tipo de frete"
                  valor={form.modalidadeTransporte}
                  aoMudar={(v) => setForm((f) => ({ ...f, modalidadeTransporte: v }))}
                  opcoes={MODALIDADES}
                  disabled={camposDesabilitados}
                />
                <SelectPadrao
                  rotulo="Tipo de compra"
                  valor={form.tipoCompra}
                  aoMudar={(v) => setForm((f) => ({ ...f, tipoCompra: v }))}
                  opcoes={TIPOS_COMPRA}
                  disabled={camposDesabilitados}
                />
                <InputPadrao
                  rotulo="Data de faturamento"
                  type="date"
                  value={form.dataFaturamento}
                  onChange={(e) => {
                    const dataFaturamento = e.target.value
                    setForm((f) => ({
                      ...f,
                      dataFaturamento,
                      prazos: f.prazos.map((p) => ({
                        ...p,
                        vencimento: p.dias
                          ? calcularVencimentoPorDias(dataFaturamento, p.dias)
                          : p.vencimento,
                      })),
                    }))
                  }}
                  disabled={camposDesabilitados}
                />
                <InputPadrao
                  rotulo="Previsão de entrega"
                  type="date"
                  value={form.previsaoEntrega}
                  onChange={(e) => setForm((f) => ({ ...f, previsaoEntrega: e.target.value }))}
                  disabled={camposDesabilitados}
                />
                <div className="sm:col-span-2 grid max-w-md grid-cols-2 gap-3">
                  <InputPadrao
                    rotulo="Valor frete"
                    value={form.valorFrete}
                    onChange={(e) => setForm((f) => ({ ...f, valorFrete: e.target.value }))}
                    disabled={camposDesabilitados}
                  />
                  <InputPadrao
                    rotulo="Valor frete sugerido"
                    value={form.valorFreteSugerido}
                    onChange={(e) => setForm((f) => ({ ...f, valorFreteSugerido: e.target.value }))}
                    disabled={camposDesabilitados}
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <InputPadrao
                    rotulo="Buscar pedido venda (encomenda)"
                    value={buscaPedidoVenda}
                    onChange={(e) => {
                      setBuscaPedidoVenda(e.target.value)
                      void carregarPedidosVenda(e.target.value)
                    }}
                    disabled={camposDesabilitados}
                    placeholder="Nº ou nome do cliente"
                  />
                  <SelectPadrao
                    rotulo="Pedido venda (encomenda)"
                    valor={form.pedidoVendaId}
                    aoMudar={(v) => setForm((f) => ({ ...f, pedidoVendaId: v }))}
                    opcoes={[
                      { value: '', label: 'Nenhum' },
                      ...pedidosVenda.map((pv) => ({
                        value: pv.id,
                        label: `#${pv.numero} — ${pv.clienteNome}`,
                      })),
                    ]}
                    disabled={camposDesabilitados}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <InputPadrao
                  rotulo="Observação"
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  disabled={camposDesabilitados}
                />
                <InputPadrao
                  rotulo="Observação interna (não será impressa)"
                  value={form.observacoesInternas}
                  onChange={(e) => setForm((f) => ({ ...f, observacoesInternas: e.target.value }))}
                  disabled={camposDesabilitados}
                />
              </div>

              {modoEdicao && idEmEdicao && (
                <div className="flex flex-wrap gap-2">
                  {podeCriar && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={copiando}
                      onClick={() => duplicarPedido(idEmEdicao)}
                    >
                      <Copy className="mr-1 size-4" />
                      Duplicar pedido
                    </Button>
                  )}
                  {podeEditar && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setModalCompararPdfAberto(true)}
                    >
                      <FileSearch className="mr-1 size-4" />
                      Comparar com PDF
                    </Button>
                  )}
                </div>
              )}

              {modoEdicao && form.status === 'cancelado' && (
                <div className="space-y-2">
                  <Label htmlFor="motivo-cancelamento">Motivo do cancelamento</Label>
                  <textarea
                    id="motivo-cancelamento"
                    readOnly
                    value={form.motivoCancelamento || 'Não informado'}
                    rows={3}
                    className={cn(
                      'w-full min-w-0 rounded-md border border-input bg-muted/30 px-2.5 py-2 text-sm',
                      'disabled:cursor-not-allowed disabled:opacity-70'
                    )}
                  />
                </div>
              )}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Itens</p>
                  {!somenteLeitura && podeSalvar && (
                    <Button type="button" variant="outline" size="sm" onClick={adicionarItem}>
                      <Plus className="mr-1 size-4" />
                      Item
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {form.itens.map((item, index) => {
                    const produtoItem = produtos.find((p) => p.id === item.produtoId)
                    const origemPrecoLabel = rotuloOrigemPreco(item.origemPreco)
                    return (
                    <div
                      key={index}
                      className="space-y-3 rounded-lg border border-border p-3"
                    >
                      {produtoItem?.bloqueadoCompra && (
                        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-700">
                          Produto bloqueado para compra no cadastro.
                        </p>
                      )}
                      <ComboboxProduto
                        produtos={produtos}
                        valor={item.produtoId}
                        aoMudar={(v) => void selecionarProdutoNoItem(index, v)}
                        disabled={camposDesabilitados}
                      />
                      <InputPadrao
                        rotulo="Código original"
                        value={item.codigoOriginal}
                        onChange={(e) => atualizarItem(index, 'codigoOriginal', e.target.value)}
                        disabled={camposDesabilitados}
                      />
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        <InputPadrao
                          rotulo="Quantidade"
                          value={item.quantidade}
                          onChange={(e) => atualizarItem(index, 'quantidade', e.target.value)}
                          disabled={camposDesabilitados}
                        />
                        <InputPadrao
                          rotulo="Unidade"
                          value={item.unidade}
                          onChange={(e) => atualizarItem(index, 'unidade', e.target.value)}
                          disabled={camposDesabilitados}
                        />
                        <InputPadrao
                          rotulo="Preço unitário"
                          value={item.precoUnitario}
                          onChange={(e) => atualizarItem(index, 'precoUnitario', e.target.value)}
                          disabled={camposDesabilitados}
                        />
                        {origemPrecoLabel && (
                          <p className="col-span-2 text-xs text-muted-foreground sm:col-span-3 lg:col-span-5">
                            {origemPrecoLabel}
                          </p>
                        )}
                        <div>
                          <p className="text-xs text-muted-foreground">Total bruto</p>
                          <p className="text-sm font-medium tabular-nums">
                            {formatarMoeda(calcularTotalItem(item).bruto)}
                          </p>
                        </div>
                        <InputPadrao
                          rotulo="Prev. entrega"
                          type="date"
                          value={item.previsaoEntrega}
                          onChange={(e) => atualizarItem(index, 'previsaoEntrega', e.target.value)}
                          disabled={camposDesabilitados}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <InputPadrao
                          rotulo="% desconto"
                          value={item.percentualDesconto}
                          onChange={(e) => atualizarItem(index, 'percentualDesconto', e.target.value)}
                          disabled={camposDesabilitados}
                        />
                        <InputPadrao
                          rotulo="R$ desconto"
                          value={item.valorDesconto}
                          onChange={(e) => atualizarItem(index, 'valorDesconto', e.target.value)}
                          disabled={camposDesabilitados}
                        />
                        <InputPadrao
                          rotulo="Outras desp."
                          value={item.outrasDespesas}
                          onChange={(e) => atualizarItem(index, 'outrasDespesas', e.target.value)}
                          disabled={camposDesabilitados}
                        />
                        <div className="flex items-end justify-between gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Total líquido</p>
                            <p className="text-sm font-medium">
                              {formatarMoeda(calcularTotalItem(item).liquido)}
                            </p>
                          </div>
                          {form.itens.length > 1 && !somenteLeitura && podeSalvar && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removerItem(index)}
                              title="Remover item"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {item.produtoId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => abrirHistoricoProduto(item.produtoId)}
                        >
                          <History className="mr-1 size-4" />
                          Ver histórico de custo
                        </Button>
                      )}
                    </div>
                    )
                  })}
                </div>
              </div>

              <BlocoPagamentoPrazos
                condicaoPagamento={form.condicaoPagamento}
                rateioParcelas={form.rateioParcelas}
                prazos={form.prazos}
                dataFaturamento={form.dataFaturamento}
                totalLiquido={totalLiquidoForm}
                creditoFornecedorId={form.creditoFornecedorId}
                creditoAplicado={form.creditoAplicado}
                creditos={contexto?.creditos ?? []}
                saldoMaxCredito={saldoMaxCredito}
                creditoValido={creditoValido}
                avisoBaixaCredito={AVISO_BAIXA_CREDITO_NF}
                disabled={camposDesabilitados}
                formatarMoeda={formatarMoeda}
                onCondicaoChange={(v) => setForm((f) => ({ ...f, condicaoPagamento: v }))}
                onRateioChange={(v) => setForm((f) => ({ ...f, rateioParcelas: v }))}
                onPrazosChange={(prazos) => setForm((f) => ({ ...f, prazos }))}
                onSelecionarCredito={aoSelecionarCredito}
                onCreditoAplicadoChange={(v) => setForm((f) => ({ ...f, creditoAplicado: v }))}
                onLimparCredito={limparCredito}
                onAdicionarPrazo={adicionarPrazo}
              />
            </div>

            <aside className="min-w-0 space-y-4 rounded-lg border border-border bg-muted/20 p-4 xl:sticky xl:top-0 xl:self-start">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Painel do fornecedor</p>
                {form.fornecedorPessoaId && podeCriar && !somenteLeitura && (
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormCredito(creditoVazio)
                        setModalCreditoAberto(true)
                      }}
                    >
                      Crédito
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormPendencia(pendenciaVazia)
                        setModalPendenciaAberto(true)
                      }}
                    >
                      Pendência
                    </Button>
                  </div>
                )}
              </div>

              {!form.fornecedorPessoaId && (
                <p className="text-xs text-muted-foreground">Selecione um fornecedor.</p>
              )}

              {contexto && form.fornecedorPessoaId && (
                <>
                  {contexto.pendencias.length > 0 && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
                      <p className="text-xs font-medium text-amber-700">
                        {contexto.pendencias.length} pendência(s) aberta(s)
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Botões rápidos</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setModalEntradasAberto(true)}
                    >
                      <Truck className="mr-2 size-4" />
                      Últimas entradas ({contexto.ultimasEntradas.length})
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setModalPedidosAbertosAberto(true)}
                    >
                      <Package className="mr-2 size-4" />
                      Pedidos em aberto (
                      {contexto.pedidosAbertos.filter((p) => p.id !== idEmEdicao).length})
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      disabled={!form.itens.some((i) => i.produtoId)}
                      onClick={() => {
                        const primeiro = form.itens.find((i) => i.produtoId)
                        if (primeiro) abrirHistoricoProduto(primeiro.produtoId)
                      }}
                    >
                      <History className="mr-2 size-4" />
                      Histórico de custo
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">{AVISO_CONFERENCIA_NF}</p>
                </>
              )}
            </aside>
          </div>

          {erro && modalAberto && (
            <p className="mt-4 text-sm text-destructive">{erro}</p>
          )}
        </form>
      </Modal>

      <Modal
        aberto={modalCancelarAberto}
        aoFechar={() => setModalCancelarAberto(false)}
        titulo="Cancelar pedido"
        largura="md"
        rodape={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalCancelarAberto(false)}
              disabled={cancelandoPedido}
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmarCancelamentoPedido}
              disabled={cancelandoPedido}
            >
              {cancelandoPedido ? 'Cancelando...' : 'Confirmar cancelamento'}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="motivo-cancelar-pedido">Motivo do cancelamento *</Label>
          <textarea
            id="motivo-cancelar-pedido"
            value={textoMotivoCancelamento}
            onChange={(e) => setTextoMotivoCancelamento(e.target.value)}
            rows={4}
            placeholder="Descreva o motivo do cancelamento"
            className={cn(
              'w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-2 text-sm shadow-xs outline-none',
              'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
              erroMotivoCancelamento && 'border-destructive'
            )}
          />
          {erroMotivoCancelamento && (
            <p className="text-sm text-destructive">{erroMotivoCancelamento}</p>
          )}
          <p className="text-xs text-muted-foreground">
            O pedido será marcado como cancelado e não poderá mais ser editado.
          </p>
        </div>
      </Modal>

      <Modal
        aberto={modalPendenciaAberto}
        aoFechar={() => setModalPendenciaAberto(false)}
        titulo="Registrar pendência"
        largura="md"
      >
        <form onSubmit={registrarPendencia} className="space-y-4">
          <SelectPadrao
            rotulo="Tipo"
            valor={formPendencia.tipo}
            aoMudar={(v) => setFormPendencia((f) => ({ ...f, tipo: v }))}
            opcoes={TIPOS_PENDENCIA}
          />
          <InputPadrao
            rotulo="Descrição *"
            value={formPendencia.descricao}
            onChange={(e) => setFormPendencia((f) => ({ ...f, descricao: e.target.value }))}
          />
          <SelectPadrao
            rotulo="Produto (opcional)"
            valor={formPendencia.produtoId}
            aoMudar={(v) => setFormPendencia((f) => ({ ...f, produtoId: v }))}
            opcoes={[
              { value: '', label: 'Nenhum' },
              ...produtos.map((p) => ({
                value: p.id,
                label: `${p.sku ? p.sku + ' — ' : ''}${p.nomeVenda}`,
              })),
            ]}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalPendenciaAberto(false)}>
              Cancelar
            </Button>
            <BotaoPrimario type="submit" disabled={salvandoPendencia}>
              {salvandoPendencia ? 'Salvando...' : 'Registrar'}
            </BotaoPrimario>
          </div>
        </form>
      </Modal>

      <Modal
        aberto={modalCreditoAberto}
        aoFechar={() => setModalCreditoAberto(false)}
        titulo="Cadastrar crédito"
        largura="md"
      >
        <form onSubmit={registrarCredito} className="space-y-4">
          <InputPadrao
            rotulo="Valor (R$) *"
            value={formCredito.valor}
            onChange={(e) => setFormCredito((f) => ({ ...f, valor: e.target.value }))}
          />
          <InputPadrao
            rotulo="Origem"
            value={formCredito.origem}
            onChange={(e) => setFormCredito((f) => ({ ...f, origem: e.target.value }))}
            placeholder="Ex.: devolução NF 123"
          />
          <InputPadrao
            rotulo="Vencimento"
            type="date"
            value={formCredito.vencimento}
            onChange={(e) => setFormCredito((f) => ({ ...f, vencimento: e.target.value }))}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalCreditoAberto(false)}>
              Cancelar
            </Button>
            <BotaoPrimario type="submit" disabled={salvandoCredito}>
              {salvandoCredito ? 'Salvando...' : 'Cadastrar'}
            </BotaoPrimario>
          </div>
        </form>
      </Modal>

      <Modal
        aberto={modalEntradasAberto}
        aoFechar={() => setModalEntradasAberto(false)}
        titulo="Últimas entradas do fornecedor"
        largura="lg"
      >
        {!contexto || contexto.ultimasEntradas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma entrada registrada para este fornecedor.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {contexto.ultimasEntradas.map((e) => (
              <li key={e.id} className="rounded-md border border-border p-3">
                <p className="font-medium">
                  {formatarPedido(e.numero, e.descricao ?? null)} — {rotuloStatusUi(e.status)}
                </p>
                <p className="text-muted-foreground">
                  {formatarData(e.data)} — {e.itens} item(ns) — {formatarMoeda(e.totalLiquido)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        aberto={modalPedidosAbertosAberto}
        aoFechar={() => setModalPedidosAbertosAberto(false)}
        titulo="Pedidos de compra em aberto"
        largura="lg"
      >
        {!contexto ||
        contexto.pedidosAbertos.filter((p) => p.id !== idEmEdicao).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido em aberto para este fornecedor.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {contexto.pedidosAbertos
              .filter((p) => p.id !== idEmEdicao)
              .map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full rounded-md border border-border p-3 text-left hover:bg-muted/30"
                    onClick={() => {
                      setModalPedidosAbertosAberto(false)
                      void abrirEdicao(p)
                    }}
                  >
                    <p className="font-medium">
                      {formatarPedido(p.numero, p.descricao ?? null)}
                    </p>
                    <p className="text-muted-foreground">{formatarMoeda(p.totalLiquido)}</p>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </Modal>

      <Modal
        aberto={modalHistoricoAberto}
        aoFechar={() => setModalHistoricoAberto(false)}
        titulo="Histórico de compras e preço de custo"
        largura="lg"
      >
        {!produtoHistoricoModal ? (
          <p className="text-sm text-muted-foreground">Selecione um produto.</p>
        ) : historicoProdutos[produtoHistoricoModal] === undefined ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : historicoProdutos[produtoHistoricoModal].length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem compras registradas para este produto.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Pedido</th>
                  <th className="py-2 pr-3">Fornecedor</th>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Qtd</th>
                  <th className="py-2 pr-3">Preço unit.</th>
                  <th className="py-2">Custo</th>
                </tr>
              </thead>
              <tbody>
                {historicoProdutos[produtoHistoricoModal].map((h, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="py-2 pr-3">#{h.pedidoNumero}</td>
                    <td className="py-2 pr-3">{h.fornecedorNome}</td>
                    <td className="py-2 pr-3">{formatarData(h.data)}</td>
                    <td className="py-2 pr-3">{h.quantidade}</td>
                    <td className="py-2 pr-3">{formatarMoeda(h.precoUnitario)}</td>
                    <td className="py-2">{formatarMoeda(h.precoCusto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <ModalCompararPdf
        aberto={modalCompararPdfAberto}
        pedidoId={idEmEdicao}
        numeroPedido={lista.find((p) => p.id === idEmEdicao)?.numero ?? ''}
        aoFechar={() => setModalCompararPdfAberto(false)}
      />
    </div>
  )
}

export default function PaginaPedidosCompra() {
  return (
    <ProtegerRota chaveDaPagina="pedidos-compra">
      <ConteudoDaPagina />
    </ProtegerRota>
  )
}
