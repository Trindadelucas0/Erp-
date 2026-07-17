'use client'

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CircleDollarSign,
  AlertCircle,
  History,
  Package,
  Plus,
  Truck,
  MessageCircle,
} from 'lucide-react'
import { BlocoPagamentoPrazos, type PrazoPagamento } from '@/components/pedidos-compra/bloco-pagamento-prazos'
import { ComboboxPessoa } from '@/components/pedidos-compra/combobox-pessoa'
import { LancamentoItensPedido } from '@/components/pedidos-compra/lancamento-itens-pedido'
import { ConfirmacaoComSenha } from '@/components/compartilhado/confirmacao-com-senha'
import { ModalConfirmacao } from '@/components/compartilhado/modal-confirmacao'
import { ModalConferenciaIa } from '@/components/pedidos-compra/modal-conferencia-ia'
import {
  AbaAvaliacaoPedido,
  type AnexoFornecedor,
} from '@/components/pedidos-compra/aba-avaliacao-pedido'
import {
  mensagemToastAvisoWhatsapp,
  processarAvisoWhatsappPortal,
  type AvisoWhatsappPortal,
} from '@/lib/whatsapp-portal'
import { clienteHttp } from '@/services/api'
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
import { Abas } from '@/components/ui/abas'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { validarArquivoAnexoFornecedor } from '@/lib/anexo-fornecedor'
import {
  montarPrazosParaPayload,
  prazosValoresIguais,
  sincronizarValoresParcelasComTotal,
  validarSomaParcelasManual,
} from '@/lib/parcelas-pagamento-pedido'
import { calcularVencimentoPorDias, formatarDataBr } from '@/lib/prazos-pagamento'
import {
  preencherItemComProduto,
  recalcularCodigoUnidadeItem,
} from '@/lib/preencher-item-pedido-compra'
import {
  formatarPedido,
  podeConcluirPedido,
  rotuloStatusUi,
  tituloModalPedido,
  varianteStatusUi,
} from '@/lib/status-pedido-compra'
import {
  AVISO_BAIXA_CREDITO_NF,
  AVISO_CONFERENCIA_NF,
  MODALIDADES,
  TIPOS_COMPRA,
  TIPOS_PENDENCIA,
  calcularTotalItem,
  creditoVazio,
  exigeDadosTransporte,
  formVazio,
  formatarData,
  formatarDataIso,
  formatarMoeda,
  itemVazio,
  mapearPrazosDoPedido,
  normalizarModalidadeTransporte,
  condicaoDePrazosForm,
  aplicarPrazosFornecedorNoForm,
  aplicarModalidadeTransportePadraoNoForm,
  parseNum,
  pedidoEditavel,
  pedidoExibeAbaAvaliacao,
  pendenciaVazia,
  substituirItemProdutoNosItens,
  validarCamposObrigatoriosLancamento,
  type ContextoFornecedor,
  type HistoricoCompra,
  type ItemPedido,
  type ModoPedidoCompra,
  type PessoaOpcao,
  type ProdutoOpcao,
} from '@/lib/pedido-compra-shared'
import { CabecalhoColunaOrdenavel } from '@/components/ui/cabecalho-coluna-ordenavel'
import { useOrdenacaoColunas } from '@/hooks/use-ordenacao-colunas'
import { ordenarLista } from '@/lib/ordenacao-lista'

type Props = {
  modo: ModoPedidoCompra
  pedidoId?: string
}

