'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, Eraser, Mail, Percent, Plus, Printer, Trash2 } from 'lucide-react'
import { AnexosContaReceber } from '@/components/contas-a-receber/anexos-conta-receber'
import { MenuAcoesLinha } from '@/components/compartilhado/menu-acoes-linha'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { ModalDescontoOrcamento } from '@/components/orcamentos/modal-desconto-orcamento'
import { ModalCopiarPedido } from '@/components/orcamentos/modal-copiar-pedido'
import { Abas } from '@/components/ui/abas'
import { BadgeStatus } from '@/components/ui/badge-status'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Checkbox } from '@/components/ui/checkbox'
import { classesCampoCompacto } from '@/components/ui/classes-campo'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Label } from '@/components/ui/label'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { TextareaPadrao } from '@/components/ui/textarea-padrao'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import {
  ComboboxProduto,
  type ProdutoOpcao,
} from '@/components/pedidos-compra/combobox-produto'
import {
  ENDERECO_ORCAMENTO_VAZIO,
  deOrcamentoApi,
  montarCorpoOrcamento,
  orcamentoEmBranco,
  type EnderecoOrcamento,
  type OrcamentoApi,
} from '@/lib/orcamento-api'
import { mascaraCep } from '@/lib/documentos'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { filtrarCadastroPessoa } from '@/lib/normalizar-busca'
import { formatarMoeda } from '@/lib/pedido-compra-shared'
import {
  CLIENTE_ORCAMENTO_VAZIO,
  OPCOES_CONDICAO_PAGAMENTO,
  OPCOES_FRETE,
  aplicarClienteNoOrcamento,
  avisoQuantidadeForaDoMultiplo,
  enderecoEntregaDoCliente,
  entregaSemFrete,
  entregaSemEndereco,
  opcoesTipoEntregaOrcamento,
  opcoesVendedorOrcamento,
  formatarEstoque,
  formatarPrecoUnitario,
  formatarQuantidade,
  itemOrcamentoVazio,
  modoClienteDoOrcamento,
  resumirOrcamento,
  rotuloStatusOrcamento,
  situacaoEstoque,
  totalLinha,
  valorLiquidoUnitario,
  vendedorIdNovoOrcamento,
  type ItemOrcamentoLayout,
  type ModoClienteOrcamento,
  type OrcamentoLayout,
} from '@/lib/orcamento-layout'
import { clienteHttp } from '@/services/api'
import { cn } from '@/lib/utils'
import { usePermissao } from '@/hooks/use-permissao'

const LIMITE_MENSAGEM = 1000
const LIMITE_CLIENTES = 80
const CHAVE_MODAL_FINALIZADO = 'erp.orcamento.finalizado'

type ClienteLista = {
  id: string
  tipo?: string | null
  nome: string
  nomeFantasia?: string | null
  cpf?: string | null
  cnpj?: string | null
  email?: string | null
  telefone?: string | null
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
}

type AbaOrcamento =
  | 'itens'
  | 'endereco'
  | 'complementares'
  | 'observacoes'
  | 'anexos'
  | 'historico'

type Props = {
  orcamentoId?: string
  iniciais?: {
    orcamento: OrcamentoLayout
    endereco: EnderecoOrcamento
    complementares: string
    observacoes: string
  }
}

class ErroValidacaoOrcamento extends Error {}

function numeroDoCampo(valor: string): number {
  const normalizado = valor.replace(',', '.')
  if (normalizado.trim() === '') return 0
  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : 0
}

function varianteStatusOrcamento(status: string) {
  if (status === 'convertido') return 'sucesso' as const
  if (status === 'expirado') return 'inativo' as const
  return 'pendente' as const
}

function classePontoEstoque(situacao: ReturnType<typeof situacaoEstoque>) {
  if (situacao === 'ok') return 'bg-emerald-500'
  if (situacao === 'baixo') return 'bg-amber-500'
  if (situacao === 'sem') return 'bg-destructive'
  return 'bg-muted-foreground'
}