export function FormularioPedidoCompra({ modo, pedidoId }: Props) {
  const roteador = useRouter()
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('compras:create')
  const podeEditar = usePermissao('compras:edit')
  const podeCancelar = usePermissao('compras:delete')

  const [fornecedores, setFornecedores] = useState<PessoaOpcao[]>([])
  const [transportadoras, setTransportadoras] = useState<PessoaOpcao[]>([])
  const [produtos, setProdutos] = useState<ProdutoOpcao[]>([])
  const [contexto, setContexto] = useState<ContextoFornecedor | null>(null)
  const [modalPendenciaAberto, setModalPendenciaAberto] = useState(false)
  const [modalCreditoAberto, setModalCreditoAberto] = useState(false)
  const [modalListaPendenciasAberto, setModalListaPendenciasAberto] = useState(false)
  const [modalListaCreditosAberto, setModalListaCreditosAberto] = useState(false)
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false)
  const [modalEntradasAberto, setModalEntradasAberto] = useState(false)
  const [modalPedidosAbertosAberto, setModalPedidosAbertosAberto] = useState(false)
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false)
  const [produtoHistoricoModal, setProdutoHistoricoModal] = useState('')
  const [textoMotivoCancelamento, setTextoMotivoCancelamento] = useState('')
  const [erroMotivoCancelamento, setErroMotivoCancelamento] = useState('')
  const [cancelandoPedido, setCancelandoPedido] = useState(false)
  const [formPendencia, setFormPendencia] = useState(pendenciaVazia)
  const [formCredito, setFormCredito] = useState(creditoVazio)
  const [salvandoPendencia, setSalvandoPendencia] = useState(false)
  const [salvandoCredito, setSalvandoCredito] = useState(false)
  const [erroModalPendencia, setErroModalPendencia] = useState('')
  const [erroModalCredito, setErroModalCredito] = useState('')
  const [mensagemPainelFornecedor, setMensagemPainelFornecedor] = useState('')
  const [numeroPedido, setNumeroPedido] = useState<number | undefined>()
  const [portalLiberadoEm, setPortalLiberadoEm] = useState<string | null>(null)
  const [portalBloqueadoEm, setPortalBloqueadoEm] = useState<string | null>(null)
  const [anexosFornecedor, setAnexosFornecedor] = useState<AnexoFornecedor[]>([])
  const [liberandoPortal, setLiberandoPortal] = useState(false)
  const [voltandoParaRascunho, setVoltandoParaRascunho] = useState(false)
  const [confirmandoVoltarRascunho, setConfirmandoVoltarRascunho] = useState(false)
  const [mostrandoSenhaAprovacao, setMostrandoSenhaAprovacao] = useState(false)
  const [aprovandoPedido, setAprovandoPedido] = useState(false)
  const [erroAprovacao, setErroAprovacao] = useState('')
  const [mensagemPortal, setMensagemPortal] = useState('')
  const [abrindoWhatsapp, setAbrindoWhatsapp] = useState(false)
  const [mensagemDocumentos, setMensagemDocumentos] = useState('')
  const [enviandoAnexo, setEnviandoAnexo] = useState(false)
  const [anexoEmConferencia, setAnexoEmConferencia] = useState<AnexoFornecedor | null>(null)
  const [form, setForm] = useState(formVazio)
  const [salvando, setSalvando] = useState(false)
  const [carregandoPedido, setCarregandoPedido] = useState(modo !== 'novo')
  const [erro, setErro] = useState('')
  const [confirmacaoParcelasAberta, setConfirmacaoParcelasAberta] = useState(false)
  const [concluirPendente, setConcluirPendente] = useState(false)
  const [mensagemConfirmacaoParcelas, setMensagemConfirmacaoParcelas] = useState('')
  const [historicoProdutos, setHistoricoProdutos] = useState<Record<string, HistoricoCompra[]>>({})
  const { ordenacao: ordenacaoHistorico, alternarOrdenacao: alternarOrdenacaoHistorico } =
    useOrdenacaoColunas<'pedido' | 'fornecedor' | 'data' | 'quantidade' | 'preco' | 'custo'>()
  const [abaAtiva, setAbaAtiva] = useState<'dados-gerais' | 'itens' | 'pagamento' | 'avaliacao'>(
    'dados-gerais'
  )
  const requisicaoContextoRef = useRef(0)
  const abaInicialDefinidaRef = useRef(false)
  const deveAplicarPrazosFornecedorRef = useRef(false)
  const formRef = useRef(form)
  const produtosRef = useRef(produtos)
  formRef.current = form
  produtosRef.current = produtos

  const modoEdicao = modo !== 'novo'
  const pedidoBloqueado = modoEdicao && ['cancelado', 'recebido', 'aprovado'].includes(form.status)
  const modoVisualizacao =
    modo === 'visualizar' || (modo === 'editar' && (!pedidoEditavel(form.status) || !podeEditar))
  const somenteLeitura = modoVisualizacao || pedidoBloqueado
  const camposDesabilitados = somenteLeitura || (modoEdicao ? !podeEditar : !podeCriar)
  const podeSalvar = modoEdicao ? podeEditar : podeCriar
  const podeGerenciarCreditoPendencia = podeCriar || podeEditar
  const podeCancelarPedido = modoEdicao && podeCancelar && pedidoEditavel(form.status)
  const statusExibido = modoEdicao ? form.status : 'rascunho'
  const idAtual = pedidoId ?? ''
  const exibeAbaAvaliacao = modoEdicao && pedidoExibeAbaAvaliacao(form.status)

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
            urlFotoMiniatura?: string | null
            marca?: string | null
            unidade: string
            codigoBarras?: string | null
            embalagensMaster?: { codigoBarras?: string | null; quantidade?: number | null }[]
            codigoOrigem: string | null
            precoCusto: number | null
            bloqueadoCompra: boolean
            fornecedores: {
              fornecedorPessoaId: string
              codigoFornecedor: string | null
              unidadeEntrada: string | null
              multiploEntrada?: number | null
              multiplicadorEntrada?: number | null
            }[]
          }) => ({
            id: p.id,
            nomeVenda: p.nomeVenda,
            sku: p.sku,
            urlFotoMiniatura: p.urlFotoMiniatura ?? null,
            marca: p.marca ?? '',
            unidade: p.unidade,
            codigoBarras: p.codigoBarras ?? null,
            codigosBarrasEmbalagem: (p.embalagensMaster ?? []).map((e) => e.codigoBarras ?? null),
            embalagensMaster: (p.embalagensMaster ?? []).map((e) => ({
              quantidade:
                e.quantidade == null || !Number.isFinite(Number(e.quantidade))
                  ? null
                  : Number(e.quantidade),
            })),
            codigoOrigem: p.codigoOrigem ?? null,
            precoCusto: p.precoCusto ?? null,
            bloqueadoCompra: p.bloqueadoCompra ?? false,
            fornecedores: (p.fornecedores ?? []).map((f) => ({
              fornecedorPessoaId: f.fornecedorPessoaId,
              codigoFornecedor: f.codigoFornecedor ?? null,
              unidadeEntrada: f.unidadeEntrada ?? null,
              multiploEntrada: f.multiploEntrada ?? null,
              multiplicadorEntrada: f.multiplicadorEntrada ?? null,
            })),
          }))
      )
    } catch {
      setErro('Erro ao carregar catálogos.')
    }
  }, [])

  const carregarContexto = useCallback(async (fornecedorId: string, aplicarPrazos = false) => {
    if (!fornecedorId) {
      setContexto(null)
      return
    }
    const requisicaoId = ++requisicaoContextoRef.current
    try {
      const { data } = await clienteHttp.get(`/pedidos-compra/fornecedor/${fornecedorId}/contexto`)
      if (requisicaoId !== requisicaoContextoRef.current) return
      setContexto(data)
      if (aplicarPrazos) {
        const prazosFornecedor = (data.prazosPagamentoFornecedor ?? []) as number[]
        setForm((f) => ({
          ...f,
          ...aplicarPrazosFornecedorNoForm(prazosFornecedor, f.dataFaturamento),
          ...aplicarModalidadeTransportePadraoNoForm(data.modalidadeTransportePadrao),
        }))
      }
    } catch {
      if (requisicaoId !== requisicaoContextoRef.current) return
      setContexto(null)
    }
  }, [])

  const carregarHistoricoProduto = useCallback(async (produtoId: string) => {
    if (!produtoId) return
    try {
      const { data } = await clienteHttp.get(`/pedidos-compra/produto/${produtoId}/historico`)
      setHistoricoProdutos((prev) => ({ ...prev, [produtoId]: data.historico ?? [] }))
    } catch {
      setHistoricoProdutos((prev) => ({ ...prev, [produtoId]: [] }))
    }
  }, [])

  const carregarPedidoNoForm = useCallback(
    async (id: string) => {
      const { data } = await clienteHttp.get(`/pedidos-compra/${id}`)
      const p = data.pedido
      const modalidadeTransporte = normalizarModalidadeTransporte(p.modalidadeTransporte)
      // Não zerar frete/transportadora no estado: a UI já oculta quando CIF.
      deveAplicarPrazosFornecedorRef.current = false
      setNumeroPedido(p.numero)
      setPortalLiberadoEm(p.portalLiberadoEm ?? null)
      setPortalBloqueadoEm(p.portalBloqueadoEm ?? null)
      setAnexosFornecedor(p.anexosFornecedor ?? [])
      setForm({
        fornecedorPessoaId: p.fornecedorPessoaId,
        transportadoraPessoaId: p.transportadoraPessoaId ?? '',
        modalidadeTransporte,
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
        creditoFornecedorId: p.creditoFornecedorId ?? '',
        creditoAplicado: p.creditoAplicado != null ? String(p.creditoAplicado) : '',
        status: p.status,
        motivoCancelamento: p.motivoCancelamento ?? '',
        itens: p.itens.map(
          (
            i: ItemPedido & {
              produtoNome: string
              produtoSku: string | null
              produtoMarca?: string | null
            }
          ) => ({
          id: i.id,
          produtoId: i.produtoId,
          produtoNome: i.produtoNome,
          produtoSku: i.produtoSku,
          produtoMarca: i.produtoMarca ?? null,
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
      for (const item of p.itens) {
        if (item.produtoId) {
          void carregarHistoricoProduto(item.produtoId)
        }
      }
      // Ao abrir um pedido já enviado ao fornecedor, foca direto na avaliação —
      // é o que o comprador precisa resolver, sem depender do fornecedor conferir antes.
      if (!abaInicialDefinidaRef.current) {
        abaInicialDefinidaRef.current = true
        if (p.status === 'enviado') {
          setAbaAtiva('avaliacao')
        }
      }
      return p
    },
    [carregarHistoricoProduto]
  )

  async function liberarPortalFornecedor() {
    if (!pedidoId) return
    setLiberandoPortal(true)
    setMensagemPortal('')
    try {
      const { data } = await clienteHttp.post(`/pedidos-compra/${pedidoId}/liberar-portal`)
      setPortalLiberadoEm(new Date().toISOString())
      setPortalBloqueadoEm(null)
      const aviso = data as AvisoWhatsappPortal
      processarAvisoWhatsappPortal(aviso)
      setMensagemPortal(mensagemToastAvisoWhatsapp(aviso, 'Enviado ao fornecedor'))
    } catch (e: unknown) {
      setMensagemPortal(extrairMensagemApi(e, 'Erro ao enviar o pedido ao fornecedor.'))
    } finally {
      setLiberandoPortal(false)
    }
  }

  async function abrirWhatsappCredenciaisFornecedor() {
    if (!pedidoId) {
      setErro('Salve o pedido antes de avisar o fornecedor pelo WhatsApp.')
      return
    }
    setAbrindoWhatsapp(true)
    setErro('')
    setMensagemPortal('')
    try {
      const { data } = await clienteHttp.get(`/pedidos-compra/${pedidoId}/whatsapp-credenciais`)
      const aviso = data as AvisoWhatsappPortal
      processarAvisoWhatsappPortal(aviso)
      if (!aviso.avisoWhatsappDisponivel || !aviso.telefonesWhatsapp?.length) {
        setMensagemPortal(
          aviso.mensagemAviso ??
            'Marque a opção WhatsApp em pelo menos um telefone do fornecedor.'
        )
      }
    } catch (e: unknown) {
      setErro(extrairMensagemApi(e, 'Erro ao abrir o WhatsApp do fornecedor.'))
    } finally {
      setAbrindoWhatsapp(false)
    }
  }

  async function voltarPedidoParaRascunho() {
    if (!pedidoId) return
    setVoltandoParaRascunho(true)
    setMensagemPortal('')
    try {
      const { data } = await clienteHttp.post(`/pedidos-compra/${pedidoId}/voltar-para-rascunho`)
      const p = data.pedido as {
        status?: string
        portalLiberadoEm?: string | null
        portalBloqueadoEm?: string | null
        anexosFornecedor?: AnexoFornecedor[]
      } | undefined
      // Preserva o formulário atual — só sincroniza status/portal (e anexos se vierem).
      setForm((f) => ({ ...f, status: p?.status ?? 'rascunho' }))
      if (p?.portalLiberadoEm !== undefined) {
        setPortalLiberadoEm(p.portalLiberadoEm ?? null)
      }
      setPortalBloqueadoEm(p?.portalBloqueadoEm ?? new Date().toISOString())
      if (Array.isArray(p?.anexosFornecedor)) {
        setAnexosFornecedor(p.anexosFornecedor)
      }
      setAbaAtiva('dados-gerais')
      setMensagemPainelFornecedor(
        'Pedido voltou para rascunho. O portal do fornecedor foi bloqueado — envie novamente ao fornecedor após aprovar o pedido.'
      )
    } catch (e: unknown) {
      setMensagemPortal(extrairMensagemApi(e, 'Erro ao voltar o pedido para rascunho.'))
    } finally {
      setVoltandoParaRascunho(false)
    }
  }

  function lerArquivoComoBase64(arquivo: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const resultado = reader.result as string
        resolve(resultado.includes(',') ? resultado.split(',')[1] : resultado)
      }
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
      reader.readAsDataURL(arquivo)
    })
  }

  async function enviarAnexoFornecedorInterno(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo || !pedidoId) return

    const validacao = validarArquivoAnexoFornecedor(arquivo.name, arquivo.type)
    if ('erro' in validacao) {
      setMensagemDocumentos(validacao.erro)
      return
    }

    setEnviandoAnexo(true)
    setMensagemDocumentos('')
    try {
      const base64Arquivo = await lerArquivoComoBase64(arquivo)
      const { data } = await clienteHttp.post(`/pedidos-compra/${pedidoId}/anexos-fornecedor`, {
        nomeArquivo: arquivo.name,
        mimeType: validacao.mimeType,
        base64Arquivo,
      })
      setAnexosFornecedor((atual) => [
        {
          id: data.anexo.id,
          nomeArquivo: data.anexo.nomeArquivo,
          mimeType: validacao.mimeType,
          tamanhoBytes: arquivo.size,
          enviadoEm: data.anexo.enviadoEm,
          tipoAnexo: 'documento_fornecedor',
          anexoOrigemId: null,
          conferidoEm: null,
          statusConferencia: 'pendente',
          motivoAjuste: null,
          relatorioConferencia: null,
        },
        ...atual,
      ])
      setMensagemDocumentos(
        'Documento anexado. Você pode baixar, aprovar, solicitar ajuste ou conferir com IA (opcional).'
      )
    } catch (erro: unknown) {
      setMensagemDocumentos(extrairMensagemApi(erro, 'Erro ao enviar o documento.'))
    } finally {
      setEnviandoAnexo(false)
    }
  }

  async function baixarAnexoFornecedor(anexo: AnexoFornecedor) {
    if (!pedidoId) return
    const resposta = await clienteHttp.get(
      `/pedidos-compra/${pedidoId}/anexos-fornecedor/${anexo.id}/download`,
      { responseType: 'blob' }
    )
    const url = window.URL.createObjectURL(new Blob([resposta.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = anexo.nomeArquivo
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  function removerAnexoDaLista(anexoId: string) {
    setAnexosFornecedor((atual) => atual.filter((a) => a.id !== anexoId))
  }

  async function confirmarAprovacaoPedido() {
    if (!pedidoId) return
    setAprovandoPedido(true)
    setErroAprovacao('')
    try {
      await clienteHttp.post(`/pedidos-compra/${pedidoId}/aprovar`)
      setMostrandoSenhaAprovacao(false)
      setPortalBloqueadoEm(new Date().toISOString())
      setMensagemPortal(
        'Pedido aprovado. O fornecedor não tem mais acesso ao portal e o pedido segue no sistema.'
      )
      await carregarPedidoNoForm(pedidoId)
    } catch (e: unknown) {
      setErroAprovacao(extrairMensagemApi(e, 'Erro ao aprovar o pedido.'))
    } finally {
      setAprovandoPedido(false)
    }
  }

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado) return
    void carregarCatalogos()
  }, [carregandoSessao, estaAutenticado, carregarCatalogos])

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado) return
    if (modo === 'novo') {
      setCarregandoPedido(false)
      return
    }
    if (!pedidoId) {
      setErro('Pedido não informado.')
      setCarregandoPedido(false)
      return
    }
    setCarregandoPedido(true)
    setErro('')
    void carregarPedidoNoForm(pedidoId)
      .catch(() => setErro('Erro ao carregar pedido.'))
      .finally(() => setCarregandoPedido(false))
  }, [carregandoSessao, estaAutenticado, modo, pedidoId, carregarPedidoNoForm])

  useEffect(() => {
    if (!form.fornecedorPessoaId) {
      setContexto(null)
      return
    }
    const aplicarPrazos = deveAplicarPrazosFornecedorRef.current
    deveAplicarPrazosFornecedorRef.current = false
    void carregarContexto(form.fornecedorPessoaId, aplicarPrazos)
    // Recarrega produtos para refletir embalagem/múltiplo recém-cadastrados.
    void carregarCatalogos()
  }, [form.fornecedorPessoaId, carregarContexto, carregarCatalogos])

  function selecionarFornecedor(fornecedorId: string) {
    const mudou = fornecedorId !== form.fornecedorPessoaId
    if (!mudou) return

    if (!fornecedorId) {
      requisicaoContextoRef.current += 1
      setContexto(null)
      setForm((f) => ({
        ...f,
        fornecedorPessoaId: '',
        creditoFornecedorId: '',
        creditoAplicado: '',
        ...aplicarPrazosFornecedorNoForm([], f.dataFaturamento),
      }))
      return
    }

    deveAplicarPrazosFornecedorRef.current = true
    setForm((f) => ({
      ...f,
      fornecedorPessoaId: fornecedorId,
      creditoFornecedorId: '',
      creditoAplicado: '',
      itens: f.itens.map((item) => {
        if (!item.produtoId) return item
        const produto = produtos.find((p) => p.id === item.produtoId)
        if (!produto) return item
        return recalcularCodigoUnidadeItem(item, produto, fornecedorId)
      }),
    }))
  }

  function voltarParaLista(mensagem?: string) {
    const qs = mensagem ? `?mensagem=${encodeURIComponent(mensagem)}` : ''
    roteador.push(`/pedidos-compra${qs}`)
  }

  function avancarParaPagamento() {
    if (!form.fornecedorPessoaId) {
      setErro('Selecione o fornecedor.')
      setAbaAtiva('dados-gerais')
      return
    }
    if (!form.modalidadeTransporte) {
      setErro('Selecione o tipo de frete.')
      setAbaAtiva('dados-gerais')
      return
    }
    if (exigeDadosTransporte(form.modalidadeTransporte) && !form.transportadoraPessoaId) {
      setErro('Selecione a transportadora para frete FOB.')
      setAbaAtiva('dados-gerais')
      return
    }
    const erroLancamento = validarCamposObrigatoriosLancamento(form)
    if (erroLancamento) {
      setErro(erroLancamento)
      setAbaAtiva('dados-gerais')
      return
    }
    setErro('')
    setAbaAtiva('pagamento')
  }

  function avancarParaItens() {
    setErro('')
    setAbaAtiva('itens')
  }

  function abrirHistoricoProduto(produtoId: string) {
    setProdutoHistoricoModal(produtoId)
    void carregarHistoricoProduto(produtoId)
    setModalHistoricoAberto(true)
  }

  function atualizarPrazos(prazos: PrazoPagamento[]) {
    setForm((f) => ({
      ...f,
      prazos,
      condicaoPagamento: condicaoDePrazosForm(prazos),
    }))
  }

  function adicionarPrazo() {
    setForm((f) => {
      const prazos = [
        ...f.prazos,
        { numero: f.prazos.length + 1, dias: '', vencimento: '', valor: '' },
      ]
      return {
        ...f,
        prazos,
        condicaoPagamento: condicaoDePrazosForm(prazos),
      }
    })
  }

  async function preencherProdutoRascunho(produtoId: string, base: ItemPedido): Promise<ItemPedido> {
    if (!produtoId) return itemVazio()

    const produto = produtosRef.current.find((p) => p.id === produtoId)
    if (!produto) return base

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

    // Usa fornecedor/previsão atuais pós-await (evita código original vazio por closure antiga).
    const formAtual = formRef.current
    return preencherItemComProduto(
      base,
      produto,
      formAtual.fornecedorPessoaId,
      formAtual.previsaoEntrega,
      historico
    )
  }

  function adicionarItemLancado(item: ItemPedido) {
    setForm((f) => ({ ...f, itens: [...f.itens, item] }))
  }

  function atualizarItemLancado(indiceOriginal: number, item: ItemPedido) {
    setForm((f) => {
      const itens = [...f.itens]
      itens[indiceOriginal] = item
      return { ...f, itens }
    })
  }

  function removerItensLancados(indices: number[]) {
    const remover = new Set(indices)
    setForm((f) => ({
      ...f,
      itens: f.itens.filter((_, i) => !remover.has(i)),
    }))
  }

  function substituirProdutoLancado(item: ItemPedido, indiceEdicao: number | null) {
    setForm((f) => ({
      ...f,
      itens: substituirItemProdutoNosItens(f.itens, item, indiceEdicao),
    }))
  }

  const totalForm = form.itens.reduce((s, i) => s + calcularTotalItem(i).liquido, 0)
  const exibeDadosTransporte = exigeDadosTransporte(form.modalidadeTransporte)
  const freteForm = exibeDadosTransporte ? parseNum(form.valorFrete) : 0
  const totalComFrete = totalForm + freteForm

  function mudarModalidadeTransporte(modalidade: string) {
    setForm((f) => {
      if (!exigeDadosTransporte(modalidade)) {
        return {
          ...f,
          modalidadeTransporte: modalidade,
          transportadoraPessoaId: '',
          valorFrete: '',
          valorFreteSugerido: '0',
        }
      }
      return { ...f, modalidadeTransporte: modalidade }
    })
  }

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
  const creditoNum = form.creditoAplicado ? Number(form.creditoAplicado.replace(',', '.')) : 0
  const creditoValido =
    !form.creditoFornecedorId ||
    (Number.isFinite(creditoNum) && creditoNum > 0 && creditoNum <= saldoMaxCredito)
  const totalLiquidoForm = totalComFrete - (Number.isFinite(creditoNum) && creditoValido ? creditoNum : 0)

  useEffect(() => {
    setForm((f) => {
      const prazosAtualizados = sincronizarValoresParcelasComTotal(
        f.prazos,
        f.rateioParcelas,
        totalLiquidoForm
      )
      if (prazosValoresIguais(f.prazos, prazosAtualizados)) return f
      return { ...f, prazos: prazosAtualizados }
    })
  }, [totalLiquidoForm])

  function mudarRateioParcelas(rateio: string) {
    setForm((f) => {
      const prazosAtualizados = sincronizarValoresParcelasComTotal(
        f.prazos,
        rateio,
        totalLiquidoForm
      )
      return { ...f, rateioParcelas: rateio, prazos: prazosAtualizados }
    })
  }

  function montarPayload(concluir: boolean) {
    const creditoAplicadoNum = form.creditoAplicado
      ? Number(form.creditoAplicado.replace(',', '.'))
      : null
    const prazosValidos = montarPrazosParaPayload(form.prazos, form.rateioParcelas, totalLiquidoForm)
    const exigeTransporte = exigeDadosTransporte(form.modalidadeTransporte)
    return {
      fornecedorPessoaId: form.fornecedorPessoaId,
      transportadoraPessoaId: exigeTransporte ? form.transportadoraPessoaId || null : null,
      modalidadeTransporte: form.modalidadeTransporte,
      condicaoPagamento: form.condicaoPagamento || undefined,
      tipoCompra: form.tipoCompra,
      dataFaturamento: form.dataFaturamento || null,
      previsaoEntrega: form.previsaoEntrega || null,
      valorFrete: exigeTransporte && form.valorFrete ? parseNum(form.valorFrete) : null,
      valorFreteSugerido:
        exigeTransporte && form.valorFreteSugerido ? parseNum(form.valorFreteSugerido) : null,
      prazosPagamento: prazosValidos && prazosValidos.length > 0 ? prazosValidos : null,
      rateioParcelas: form.rateioParcelas,
      observacoes: form.observacoes || undefined,
      observacoesInternas: form.observacoesInternas || undefined,
      concluir,
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

  async function executarSalvar(concluir: boolean) {
    setSalvando(true)
    setErro('')
    try {
      const payload = montarPayload(concluir)
      if (modoEdicao && idAtual) {
        await clienteHttp.put(`/pedidos-compra/${idAtual}`, payload)
        if (concluir) {
          abaInicialDefinidaRef.current = true
          await carregarPedidoNoForm(idAtual)
          setAbaAtiva('avaliacao')
          setMensagemPortal('Pedido aprovado (enviado). Use Enviar ao fornecedor para liberar o portal.')
        } else {
          voltarParaLista(`${formatarPedido(numeroPedido ?? 0)} atualizado.`)
        }
      } else {
        const { data } = await clienteHttp.post('/pedidos-compra', payload)
        if (concluir && data.pedido?.id) {
          roteador.push(`/pedidos-compra/${data.pedido.id}?modo=editar`)
        } else {
          voltarParaLista(`${formatarPedido(data.pedido.numero)} criado.`)
        }
      }
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao salvar pedido'))
    } finally {
      setSalvando(false)
    }
  }

  function montarMensagemConfirmacaoParcelas(): string | null {
    const prazosPayload = montarPrazosParaPayload(form.prazos, form.rateioParcelas, totalLiquidoForm)
    if (!prazosPayload?.length) return null

    const linhas = prazosPayload.map(
      (p) => `${p.numero} — ${formatarDataBr(p.vencimento)} — ${formatarMoeda(p.valor)}`
    )
    const soma = prazosPayload.reduce((s, p) => s + p.valor, 0)
    return [
      'Confira os valores das parcelas:',
      '',
      ...linhas,
      '',
      `Soma: ${formatarMoeda(soma)}`,
      `Total líquido: ${formatarMoeda(totalLiquidoForm)}`,
      '',
      'Deseja prosseguir?',
    ].join('\n')
  }

  async function aoSalvar(e?: FormEvent, concluir = false) {
    e?.preventDefault()
    if (!form.fornecedorPessoaId) {
      setErro('Selecione o fornecedor.')
      setAbaAtiva('dados-gerais')
      return
    }
    if (!form.modalidadeTransporte) {
      setErro('Selecione o tipo de frete.')
      setAbaAtiva('dados-gerais')
      return
    }
    if (exigeDadosTransporte(form.modalidadeTransporte) && !form.transportadoraPessoaId) {
      setErro('Selecione a transportadora para frete FOB.')
      setAbaAtiva('dados-gerais')
      return
    }
    if (form.itens.length === 0 || form.itens.some((i) => !i.produtoId)) {
      setErro('Adicione ao menos um produto no pedido.')
      setAbaAtiva('itens')
      return
    }
    if (concluir) {
      const erroLancamento = validarCamposObrigatoriosLancamento(form)
      if (erroLancamento) {
        setErro(erroLancamento)
        setAbaAtiva('dados-gerais')
        return
      }
    }
    if (form.creditoFornecedorId && !creditoValido) {
      setErro('Valor do crédito inválido ou excede o saldo disponível.')
      setAbaAtiva('pagamento')
      return
    }
    if (form.rateioParcelas === 'manual') {
      const erroParcelas = validarSomaParcelasManual(form.prazos, totalLiquidoForm)
      if (erroParcelas) {
        setErro(erroParcelas)
        setAbaAtiva('pagamento')
        return
      }
    }

    const mensagem = montarMensagemConfirmacaoParcelas()
    if (mensagem) {
      setMensagemConfirmacaoParcelas(mensagem)
      setConcluirPendente(concluir)
      setConfirmacaoParcelasAberta(true)
      setErro('')
      return
    }

    await executarSalvar(concluir)
  }

  async function confirmarSalvarParcelas() {
    setConfirmacaoParcelasAberta(false)
    await executarSalvar(concluirPendente)
  }

  function cancelarConfirmacaoParcelas() {
    setConfirmacaoParcelasAberta(false)
  }

  async function registrarPendencia(e: FormEvent) {
    e.preventDefault()
    if (!form.fornecedorPessoaId || formPendencia.descricao.trim().length < 3) {
      setErroModalPendencia('Informe a descrição da pendência (mín. 3 caracteres).')
      return
    }
    setSalvandoPendencia(true)
    setErroModalPendencia('')
    try {
      await clienteHttp.post('/pedidos-compra/pendencias-fornecedor', {
        fornecedorPessoaId: form.fornecedorPessoaId,
        tipo: formPendencia.tipo,
        descricao: formPendencia.descricao.trim(),
        produtoId: formPendencia.produtoId || null,
      })
      setModalPendenciaAberto(false)
      setFormPendencia(pendenciaVazia)
      setMensagemPainelFornecedor('Pendência registrada.')
      await carregarContexto(form.fornecedorPessoaId)
    } catch (err: unknown) {
      setErroModalPendencia(extrairMensagemApi(err, 'Erro ao registrar pendência'))
    } finally {
      setSalvandoPendencia(false)
    }
  }

  async function registrarCredito(e: FormEvent) {
    e.preventDefault()
    if (!form.fornecedorPessoaId) return
    const valor = Number(formCredito.valor.replace(',', '.'))
    if (!Number.isFinite(valor) || valor <= 0) {
      setErroModalCredito('Informe um valor de crédito válido.')
      return
    }
    setSalvandoCredito(true)
    setErroModalCredito('')
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
      setMensagemPainelFornecedor('Crédito cadastrado.')
      await carregarContexto(form.fornecedorPessoaId)
    } catch (err: unknown) {
      setErroModalCredito(extrairMensagemApi(err, 'Erro ao cadastrar crédito'))
    } finally {
      setSalvandoCredito(false)
    }
  }

  async function resolverPendencia(id: string) {
    try {
      await clienteHttp.patch(`/pedidos-compra/pendencias-fornecedor/${id}`, { resolvido: true })
      if (form.fornecedorPessoaId) {
        await carregarContexto(form.fornecedorPessoaId)
      }
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao resolver pendência'))
    }
  }

  async function confirmarCancelamentoPedido() {
    const motivo = textoMotivoCancelamento.trim()
    if (motivo.length < 3) {
      setErroMotivoCancelamento('Informe o motivo do cancelamento (mínimo 3 caracteres).')
      return
    }
    if (!idAtual) return

    setCancelandoPedido(true)
    setErroMotivoCancelamento('')
    try {
      await clienteHttp.patch(`/pedidos-compra/${idAtual}/cancelar`, { motivo })
      setModalCancelarAberto(false)
      voltarParaLista(`${formatarPedido(numeroPedido ?? 0)} cancelado.`)
    } catch (err: unknown) {
      setErroMotivoCancelamento(extrairMensagemApi(err, 'Erro ao cancelar pedido'))
    } finally {
      setCancelandoPedido(false)
    }
  }

  const titulo = tituloModalPedido(numeroPedido, null, modo === 'novo')
  const itensPreenchidos = form.itens.filter((i) => i.produtoId).length
  const totalPendencias = contexto?.pendencias.length ?? 0
  const totalSaldoCreditos =
    contexto?.creditos.reduce((soma, credito) => soma + credito.saldo, 0) ?? 0

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

  const historicoExibido = useMemo(() => {
    if (!produtoHistoricoModal) return []
    const lista = historicoProdutos[produtoHistoricoModal] ?? []
    return ordenarLista(lista, ordenacaoHistorico, (h, coluna) => {
      switch (coluna) {
        case 'pedido':
          return h.pedidoNumero
        case 'fornecedor':
          return h.fornecedorNome
        case 'data':
          return new Date(h.data)
        case 'quantidade':
          return h.quantidade
        case 'preco':
          return h.precoUnitario
        case 'custo':
          return h.precoCusto
      }
    })
  }, [produtoHistoricoModal, historicoProdutos, ordenacaoHistorico])

  if (carregandoPedido) {
    return <p className="text-sm text-muted-foreground">Carregando pedido...</p>
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            onClick={() => voltarParaLista()}
          >
            <ArrowLeft className="mr-1 size-4" />
            Voltar para lista
          </Button>
          <p className="text-sm text-muted-foreground">Compras &gt; Pedidos de Compra</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
            <BadgeStatus variante={varianteStatusUi(statusExibido)}>
              {rotuloStatusUi(statusExibido)}
            </BadgeStatus>
          </div>
          {modoVisualizacao && (
            <p className="mt-1 text-sm text-muted-foreground">
              Consulta dos dados do pedido (somente leitura)
            </p>
          )}
        </div>
      </div>

      {erro && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
      )}

      <CardPadrao compacto>
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
                    {podeGerenciarCreditoPendencia && (
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

          <Abas
            className="mb-6"
            abaAtiva={abaAtiva}
            aoMudar={(id) =>
              setAbaAtiva(id as 'dados-gerais' | 'itens' | 'pagamento' | 'avaliacao')
            }
            abas={[
              { id: 'dados-gerais', rotulo: 'Dados gerais' },
              { id: 'pagamento', rotulo: 'Pagamento e prazos' },
              { id: 'itens', rotulo: 'Lançamento de produtos', contador: itensPreenchidos },
              ...(exibeAbaAvaliacao ? [{ id: 'avaliacao', rotulo: 'Avaliação do pedido' }] : []),
            ]}
          />

          {abaAtiva === 'dados-gerais' && (
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <ComboboxPessoa
                        rotulo="Fornecedor"
                        pessoas={fornecedores}
                        valor={form.fornecedorPessoaId}
                        aoMudar={selecionarFornecedor}
                        disabled={camposDesabilitados}
                        placeholder="Digite o nome do fornecedor..."
                        obrigatorio
                      />
                    </div>
                    {form.fornecedorPessoaId && pedidoId ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mb-0.5 shrink-0 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                        title="Abrir WhatsApp com mensagem do pedido"
                        disabled={abrindoWhatsapp}
                        onClick={() => void abrirWhatsappCredenciaisFornecedor()}
                      >
                        <MessageCircle className="size-5" />
                        <span className="sr-only">WhatsApp do fornecedor</span>
                      </Button>
                    ) : null}
                  </div>
                </div>
                <SelectPadrao
                  rotulo="Tipo de frete"
                  valor={form.modalidadeTransporte}
                  aoMudar={mudarModalidadeTransporte}
                  opcoes={MODALIDADES}
                  disabled={camposDesabilitados}
                  obrigatorio
                />
                {exibeDadosTransporte && (
                  <>
                    <ComboboxPessoa
                      rotulo="Transportadora"
                      pessoas={transportadoras}
                      valor={form.transportadoraPessoaId}
                      aoMudar={(v) => setForm((f) => ({ ...f, transportadoraPessoaId: v }))}
                      disabled={camposDesabilitados}
                      placeholder="Digite o nome da transportadora..."
                      obrigatorio
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
                        onChange={(e) =>
                          setForm((f) => ({ ...f, valorFreteSugerido: e.target.value }))
                        }
                        disabled={camposDesabilitados}
                      />
                    </div>
                  </>
                )}
                <SelectPadrao
                  rotulo="Tipo de compra"
                  valor={form.tipoCompra}
                  aoMudar={(v) => setForm((f) => ({ ...f, tipoCompra: v }))}
                  opcoes={TIPOS_COMPRA}
                  disabled={camposDesabilitados}
                  obrigatorio
                />
                <InputPadrao
                  rotulo="Data de faturamento"
                  type="date"
                  obrigatorio
                  value={form.dataFaturamento}
                  onChange={(e) => {
                    const dataFaturamento = e.target.value
                    setForm((f) => {
                      const prazos = f.prazos.map((p) => ({
                        ...p,
                        vencimento: calcularVencimentoPorDias(dataFaturamento, p.dias ?? ''),
                      }))
                      return {
                        ...f,
                        dataFaturamento,
                        prazos,
                        condicaoPagamento: condicaoDePrazosForm(prazos),
                      }
                    })
                  }}
                  disabled={camposDesabilitados}
                />
                <InputPadrao
                  rotulo="Previsão de entrega"
                  type="date"
                  obrigatorio
                  min={form.dataFaturamento || undefined}
                  value={form.previsaoEntrega}
                  onChange={(e) => setForm((f) => ({ ...f, previsaoEntrega: e.target.value }))}
                  disabled={camposDesabilitados}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
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
            </div>

            <aside className="min-w-0 space-y-3 rounded-lg border border-border bg-muted/20 p-3 xl:sticky xl:top-0 xl:self-start">
              <div className="space-y-2">
                <p className="text-sm font-medium">Painel do fornecedor</p>
                {!form.fornecedorPessoaId && (
                  <p className="text-xs text-muted-foreground">Selecione um fornecedor.</p>
                )}
                {form.fornecedorPessoaId && mensagemPainelFornecedor && (
                  <p className="rounded-md bg-primary/10 px-2 py-1.5 text-xs text-primary">
                    {mensagemPainelFornecedor}
                  </p>
                )}
              </div>

              {contexto && form.fornecedorPessoaId && (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Botões rápidos</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setModalListaPendenciasAberto(true)}
                    >
                      <AlertCircle className="mr-2 size-4" />
                      Pendências ({totalPendencias})
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setModalListaCreditosAberto(true)}
                    >
                      <CircleDollarSign className="mr-2 size-4" />
                      Crédito ({formatarMoeda(totalSaldoCreditos)})
                    </Button>
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
                      {contexto.pedidosAbertos.filter((p) => p.id !== idAtual).length})
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
          )}

          {abaAtiva === 'pagamento' && (
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
              onRateioChange={mudarRateioParcelas}
              onPrazosChange={atualizarPrazos}
              onSelecionarCredito={aoSelecionarCredito}
              onCreditoAplicadoChange={(v) => setForm((f) => ({ ...f, creditoAplicado: v }))}
              onLimparCredito={limparCredito}
              onAdicionarPrazo={adicionarPrazo}
            />
          )}

          {abaAtiva === 'itens' && (
            <LancamentoItensPedido
              fornecedorPessoaId={form.fornecedorPessoaId}
              itens={form.itens}
              produtos={produtos}
              disabled={somenteLeitura || !podeSalvar}
              formatarMoeda={formatarMoeda}
              formatarData={formatarData}
              onPreencherProduto={preencherProdutoRascunho}
              onAdicionar={adicionarItemLancado}
              onAtualizar={atualizarItemLancado}
              onRemoverVarios={removerItensLancados}
              onSubstituirProduto={substituirProdutoLancado}
              onAbrirHistorico={abrirHistoricoProduto}
            />
          )}

          {abaAtiva === 'avaliacao' && exibeAbaAvaliacao && idAtual && (
            <AbaAvaliacaoPedido
              pedidoId={idAtual}
              podeEditar={podeEditar}
              anexosFornecedor={anexosFornecedor}
              mensagemDocumentos={mensagemDocumentos}
              enviandoAnexo={enviandoAnexo}
              formatarData={formatarData}
              onEnviarAnexo={enviarAnexoFornecedorInterno}
              onBaixarAnexo={baixarAnexoFornecedor}
              onAbrirConferencia={setAnexoEmConferencia}
              onAnexoExcluido={removerAnexoDaLista}
              onAnexoDecidido={() => void carregarPedidoNoForm(idAtual)}
            />
          )}

          {abaAtiva === 'avaliacao' && mensagemPortal && (
            <p className="mt-2 text-sm text-muted-foreground">{mensagemPortal}</p>
          )}
          {abaAtiva === 'avaliacao' && erroAprovacao && (
            <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erroAprovacao}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="shrink-0">
              {podeCancelarPedido && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setTextoMotivoCancelamento('')
                    setErroMotivoCancelamento('')
                    setModalCancelarAberto(true)
                  }}
                >
                  Cancelar pedido
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              {blocoTotaisRodape}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => voltarParaLista()}>
                  {modoVisualizacao ? 'Fechar' : 'Cancelar'}
                </Button>
                {modoVisualizacao && podeEditar && !pedidoBloqueado && idAtual && (
                  <BotaoPrimario
                    type="button"
                    onClick={() => roteador.push(`/pedidos-compra/${idAtual}?modo=editar`)}
                  >
                    Editar
                  </BotaoPrimario>
                )}
                {!somenteLeitura && podeSalvar && (
                  <>
                    {abaAtiva === 'pagamento' && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setAbaAtiva('dados-gerais')}
                      >
                        Voltar
                      </Button>
                    )}
                    {abaAtiva === 'itens' && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setAbaAtiva('pagamento')}
                      >
                        Voltar
                      </Button>
                    )}
                    {abaAtiva === 'avaliacao' &&
                      podeEditar &&
                      form.status === 'enviado' &&
                      !!portalLiberadoEm &&
                      !portalBloqueadoEm && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setConfirmandoVoltarRascunho(true)}
                          disabled={
                            voltandoParaRascunho || liberandoPortal || abrindoWhatsapp || aprovandoPedido
                          }
                        >
                          {voltandoParaRascunho ? 'Voltando...' : 'Rascunho'}
                        </Button>
                      )}
                    {abaAtiva === 'avaliacao' &&
                      podeEditar &&
                      form.status === 'enviado' &&
                      (!portalLiberadoEm || portalBloqueadoEm) && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void liberarPortalFornecedor()}
                          disabled={liberandoPortal || voltandoParaRascunho || aprovandoPedido}
                        >
                          {liberandoPortal ? 'Enviando...' : 'Enviar ao fornecedor'}
                        </Button>
                      )}
                    {abaAtiva === 'avaliacao' &&
                      podeEditar &&
                      form.status === 'enviado' &&
                      !!portalLiberadoEm &&
                      !portalBloqueadoEm && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void abrirWhatsappCredenciaisFornecedor()}
                          disabled={
                            abrindoWhatsapp || liberandoPortal || voltandoParaRascunho || aprovandoPedido
                          }
                        >
                          {abrindoWhatsapp ? 'Abrindo...' : 'Enviar credenciais'}
                        </Button>
                      )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void aoSalvar(undefined, false)}
                      disabled={salvando}
                    >
                      {salvando
                        ? 'Salvando...'
                        : podeConcluirPedido(form.status)
                          ? 'Salvar rascunho'
                          : 'Salvar'}
                    </Button>
                    {abaAtiva === 'dados-gerais' && (
                      <BotaoPrimario type="button" onClick={avancarParaPagamento}>
                        Avançar para pagamento
                      </BotaoPrimario>
                    )}
                    {abaAtiva === 'pagamento' && (
                      <BotaoPrimario type="button" onClick={avancarParaItens}>
                        Avançar para itens
                      </BotaoPrimario>
                    )}
                    {abaAtiva === 'itens' && podeConcluirPedido(form.status) && (
                      <BotaoPrimario
                        type="button"
                        onClick={() => void aoSalvar(undefined, true)}
                        disabled={salvando}
                      >
                        {salvando ? 'Salvando...' : 'Aprovar pedido'}
                      </BotaoPrimario>
                    )}
                    {abaAtiva === 'avaliacao' && podeEditar && form.status === 'enviado' && (
                      <BotaoPrimario
                        type="button"
                        onClick={() => {
                          setErroAprovacao('')
                          setMostrandoSenhaAprovacao(true)
                        }}
                        disabled={
                          !anexosFornecedor.some(
                            (a) =>
                              a.tipoAnexo === 'documento_fornecedor' &&
                              a.statusConferencia === 'aprovado'
                          ) ||
                          aprovandoPedido ||
                          liberandoPortal ||
                          voltandoParaRascunho
                        }
                      >
                        Aprovar pedido
                      </BotaoPrimario>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </form>
      </CardPadrao>

      <ModalConfirmacao
        aberto={confirmacaoParcelasAberta}
        titulo="Confirmar valores das parcelas"
        mensagem={mensagemConfirmacaoParcelas}
        textoConfirmar="Prosseguir"
        textoCancelar="Cancelar"
        aoConfirmar={() => void confirmarSalvarParcelas()}
        aoCancelar={cancelarConfirmacaoParcelas}
      />

      <ModalConfirmacao
        aberto={confirmandoVoltarRascunho}
        titulo="Voltar pedido para rascunho"
        mensagem="Este pedido não ficará mais disponível ao fornecedor no portal. Quer continuar?"
        textoConfirmar={voltandoParaRascunho ? 'Voltando...' : 'Continuar'}
        textoCancelar="Cancelar"
        aoConfirmar={() => {
          setConfirmandoVoltarRascunho(false)
          void voltarPedidoParaRascunho()
        }}
        aoCancelar={() => setConfirmandoVoltarRascunho(false)}
      />

      <Modal
        aberto={mostrandoSenhaAprovacao}
        aoFechar={() => {
          if (!aprovandoPedido) {
            setMostrandoSenhaAprovacao(false)
            setErroAprovacao('')
          }
        }}
        titulo="Aprovar pedido"
        largura="md"
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Uma vez aprovado, o fornecedor não terá mais acesso ao portal deste pedido e o pedido
            seguirá no sistema como aprovado.
          </p>
          {erroAprovacao && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erroAprovacao}
            </p>
          )}
          <ConfirmacaoComSenha
            mensagem="Confirme sua senha para aprovar este pedido."
            onConfirmar={confirmarAprovacaoPedido}
            onCancelar={() => {
              setMostrandoSenhaAprovacao(false)
              setErroAprovacao('')
            }}
            carregandoExterno={aprovandoPedido}
          />
        </div>
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
              onClick={() => void confirmarCancelamentoPedido()}
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
        aberto={modalListaPendenciasAberto}
        aoFechar={() => setModalListaPendenciasAberto(false)}
        titulo="Pendências do fornecedor"
        largura="lg"
      >
        <div className="space-y-4">
          {podeGerenciarCreditoPendencia && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setModalListaPendenciasAberto(false)
                  setErroModalPendencia('')
                  setMensagemPainelFornecedor('')
                  setFormPendencia(pendenciaVazia)
                  setModalPendenciaAberto(true)
                }}
              >
                <Plus className="mr-1 size-4" />
                Nova pendência
              </Button>
            </div>
          )}
          {!contexto || contexto.pendencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma pendência aberta para este fornecedor.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {contexto.pendencias.map((p) => (
                <li
                  key={p.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {TIPOS_PENDENCIA.find((t) => t.value === p.tipo)?.label ?? p.tipo}
                    </p>
                    <p className="text-muted-foreground">{p.descricao}</p>
                  </div>
                  {podeGerenciarCreditoPendencia && (
                    <button
                      type="button"
                      className="shrink-0 text-primary hover:underline"
                      onClick={() => void resolverPendencia(p.id)}
                    >
                      Resolver
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      <Modal
        aberto={modalListaCreditosAberto}
        aoFechar={() => setModalListaCreditosAberto(false)}
        titulo="Créditos do fornecedor"
        largura="lg"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              Saldo disponível:{' '}
              <strong className="tabular-nums">{formatarMoeda(totalSaldoCreditos)}</strong>
            </p>
            {podeGerenciarCreditoPendencia && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setModalListaCreditosAberto(false)
                  setErroModalCredito('')
                  setMensagemPainelFornecedor('')
                  setFormCredito(creditoVazio)
                  setModalCreditoAberto(true)
                }}
              >
                <Plus className="mr-1 size-4" />
                Novo crédito
              </Button>
            )}
          </div>
          {!contexto || contexto.creditos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum crédito registrado para este fornecedor.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {contexto.creditos.map((c) => (
                <li key={c.id} className="rounded-md border border-border p-3">
                  <p className="font-medium tabular-nums">{formatarMoeda(c.saldo)}</p>
                  <p className="text-muted-foreground">{c.origem || 'Sem origem informada'}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      <Modal
        aberto={modalPendenciaAberto}
        aoFechar={() => {
          setModalPendenciaAberto(false)
          setErroModalPendencia('')
        }}
        titulo="Registrar pendência"
        descricao="Cadastre uma pendência comercial do fornecedor (produto quebrado, defeito, crédito pendente etc.)."
        largura="md"
      >
        <form onSubmit={registrarPendencia} className="space-y-4">
          {erroModalPendencia && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erroModalPendencia}
            </p>
          )}
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
        aoFechar={() => {
          setModalCreditoAberto(false)
          setErroModalCredito('')
        }}
        titulo="Cadastrar crédito"
        descricao="Inclua um novo crédito para o fornecedor. Depois você poderá aplicá-lo na condição de pagamento."
        largura="md"
      >
        <form onSubmit={registrarCredito} className="space-y-4">
          {erroModalCredito && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erroModalCredito}
            </p>
          )}
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
        contexto.pedidosAbertos.filter((p) => p.id !== idAtual).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido em aberto para este fornecedor.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {contexto.pedidosAbertos
              .filter((p) => p.id !== idAtual)
              .map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full rounded-md border border-border p-3 text-left hover:bg-muted/30"
                    onClick={() => {
                      setModalPedidosAbertosAberto(false)
                      roteador.push(`/pedidos-compra/${p.id}?modo=editar`)
                    }}
                  >
                    <p className="font-medium">{formatarPedido(p.numero)}</p>
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
                  <CabecalhoColunaOrdenavel className="py-2 pr-3" rotulo="Pedido" coluna="pedido" ordenacao={ordenacaoHistorico} onOrdenar={alternarOrdenacaoHistorico} />
                  <CabecalhoColunaOrdenavel className="py-2 pr-3" rotulo="Fornecedor" coluna="fornecedor" ordenacao={ordenacaoHistorico} onOrdenar={alternarOrdenacaoHistorico} />
                  <CabecalhoColunaOrdenavel className="py-2 pr-3" rotulo="Data" coluna="data" ordenacao={ordenacaoHistorico} onOrdenar={alternarOrdenacaoHistorico} />
                  <CabecalhoColunaOrdenavel className="py-2 pr-3" rotulo="Qtd" coluna="quantidade" ordenacao={ordenacaoHistorico} onOrdenar={alternarOrdenacaoHistorico} />
                  <CabecalhoColunaOrdenavel className="py-2 pr-3" rotulo="Preço unit." coluna="preco" ordenacao={ordenacaoHistorico} onOrdenar={alternarOrdenacaoHistorico} />
                  <CabecalhoColunaOrdenavel className="py-2" rotulo="Custo" coluna="custo" ordenacao={ordenacaoHistorico} onOrdenar={alternarOrdenacaoHistorico} />
                </tr>
              </thead>
              <tbody>
                {historicoExibido.map((h, i) => (
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

      {anexoEmConferencia && pedidoId && (
        <ModalConferenciaIa
          key={anexoEmConferencia.id}
          aberto
          pedidoId={pedidoId}
          anexoId={anexoEmConferencia.id}
          nomeArquivo={anexoEmConferencia.nomeArquivo}
          statusConferencia={anexoEmConferencia.statusConferencia}
          motivoAjuste={anexoEmConferencia.motivoAjuste}
          relatorioInicial={anexoEmConferencia.relatorioConferencia}
          aoFechar={() => setAnexoEmConferencia(null)}
          aoDecidir={() => void carregarPedidoNoForm(pedidoId)}
          aoConferirConcluida={() => void carregarPedidoNoForm(pedidoId)}
        />
      )}
    </div>
  )
}