export function FormularioOrcamentoLayout({ orcamentoId, iniciais }: Props) {
  const roteador = useRouter()
  const { perfil } = useSessaoDoUsuario()
  const podeEditar = usePermissao('vendas:edit')
  const podeAprovar = usePermissao('vendas:approve')
  const [idGravado, setIdGravado] = useState(orcamentoId ?? '')
  const [orcamento, setOrcamento] = useState<OrcamentoLayout>(
    () => iniciais?.orcamento ?? orcamentoEmBranco()
  )
  const [abaAtiva, setAbaAtiva] = useState<AbaOrcamento>('itens')
  const [aviso, setAviso] = useState('')
  const [avisoErro, setAvisoErro] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [endereco, setEndereco] = useState<EnderecoOrcamento>(
    iniciais?.endereco ?? ENDERECO_ORCAMENTO_VAZIO
  )
  const [complementares, setComplementares] = useState(iniciais?.complementares ?? '')
  const [observacoes, setObservacoes] = useState(iniciais?.observacoes ?? '')
  const [mensagemCep, setMensagemCep] = useState('')
  const [modoCliente, setModoCliente] = useState<ModoClienteOrcamento>(() =>
    modoClienteDoOrcamento((iniciais?.orcamento ?? orcamentoEmBranco()).clienteCodigo)
  )
  const [clientes, setClientes] = useState<ClienteLista[]>([])
  const [clientesConsultados, setClientesConsultados] = useState(false)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [buscaClienteAberta, setBuscaClienteAberta] = useState(false)
  const [erroClientes, setErroClientes] = useState('')
  const cepConsultado = useRef<string | null>(
    (iniciais?.endereco.cep ?? '').replace(/\D/g, '').length === 8
      ? iniciais!.endereco.cep.replace(/\D/g, '')
      : null
  )
  const clienteEnderecoRef = useRef<ClienteLista | null>(null)
  const [produtoId, setProdutoId] = useState('')
  const [produtosBusca, setProdutosBusca] = useState<ProdutoOpcao[]>([])
  const [carregandoProdutos, setCarregandoProdutos] = useState(false)
  const [modalFinalizadoAberto, setModalFinalizadoAberto] = useState(false)
  const [modalDescontoAberto, setModalDescontoAberto] = useState(false)
  const [modalCopiarAberto, setModalCopiarAberto] = useState(false)
  const [itensSelecionados, setItensSelecionados] = useState<string[]>([])
  const bloqueado = orcamento.status === 'expirado' || orcamento.status === 'convertido'
  const semFrete = entregaSemFrete(orcamento.prazoEntrega)
  const semEndereco = entregaSemEndereco(orcamento.prazoEntrega)
  const resumo = useMemo(
    () => resumirOrcamento(semFrete ? { ...orcamento, valorFrete: 0 } : orcamento),
    [semFrete, orcamento]
  )
  const opcoesTipoEntrega = useMemo(
    () => opcoesTipoEntregaOrcamento(orcamento.prazoEntrega),
    [orcamento.prazoEntrega]
  )
  const opcoesVendedor = useMemo(
    () => opcoesVendedorOrcamento(perfil?.usuario, orcamento.vendedorId),
    [perfil?.usuario, orcamento.vendedorId]
  )
  const idsItens = useMemo(() => orcamento.itens.map((item) => item.id), [orcamento.itens])
  const todosItensSelecionados =
    idsItens.length > 0 && idsItens.every((id) => itensSelecionados.includes(id))
  const algunsItensSelecionados =
    !todosItensSelecionados && idsItens.some((id) => itensSelecionados.includes(id))
  const abasOrcamento = useMemo(() => {
    const base: Array<{ id: AbaOrcamento; rotulo: string; contador?: number }> = [
      { id: 'itens', rotulo: 'Itens', contador: resumo.qtdItens },
    ]
    if (!semEndereco) {
      base.push({ id: 'endereco', rotulo: 'Endereço de entrega' })
    }
    base.push(
      { id: 'complementares', rotulo: 'Informações complementares' },
      { id: 'observacoes', rotulo: 'Observações' },
      { id: 'anexos', rotulo: 'Anexos' },
      { id: 'historico', rotulo: 'Histórico' }
    )
    return base
  }, [semEndereco, resumo.qtdItens])

  useEffect(() => {
    if (semEndereco && abaAtiva === 'endereco') {
      setAbaAtiva('itens')
    }
  }, [semEndereco, abaAtiva])
  const clientesFiltrados = useMemo(
    () => filtrarCadastroPessoa(clientes, buscaCliente).slice(0, LIMITE_CLIENTES),
    [clientes, buscaCliente]
  )

  useEffect(() => {
    if (orcamentoId || iniciais) return
    let cancelado = false
    clienteHttp
      .get<{ numero: string; validadeOrcamentoDias: number }>('/orcamentos/proximo-numero')
      .then(({ data }) => {
        if (cancelado) return
        setOrcamento(
          orcamentoEmBranco({
            numeroPreview: data.numero,
            validadeOrcamentoDias: data.validadeOrcamentoDias,
            vendedorId: vendedorIdNovoOrcamento(perfil?.usuario),
          })
        )
      })
      .catch(() => {
        if (cancelado) return
        setOrcamento(orcamentoEmBranco({ vendedorId: vendedorIdNovoOrcamento(perfil?.usuario) }))
      })
    return () => {
      cancelado = true
    }
  }, [orcamentoId, iniciais])

  useEffect(() => {
    if (orcamentoId || iniciais) return
    const vendedorId = vendedorIdNovoOrcamento(perfil?.usuario)
    if (!vendedorId) return
    setOrcamento((atual) => (atual.vendedorId ? atual : { ...atual, vendedorId }))
  }, [orcamentoId, iniciais, perfil?.usuario])

  useEffect(() => {
    if (!orcamentoId || typeof window === 'undefined') return
    try {
      const pendente = sessionStorage.getItem(CHAVE_MODAL_FINALIZADO)
      if (pendente === orcamentoId) {
        sessionStorage.removeItem(CHAVE_MODAL_FINALIZADO)
        setModalFinalizadoAberto(true)
      }
    } catch {
      /* storage bloqueado */
    }
  }, [orcamentoId])

  useEffect(() => {
    if (modoCliente !== 'buscar' || clientesConsultados) return
    let cancelado = false
    setErroClientes('')

    clienteHttp
      .get<{ clientes: ClienteLista[] }>('/clientes')
      .then(({ data }) => {
        if (cancelado) return
        setClientes(data.clientes ?? [])
        setClientesConsultados(true)
      })
      .catch((erro: unknown) => {
        if (cancelado) return
        const status = (erro as { response?: { status?: number } }).response?.status
        setErroClientes(
          status === 403
            ? 'Sem permissão para consultar clientes'
            : 'Não foi possível buscar os clientes'
        )
        setClientesConsultados(true)
      })

    return () => {
      cancelado = true
    }
  }, [modoCliente, clientesConsultados])

  useEffect(() => {
    const digitos = endereco.cep.replace(/\D/g, '')
    if (digitos.length !== 8) {
      setMensagemCep('')
      return
    }
    if (cepConsultado.current === digitos) return

    const controle = new AbortController()
    setMensagemCep('Buscando CEP…')

    fetch(`https://brasilapi.com.br/api/cep/v2/${digitos}`, { signal: controle.signal })
      .then(async (resposta) => {
        if (resposta.status === 404) {
          cepConsultado.current = digitos
          setMensagemCep('CEP não encontrado')
          return
        }
        if (!resposta.ok) {
          setMensagemCep('Não foi possível buscar o CEP')
          return
        }
        const dados = (await resposta.json()) as {
          street?: string
          neighborhood?: string
          city?: string
          state?: string
        }
        cepConsultado.current = digitos
        setMensagemCep('')
        setEndereco((atual) => ({
          ...atual,
          logradouro: dados.street ?? '',
          bairro: dados.neighborhood ?? '',
          cidade: dados.city ?? '',
          uf: dados.state ?? '',
        }))
      })
      .catch((erro: unknown) => {
        if (erro instanceof Error && erro.name === 'AbortError') return
        setMensagemCep('Não foi possível buscar o CEP')
      })

    return () => controle.abort()
  }, [endereco.cep])

  function mostrarAviso(texto: string, erro = false) {
    setAviso(texto)
    setAvisoErro(erro)
  }

  function avisoSeNaoValidacao(erro: unknown, fallback: string) {
    if (erro instanceof ErroValidacaoOrcamento) return
    mostrarAviso(extrairMensagemApi(erro, fallback), true)
  }

  function aplicarGravado(api: OrcamentoApi) {
    const dados = deOrcamentoApi(api)
    setIdGravado(api.id)
    setOrcamento(dados.orcamento)
    setEndereco(dados.endereco)
    setComplementares(dados.complementares)
    setObservacoes(dados.observacoes)
    const digitos = dados.endereco.cep.replace(/\D/g, '')
    cepConsultado.current = digitos.length === 8 ? digitos : null
    setModoCliente(modoClienteDoOrcamento(dados.orcamento.clienteCodigo))
  }

  function trocarModoCliente(proximo: ModoClienteOrcamento) {
    if (proximo === modoCliente) return
    setModoCliente(proximo)
    setBuscaCliente('')
    setBuscaClienteAberta(false)
    clienteEnderecoRef.current = null
    setOrcamento((atual) => ({ ...atual, ...CLIENTE_ORCAMENTO_VAZIO }))
  }

  const aplicarEnderecoDoCliente = useCallback((cliente: ClienteLista) => {
    const enderecoCliente = enderecoEntregaDoCliente(cliente)
    const digitos = enderecoCliente.cep.replace(/\D/g, '')
    cepConsultado.current = digitos.length === 8 ? digitos : null
    setEndereco(enderecoCliente)
    setMensagemCep('')
  }, [])

  function escolherCliente(cliente: ClienteLista) {
    clienteEnderecoRef.current = cliente
    setOrcamento((atual) => ({ ...atual, ...aplicarClienteNoOrcamento(cliente) }))
    aplicarEnderecoDoCliente(cliente)
    setBuscaCliente('')
    setBuscaClienteAberta(false)
  }

  function usarEnderecoDoCadastro() {
    const cliente = clienteEnderecoRef.current
    if (!cliente) {
      mostrarAviso('Escolha um cliente em Buscar cliente antes de usar o endereço do cadastro.', true)
      return
    }
    const enderecoCliente = enderecoEntregaDoCliente(cliente)
    if (
      !enderecoCliente.cep &&
      !enderecoCliente.logradouro &&
      !enderecoCliente.cidade
    ) {
      mostrarAviso('O cadastro deste cliente não tem endereço para copiar.', true)
      return
    }
    aplicarEnderecoDoCliente(cliente)
    mostrarAviso('Endereço do cadastro aplicado.')
  }

  async function buscarProdutos(termo: string) {
    setCarregandoProdutos(true)
    try {
      const { data } = await clienteHttp.get('/produtos', {
        params: { q: termo, resumo: 'true', limite: 40, pagina: 1 },
      })
      const lista = (data.produtos ?? data.itens ?? []) as Array<{
        id: string
        nomeVenda: string
        sku: string | null
        unidade?: string
      }>
      setProdutosBusca(
        lista.map((produto) => ({
          id: produto.id,
          nomeVenda: produto.nomeVenda,
          sku: produto.sku,
          unidade: produto.unidade ?? 'UN',
        }))
      )
    } catch {
      setProdutosBusca([])
    } finally {
      setCarregandoProdutos(false)
    }
  }

  async function adicionarProdutoSelecionado() {
    if (!produtoId) {
      mostrarAviso('Selecione um produto na busca antes de adicionar.', true)
      return
    }
    setOcupado(true)
    try {
      const [{ data }, estoqueResposta] = await Promise.all([
        clienteHttp.get<{ produto: Record<string, unknown> }>(`/produtos/${produtoId}`),
        clienteHttp
          .get<{ qtdDisponivel?: number }>(`/estoque/${produtoId}/saldos`)
          .catch(() => ({ data: {} as { qtdDisponivel?: number } })),
      ])
      const produto = data.produto
      const estoque = estoqueResposta.data
      const novaLinha: ItemOrcamentoLayout = {
        ...itemOrcamentoVazio(`linha-${Date.now()}`),
        produtoId,
        codigo: String(produto.sku ?? ''),
        descricao: String(produto.nomeVenda ?? ''),
        marca: String(produto.marca ?? ''),
        ncm: String(produto.ncm ?? ''),
        unidade: String(produto.unidade ?? 'UN'),
        multiploVenda: Number(produto.multiploVenda ?? 1),
        permiteVendaFracionada: Boolean(produto.permiteVendaFracionada),
        miniatura: typeof produto.urlFotoMiniatura === 'string' ? produto.urlFotoMiniatura : null,
        precoUnitario:
          produto.precoVenda != null && Number.isFinite(Number(produto.precoVenda))
            ? Number(produto.precoVenda)
            : 0,
        estoque: Number(estoque.qtdDisponivel ?? 0),
      }
      setOrcamento((atual) => ({ ...atual, itens: [...atual.itens, novaLinha] }))
      setProdutoId('')
      setProdutosBusca([])
    } catch (erro) {
      mostrarAviso(extrairMensagemApi(erro, 'Não foi possível carregar o produto.'), true)
    } finally {
      setOcupado(false)
    }
  }

  function atualizar<K extends keyof OrcamentoLayout>(campo: K, valor: OrcamentoLayout[K]) {
    setOrcamento((atual) => ({ ...atual, [campo]: valor }))
  }

  function atualizarItem(id: string, parcial: Partial<ItemOrcamentoLayout>) {
    setOrcamento((atual) => ({
      ...atual,
      itens: atual.itens.map((item) => (item.id === id ? { ...item, ...parcial } : item)),
    }))
  }

  function removerLinha(id: string) {
    setOrcamento((atual) => ({
      ...atual,
      itens: atual.itens.filter((item) => item.id !== id),
    }))
    setItensSelecionados((atual) => atual.filter((itemId) => itemId !== id))
  }

  function limparItens() {
    if (!window.confirm('Remover todos os itens do orçamento?')) return
    setOrcamento((atual) => ({ ...atual, itens: [] }))
    setItensSelecionados([])
  }

  async function aplicarDesconto(percentual: number, itemIds: string[] | null) {
    if (!podeAprovar) return
    setOcupado(true)
    try {
      const gravado = await gravar()
      const { data } = await clienteHttp.post<{ orcamento: OrcamentoApi }>(
        `/orcamentos/${gravado.id}/desconto`,
        { percentual, itemIds }
      )
      aplicarGravado(data.orcamento)
    } catch (erro) {
      avisoSeNaoValidacao(erro, 'Não foi possível aplicar o desconto.')
      throw erro
    } finally {
      setOcupado(false)
    }
  }

  async function copiarPedido(pedidoVendaId: string) {
    setOcupado(true)
    try {
      const gravado = await gravar()
      const { data } = await clienteHttp.post<{ orcamento: OrcamentoApi }>(
        `/orcamentos/${gravado.id}/copiar-pedido`,
        { pedidoVendaId }
      )
      aplicarGravado(data.orcamento)
    } catch (erro) {
      avisoSeNaoValidacao(erro, 'Não foi possível copiar o pedido.')
      throw erro
    } finally {
      setOcupado(false)
    }
  }

  async function gravar(): Promise<OrcamentoApi> {
    const itemForaDoMultiplo = orcamento.itens.find((item) => avisoQuantidadeForaDoMultiplo(item))
    if (itemForaDoMultiplo) {
      const avisoQtd = avisoQuantidadeForaDoMultiplo(itemForaDoMultiplo) ?? 'Quantidade inválida'
      mostrarAviso(
        `${itemForaDoMultiplo.descricao || itemForaDoMultiplo.codigo}: ${avisoQtd}`,
        true
      )
      throw new ErroValidacaoOrcamento(avisoQtd)
    }
    const corpo = montarCorpoOrcamento(
      orcamento,
      endereco,
      complementares,
      observacoes,
      idGravado ? undefined : { numeroAoCriar: '' }
    )
    if (idGravado) {
      const { data } = await clienteHttp.patch<{ orcamento: OrcamentoApi }>(
        `/orcamentos/${idGravado}`,
        corpo
      )
      return data.orcamento
    }
    const { data } = await clienteHttp.post<{ orcamento: OrcamentoApi }>('/orcamentos', corpo)
    return data.orcamento
  }

  async function salvar() {
    setOcupado(true)
    try {
      const gravado = await gravar()
      aplicarGravado(gravado)
      mostrarAviso('Orçamento salvo.')
      if (!orcamentoId) roteador.replace(`/orcamentos/${gravado.id}`)
    } catch (erro) {
      avisoSeNaoValidacao(erro, 'Não foi possível salvar o orçamento.')
    } finally {
      setOcupado(false)
    }
  }

  function fecharModalFinalizado() {
    setModalFinalizadoAberto(false)
  }

  async function finalizar() {
    setOcupado(true)
    try {
      const gravado = await gravar()
      const { data } = await clienteHttp.post<{ orcamento: OrcamentoApi }>(
        `/orcamentos/${gravado.id}/finalizar`
      )
      aplicarGravado(data.orcamento)
      setAviso('')
      setAvisoErro(false)
      if (!orcamentoId) {
        try {
          sessionStorage.setItem(CHAVE_MODAL_FINALIZADO, gravado.id)
        } catch {
          /* storage bloqueado */
        }
        roteador.replace(`/orcamentos/${gravado.id}`)
        return
      }
      setModalFinalizadoAberto(true)
    } catch (erro) {
      avisoSeNaoValidacao(erro, 'Não foi possível finalizar o orçamento.')
    } finally {
      setOcupado(false)
    }
  }

  async function enviarPorEmail() {
    if (!idGravado) {
      mostrarAviso('Salve o orçamento antes de enviar por e-mail.', true)
      return
    }
    if (!orcamento.email.trim()) {
      mostrarAviso('Informe o e-mail do cliente.', true)
      return
    }
    setOcupado(true)
    try {
      const gravado = await gravar()
      aplicarGravado(gravado)
      await clienteHttp.post(`/orcamentos/${gravado.id}/enviar-email`)
      mostrarAviso('E-mail enviado.')
    } catch (erro) {
      avisoSeNaoValidacao(erro, 'Não foi possível enviar o e-mail.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="min-w-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2 print:hidden"
          onClick={() => roteador.push('/orcamentos')}
        >
          <ArrowLeft className="mr-1 size-4" />
          Voltar
        </Button>
        <TituloPagina
          caminho={
            idGravado
              ? `Vendas > Orçamentos > ${orcamento.numero || 'Orçamento'}`
              : 'Vendas > Orçamentos > Novo orçamento'
          }
        >
          Orçamento de venda
        </TituloPagina>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-lg font-semibold">
            Orçamento nº {orcamento.numero || '—'}
          </p>
          <BadgeStatus variante={varianteStatusOrcamento(orcamento.status)}>
            {rotuloStatusOrcamento(orcamento.status)}
          </BadgeStatus>
          {orcamento.pedidoVenda ? (
            <button
              type="button"
              className="text-sm font-normal text-primary underline"
              onClick={() => roteador.push(`/pedidos-venda/${orcamento.pedidoVenda!.id}`)}
            >
              Pedido {orcamento.pedidoVenda.numero}
            </button>
          ) : null}
        </div>
      </div>

      {aviso ? (
        <p
          className={cn(
            'rounded-md px-3 py-2 text-sm print:hidden',
            avisoErro ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
          )}
          role={avisoErro ? 'alert' : 'status'}
        >
          {aviso}
        </p>
      ) : null}

      <CardPadrao
        compacto
        permitirOverflow
        acoes={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="print:hidden"
            onClick={() => setAbaAtiva('complementares')}
          >
            Mais dados
          </Button>
        }
      >
        <div className="mb-3 flex gap-2 print:hidden">
          <Button
            type="button"
            size="sm"
            variant={modoCliente === 'digitar' ? 'default' : 'outline'}
            onClick={() => trocarModoCliente('digitar')}
          >
            Digitar
          </Button>
          <Button
            type="button"
            size="sm"
            variant={modoCliente === 'buscar' ? 'default' : 'outline'}
            onClick={() => trocarModoCliente('buscar')}
          >
            Buscar cliente
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            {modoCliente === 'buscar' ? (
              <div className="space-y-1.5">
                <Label htmlFor="busca-cliente-orcamento">Cliente</Label>
                <input
                  id="busca-cliente-orcamento"
                  name="busca-cliente"
                  className={classesCampoCompacto}
                  placeholder="Nome, nome fantasia ou documento"
                  value={buscaClienteAberta ? buscaCliente : orcamento.clienteNome}
                  autoComplete="off"
                  disabled={bloqueado}
                  onFocus={() => {
                    setBuscaCliente('')
                    setBuscaClienteAberta(true)
                  }}
                  onBlur={() => setBuscaClienteAberta(false)}
                  onChange={(evento) => {
                    setBuscaCliente(evento.target.value)
                    setBuscaClienteAberta(true)
                  }}
                />
                {erroClientes && <p className="text-sm text-destructive">{erroClientes}</p>}
                {buscaClienteAberta && !erroClientes && (
                  <ul className="absolute z-20 max-h-60 w-full overflow-auto rounded-md border bg-popover text-sm shadow-md">
                    {!clientesConsultados ? (
                      <li className="px-3 py-2 text-muted-foreground">Buscando clientes…</li>
                    ) : clientesFiltrados.length === 0 ? (
                      <li className="px-3 py-2 text-muted-foreground">Nenhum cliente</li>
                    ) : (
                      clientesFiltrados.map((cliente) => (
                        <li key={cliente.id}>
                          <button
                            type="button"
                            className="flex w-full px-3 py-2 text-left hover:bg-accent"
                            onMouseDown={(evento) => evento.preventDefault()}
                            onClick={() => escolherCliente(cliente)}
                          >
                            {cliente.nome}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            ) : (
              <InputPadrao
                rotulo="Cliente"
                name="cliente-nome"
                value={orcamento.clienteNome}
                disabled={bloqueado}
                onChange={(evento) => atualizar('clienteNome', evento.target.value)}
              />
            )}
          </div>
          <InputPadrao
            rotulo="Data do orçamento"
            name="data-orcamento"
            type="date"
            value={orcamento.data}
            readOnly
            className="bg-muted"
          />
          <InputPadrao
            rotulo="Validade"
            name="validade-orcamento"
            type="date"
            value={orcamento.validade}
            readOnly
            className="bg-muted"
          />
          <SelectPadrao
            rotulo="Condição de pagamento"
            valor={orcamento.condicaoPagamento}
            aoMudar={(valor) => atualizar('condicaoPagamento', valor)}
            opcoes={OPCOES_CONDICAO_PAGAMENTO}
            disabled={bloqueado}
          />
          <SelectPadrao
            rotulo="Vendedor"
            valor={orcamento.vendedorId}
            aoMudar={(valor) => atualizar('vendedorId', valor)}
            opcoes={opcoesVendedor}
            disabled={bloqueado}
            placeholder="Selecione"
          />
          <SelectPadrao
            rotulo="Tipo de entrega"
            valor={orcamento.prazoEntrega}
            aoMudar={(valor) => atualizar('prazoEntrega', valor)}
            opcoes={opcoesTipoEntrega}
            disabled={bloqueado}
          />
          {semFrete ? null : (
            <SelectPadrao
              rotulo="Frete"
              valor={orcamento.frete}
              aoMudar={(valor) => atualizar('frete', valor)}
              opcoes={OPCOES_FRETE}
              disabled={bloqueado}
            />
          )}
        </div>
      </CardPadrao>

      <CardPadrao compacto permitirOverflow>
        <Abas
          className="mb-4 print:hidden"
          abaAtiva={abaAtiva}
          aoMudar={(id) => setAbaAtiva(id as AbaOrcamento)}
          abas={abasOrcamento}
        />

        <div className={abaAtiva === 'itens' ? 'space-y-4' : 'hidden space-y-4 print:block'}>
          <div className="flex flex-wrap items-end gap-2 print:hidden">
            <div className="min-w-[16rem] flex-1">
              <ComboboxProduto
                rotulo="Buscar produto por código, nome ou marca..."
                produtos={produtosBusca}
                valor={produtoId}
                aoMudar={setProdutoId}
                aoBuscar={buscarProdutos}
                carregandoBusca={carregandoProdutos}
                disabled={ocupado || bloqueado}
                aoEnterComProdutoSelecionado={() => void adicionarProdutoSelecionado()}
              />
            </div>
            <Button type="button" onClick={() => void adicionarProdutoSelecionado()} disabled={ocupado || bloqueado}>
              <Plus className="size-4" />
              Adicionar itens
            </Button>
            <Button type="button" variant="outline" onClick={() => setModalCopiarAberto(true)} disabled={bloqueado}>
              <Copy className="size-4" />
              Copiar pedido
            </Button>
            <Button type="button" variant="outline" onClick={() => setModalDescontoAberto(true)} disabled={bloqueado || !podeAprovar}>
              <Percent className="size-4" />
              Aplicar descontos
            </Button>
            <MenuAcoesLinha
              ariaLabel="Mais opções"
              itens={[
                {
                  rotulo: 'Limpar itens',
                  icone: Eraser,
                  desabilitado: bloqueado || orcamento.itens.length === 0,
                  onClick: limparItens,
                },
                {
                  rotulo: 'Imprimir',
                  icone: Printer,
                  onClick: () => window.print(),
                },
                {
                  rotulo: 'Enviar por e-mail',
                  icone: Mail,
                  desabilitado: ocupado,
                  onClick: () => void enviarPorEmail(),
                },
              ]}
            />
          </div>

          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <caption className="sr-only">Itens do orçamento</caption>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">
                    <Checkbox
                      checked={todosItensSelecionados ? true : algunsItensSelecionados ? 'indeterminate' : false}
                      disabled={orcamento.itens.length === 0}
                      onCheckedChange={(marcado) =>
                        setItensSelecionados(marcado === true ? idsItens : [])
                      }
                      aria-label="Selecionar todos os itens"
                    />
                  </th>
                  <th className="min-w-72 px-2 py-2 font-medium">Produto</th>
                  <th className="px-2 py-2 font-medium">Estoque</th>
                  <th className="px-2 py-2 font-medium">Qtd.</th>
                  <th className="px-2 py-2 font-medium">Un.</th>
                  <th className="px-2 py-2 font-medium">Preço unit. (R$)</th>
                  <th className="px-2 py-2 font-medium">Valor líquido (R$)</th>
                  <th className="px-2 py-2 font-medium">Valor ST (R$)</th>
                  <th className="px-2 py-2 font-medium">Total (R$)</th>
                  <th className="px-2 py-2 font-medium print:hidden">Ações</th>
                </tr>
              </thead>
              <tbody>
                {orcamento.itens.map((item, indice) => (
                  <tr key={item.id} className="border-b border-border/70">
                    <td className="px-2 py-2">
                      <Checkbox
                        checked={itensSelecionados.includes(item.id)}
                        onCheckedChange={(marcado) =>
                          setItensSelecionados((atual) =>
                            marcado === true
                              ? [...new Set([...atual, item.id])]
                              : atual.filter((id) => id !== item.id)
                          )
                        }
                        aria-label={`Selecionar ${item.descricao}`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        {item.miniatura ? <img src={item.miniatura} alt="" className="size-10 rounded object-cover" /> : null}
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">{item.codigo || 'Sem SKU'}</p>
                          <p className="font-medium">{item.descricao}</p>
                          {item.marca ? (
                            <p className="text-xs text-muted-foreground">Marca: {item.marca}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      {(() => {
                        const situacao = situacaoEstoque(item.estoque, item.quantidade)
                        const rotulo =
                          situacao === 'ok'
                            ? 'Em estoque'
                            : situacao === 'baixo'
                              ? 'Estoque baixo'
                              : situacao === 'sem'
                                ? 'Sem estoque'
                                : '—'
                        return (
                          <div className="flex items-start gap-2">
                            <span
                              className={cn('mt-1 size-2 shrink-0 rounded-full', classePontoEstoque(situacao))}
                              aria-hidden
                            />
                            <div>
                              <p
                                className={cn(
                                  situacao === 'sem' && 'text-destructive',
                                  situacao === 'baixo' && 'text-amber-700',
                                  situacao === 'ok' && 'text-emerald-700'
                                )}
                              >
                                {rotulo}
                              </p>
                              {item.estoque != null ? (
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  {formatarEstoque(item.estoque)} {item.unidade.toLowerCase()}.
                                </p>
                              ) : null}
                            </div>
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`Quantidade da linha ${indice + 1}`}
                        className={cn(
                          classesCampoCompacto,
                          avisoQuantidadeForaDoMultiplo(item) && 'border-destructive'
                        )}
                        inputMode="decimal"
                        value={String(item.quantidade)}
                        disabled={bloqueado}
                        onChange={(evento) =>
                          atualizarItem(item.id, { quantidade: numeroDoCampo(evento.target.value) })
                        }
                      />
                      {avisoQuantidadeForaDoMultiplo(item) ? (
                        <p className="mt-1 text-xs text-destructive">
                          {avisoQuantidadeForaDoMultiplo(item)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <span>{item.unidade}</span>
                    </td>
                    <td className="px-2 py-2 tabular-nums text-muted-foreground">
                      {formatarMoeda(item.precoUnitario)}
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {formatarPrecoUnitario(valorLiquidoUnitario(item))}
                    </td>
                    <td className="px-2 py-2 tabular-nums">{formatarMoeda(item.valorSt)}</td>
                    <td className="px-2 py-2 tabular-nums font-semibold">{formatarMoeda(totalLinha(item))}</td>
                    <td className="px-2 py-2 print:hidden">
                      <div className="flex items-center gap-1">
                        <MenuAcoesLinha
                          ariaLabel={`Ações de ${item.descricao}`}
                          itens={[
                            { rotulo: 'Aplicar desconto', icone: Percent, desabilitado: bloqueado || !podeAprovar, onClick: () => { setItensSelecionados([item.id]); setModalDescontoAberto(true) } },
                          ]}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={bloqueado}
                          aria-label={`Excluir ${item.descricao}`}
                          onClick={() => removerLinha(item.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span>
                Qtd. itens: <strong className="tabular-nums">{resumo.qtdItens}</strong>
              </span>
              <span>
                Qtd. total:{' '}
                <strong className="tabular-nums">{formatarQuantidade(resumo.qtdTotal)}</strong>
              </span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div>
              <TextareaPadrao
                rotulo="Mensagem para o cliente"
                name="mensagem-cliente"
                maxLength={LIMITE_MENSAGEM}
                value={orcamento.mensagem}
                onChange={(evento) => atualizar('mensagem', evento.target.value)}
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {orcamento.mensagem.length}/{LIMITE_MENSAGEM}
              </p>
            </div>
            <dl className="h-fit space-y-2 rounded-md border border-border p-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt>Subtotal dos produtos</dt>
                <dd className="tabular-nums">{formatarMoeda(resumo.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3 text-destructive">
                <dt>Desconto total</dt>
                <dd className="tabular-nums">- {formatarMoeda(resumo.descontoTotal)}</dd>
              </div>
              {semFrete ? null : (
                <div className="flex justify-between gap-3">
                  <dt>Frete</dt>
                  <dd><input aria-label="Valor do frete" className={cn(classesCampoCompacto, 'w-28 text-right')} inputMode="decimal" disabled={bloqueado} value={String(orcamento.valorFrete)} onChange={(e) => atualizar('valorFrete', numeroDoCampo(e.target.value))} /></dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt>Outras despesas</dt>
                <dd><input aria-label="Outras despesas" className={cn(classesCampoCompacto, 'w-28 text-right')} inputMode="decimal" disabled={bloqueado} value={String(orcamento.outrasDespesas)} onChange={(e) => atualizar('outrasDespesas', numeroDoCampo(e.target.value))} /></dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Total de ST</dt>
                <dd className="tabular-nums">{formatarMoeda(resumo.totalSt)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-semibold">
                <dt>Total do orçamento</dt>
                <dd className="tabular-nums">{formatarMoeda(resumo.total)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {abaAtiva === 'endereco' ? (
          <div className="space-y-3 print:hidden">
            <Button type="button" variant="outline" size="sm" onClick={usarEnderecoDoCadastro}>
              Usar endereço do cadastro
            </Button>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <InputPadrao
              rotulo="CEP"
              name="entrega-cep"
              value={endereco.cep}
              mensagemDeErro={mensagemCep || undefined}
              onChange={(evento) =>
                setEndereco((atual) => ({ ...atual, cep: mascaraCep(evento.target.value) }))
              }
            />
            <div className="sm:col-span-2">
              <InputPadrao
                rotulo="Logradouro"
                name="entrega-logradouro"
                value={endereco.logradouro}
                onChange={(evento) =>
                  setEndereco((atual) => ({ ...atual, logradouro: evento.target.value }))
                }
              />
            </div>
            <InputPadrao
              rotulo="Número"
              name="entrega-numero"
              value={endereco.numero}
              onChange={(evento) =>
                setEndereco((atual) => ({ ...atual, numero: evento.target.value }))
              }
            />
            <InputPadrao
              rotulo="Bairro"
              name="entrega-bairro"
              value={endereco.bairro}
              onChange={(evento) =>
                setEndereco((atual) => ({ ...atual, bairro: evento.target.value }))
              }
            />
            <InputPadrao
              rotulo="Cidade"
              name="entrega-cidade"
              value={endereco.cidade}
              onChange={(evento) =>
                setEndereco((atual) => ({ ...atual, cidade: evento.target.value }))
              }
            />
            <InputPadrao
              rotulo="UF"
              name="entrega-uf"
              value={endereco.uf}
              onChange={(evento) => setEndereco((atual) => ({ ...atual, uf: evento.target.value }))}
            />
            </div>
          </div>
        ) : null}

        {abaAtiva === 'complementares' ? (
          <div className="grid gap-3 print:hidden sm:grid-cols-2">
            <InputPadrao rotulo="CNPJ/CPF" name="cliente-documento-complementar" value={orcamento.cnpj} onChange={(e) => atualizar('cnpj', e.target.value)} />
            <InputPadrao rotulo="Telefone" name="cliente-telefone-complementar" value={orcamento.telefone} onChange={(e) => atualizar('telefone', e.target.value)} />
            <InputPadrao rotulo="E-mail" name="cliente-email-complementar" value={orcamento.email} onChange={(e) => atualizar('email', e.target.value)} />
            <InputPadrao rotulo="Contato" name="cliente-contato-complementar" value={orcamento.contato} onChange={(e) => atualizar('contato', e.target.value)} />
            <div className="sm:col-span-2">
            <TextareaPadrao
              rotulo="Informações complementares"
              name="informacoes-complementares"
              value={complementares}
              onChange={(evento) => setComplementares(evento.target.value)}
            />
            </div>
          </div>
        ) : null}

        {abaAtiva === 'observacoes' ? (
          <div className="print:hidden">
            <TextareaPadrao
              rotulo="Observações"
              name="observacoes-orcamento"
              value={observacoes}
              onChange={(evento) => setObservacoes(evento.target.value)}
            />
          </div>
        ) : null}

        {abaAtiva === 'anexos' ? (
          <div className="print:hidden">
            <AnexosContaReceber contaId={idGravado || null} apiBase="/orcamentos" descricao="Arquivos relacionados a este orçamento." somenteLeitura={bloqueado} />
          </div>
        ) : null}

        {abaAtiva === 'historico' ? (
          <ul className="space-y-2 print:hidden">
            {orcamento.historico.map((evento) => (
              <li key={evento.id} className="rounded-md border px-3 py-2 text-sm">
                <p>{evento.descricao}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(evento.createdAt).toLocaleString('pt-BR')}
                  {evento.usuario?.name ? ` · ${evento.usuario.name}` : ''}
                </p>
              </li>
            ))}
            {orcamento.historico.length === 0 ? <li className="text-sm text-muted-foreground">Nenhum registro</li> : null}
          </ul>
        ) : null}
      </CardPadrao>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <Checkbox
            id="converter-pedido"
            checked={orcamento.converterEmPedido}
            disabled={bloqueado}
            onCheckedChange={(marcado) => atualizar('converterEmPedido', marcado === true)}
          />
          <Label htmlFor="converter-pedido">Converter em pedido após aprovação</Label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => { if (window.confirm('Sair do orçamento? Alterações não salvas serão perdidas.')) roteador.push('/orcamentos') }}>
            Cancelar
          </Button>
          <Button type="button" variant="outline" onClick={() => void salvar()} disabled={ocupado || bloqueado || !podeEditar}>
            Salvar orçamento
          </Button>
          <BotaoPrimario type="button" onClick={() => void finalizar()} disabled={ocupado || bloqueado || !podeAprovar || !orcamento.clienteNome.trim() || orcamento.itens.length === 0}>
            Finalizar
          </BotaoPrimario>
        </div>
      </div>

      {modalFinalizadoAberto ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 print:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) fecharModalFinalizado()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') fecharModalFinalizado()
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl"
            role="alertdialog"
            aria-labelledby="modal-orcamento-finalizado-titulo"
            aria-describedby="modal-orcamento-finalizado-mensagem"
          >
            <h2 id="modal-orcamento-finalizado-titulo" className="text-lg font-semibold">
              Orçamento finalizado
            </h2>
            <p
              id="modal-orcamento-finalizado-mensagem"
              className="mt-2 text-sm text-muted-foreground"
            >
              O orçamento foi validado. Se a conversão estava marcada, o pedido de venda foi criado. Deseja imprimir, ir para Receber
              pagamento ou permanecer neste orçamento?
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button type="button" variant="outline" onClick={fecharModalFinalizado}>
                Ficar no orçamento
              </Button>
              <Button type="button" variant="outline" onClick={() => window.print()}>
                <Printer className="size-4" />
                Imprimir proposta
              </Button>
              <BotaoPrimario
                type="button"
                onClick={() => {
                  setModalFinalizadoAberto(false)
                  roteador.push('/receber-pagamento')
                }}
              >
                Ir para Receber pagamento
              </BotaoPrimario>
            </div>
          </div>
        </div>
      ) : null}
      <ModalDescontoOrcamento
        aberto={modalDescontoAberto}
        itens={orcamento.itens}
        selecionados={itensSelecionados}
        aoFechar={() => setModalDescontoAberto(false)}
        aoAplicar={aplicarDesconto}
      />
      <ModalCopiarPedido
        aberto={modalCopiarAberto}
        aoFechar={() => setModalCopiarAberto(false)}
        aoCopiar={copiarPedido}
      />
    </div>
  )
}
