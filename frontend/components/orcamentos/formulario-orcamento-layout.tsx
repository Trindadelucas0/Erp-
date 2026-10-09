'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Printer, Trash2 } from 'lucide-react'
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
  OPCOES_VENDEDOR_ORCAMENTO,
  aplicarClienteNoOrcamento,
  enderecoEntregaDoCliente,
  entregaNoAto,
  opcoesTipoEntregaOrcamento,
  formatarEstoque,
  formatarPrecoUnitario,
  formatarQuantidade,
  itemOrcamentoVazio,
  modoClienteDoOrcamento,
  resumirOrcamento,
  rotuloStatusOrcamento,
  totalLinha,
  valorLiquidoUnitario,
  type ItemOrcamentoLayout,
  type ModoClienteOrcamento,
  type OrcamentoLayout,
} from '@/lib/orcamento-layout'
import { clienteHttp } from '@/services/api'
import { cn } from '@/lib/utils'

const LIMITE_MENSAGEM = 1000
const LIMITE_CLIENTES = 80
const AVISO_AINDA_NAO = 'Esta ação ainda não está disponível.'
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

function numeroDoCampo(valor: string): number {
  const normalizado = valor.replace(',', '.')
  if (normalizado.trim() === '') return 0
  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : 0
}

export function FormularioOrcamentoLayout({ orcamentoId, iniciais }: Props) {
  const roteador = useRouter()
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
  const noAto = entregaNoAto(orcamento.prazoEntrega)
  const resumo = useMemo(
    () => resumirOrcamento(noAto ? { ...orcamento, valorFrete: 0 } : orcamento),
    [noAto, orcamento]
  )
  const opcoesTipoEntrega = useMemo(
    () => opcoesTipoEntregaOrcamento(orcamento.prazoEntrega),
    [orcamento.prazoEntrega]
  )
  const abasOrcamento = useMemo(() => {
    const base: Array<{ id: AbaOrcamento; rotulo: string; contador?: number }> = [
      { id: 'itens', rotulo: 'Itens', contador: resumo.qtdItens },
    ]
    if (!noAto) {
      base.push({ id: 'endereco', rotulo: 'Endereço de entrega' })
    }
    base.push(
      { id: 'complementares', rotulo: 'Informações complementares' },
      { id: 'observacoes', rotulo: 'Observações' },
      { id: 'anexos', rotulo: 'Anexos' },
      { id: 'historico', rotulo: 'Histórico' }
    )
    return base
  }, [noAto, resumo.qtdItens])

  useEffect(() => {
    if (noAto && abaAtiva === 'endereco') {
      setAbaAtiva('itens')
    }
  }, [noAto, abaAtiva])
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
          })
        )
      })
      .catch(() => {
        if (cancelado) return
        setOrcamento(orcamentoEmBranco())
      })
    return () => {
      cancelado = true
    }
  }, [orcamentoId, iniciais])

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
      const { data } = await clienteHttp.get<{ produto: Record<string, unknown> }>(
        `/produtos/${produtoId}`
      )
      const produto = data.produto
      const novaLinha: ItemOrcamentoLayout = {
        ...itemOrcamentoVazio(`linha-${Date.now()}`),
        codigo: String(produto.sku ?? ''),
        descricao: String(produto.nomeVenda ?? ''),
        ncm: String(produto.ncm ?? ''),
        unidade: String(produto.unidade ?? 'UN'),
        precoUnitario:
          produto.precoVenda != null && Number.isFinite(Number(produto.precoVenda))
            ? Number(produto.precoVenda)
            : 0,
        estoque: null,
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
  }

  function limparItens() {
    setOrcamento((atual) => ({ ...atual, itens: [] }))
  }

  async function gravar(): Promise<OrcamentoApi> {
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
      await gravar()
      setAviso('')
      setAvisoErro(false)
      roteador.push('/orcamentos')
    } catch (erro) {
      mostrarAviso(extrairMensagemApi(erro, 'Não foi possível salvar o orçamento.'), true)
    } finally {
      setOcupado(false)
    }
  }

  function voltarListaPosFinalizar() {
    setModalFinalizadoAberto(false)
    roteador.push('/orcamentos')
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
      mostrarAviso(extrairMensagemApi(erro, 'Não foi possível finalizar o orçamento.'), true)
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
      mostrarAviso(extrairMensagemApi(erro, 'Não foi possível enviar o e-mail.'), true)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 print:hidden"
            onClick={() => roteador.push('/orcamentos')}
          >
            <ArrowLeft className="mr-1 size-4" />
            Voltar para lista
          </Button>
          <TituloPagina
            caminho="Vendas > Orçamentos"
            subtitulo="Preencha os dados do orçamento para gerar a proposta de venda."
            aoLadoDoTitulo={
              <BadgeStatus variante="info">{rotuloStatusOrcamento(orcamento.status)}</BadgeStatus>
            }
          >
            {idGravado ? orcamento.numero || 'Orçamento' : 'Novo Orçamento'}
          </TituloPagina>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button type="button" variant="outline" onClick={() => window.print()} disabled={ocupado}>
            <Printer className="size-4" />
            Imprimir
          </Button>
          <Button type="button" variant="outline" onClick={() => void enviarPorEmail()} disabled={ocupado}>
            <Mail className="size-4" />
            Enviar por e-mail
          </Button>
          <Button type="button" variant="outline" onClick={() => void salvar()} disabled={ocupado}>
            Salvar
          </Button>
          <BotaoPrimario type="button" onClick={() => void finalizar()} disabled={ocupado}>
            Salvar e finalizar
          </BotaoPrimario>
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <CardPadrao compacto titulo="Dados do orçamento">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <InputPadrao
              rotulo="Nº do Orçamento"
              name="numero-orcamento"
              value={orcamento.numero}
              readOnly
              className="bg-muted"
            />
            <InputPadrao
              rotulo="Data"
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
            <InputPadrao
              rotulo="Status"
              name="status-orcamento"
              value={rotuloStatusOrcamento(orcamento.status)}
              readOnly
              className="bg-muted"
            />
            <SelectPadrao
              rotulo="Vendedor"
              valor={orcamento.vendedorId}
              aoMudar={(valor) => atualizar('vendedorId', valor)}
              opcoes={OPCOES_VENDEDOR_ORCAMENTO}
            />
          </div>
        </CardPadrao>

        <CardPadrao compacto titulo="Pagamento e entrega">
          <div className="grid gap-3">
            <SelectPadrao
              rotulo="Condição de pagamento"
              valor={orcamento.condicaoPagamento}
              aoMudar={(valor) => atualizar('condicaoPagamento', valor)}
              opcoes={OPCOES_CONDICAO_PAGAMENTO}
            />
            <SelectPadrao
              rotulo="Tipo de entrega"
              valor={orcamento.prazoEntrega}
              aoMudar={(valor) => atualizar('prazoEntrega', valor)}
              opcoes={opcoesTipoEntrega}
            />
            {noAto ? null : (
              <SelectPadrao
                rotulo="Frete"
                valor={orcamento.frete}
                aoMudar={(valor) => atualizar('frete', valor)}
                opcoes={OPCOES_FRETE}
              />
            )}
          </div>
        </CardPadrao>
      </div>

      <CardPadrao
        compacto
        titulo="Cliente"
        acoes={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="print:hidden"
            onClick={() => mostrarAviso(AVISO_AINDA_NAO)}
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
        {modoCliente === 'buscar' && (
          <div className="mb-3 space-y-1.5 print:hidden">
            <Label htmlFor="busca-cliente-orcamento">Buscar cliente</Label>
            <input
              id="busca-cliente-orcamento"
              name="busca-cliente"
              className={classesCampoCompacto}
              placeholder="Nome, nome fantasia ou documento"
              value={buscaCliente}
              autoComplete="off"
              onFocus={() => setBuscaClienteAberta(true)}
              onBlur={() => setBuscaClienteAberta(false)}
              onChange={(evento) => {
                setBuscaCliente(evento.target.value)
                setBuscaClienteAberta(true)
              }}
            />
            {erroClientes && <p className="text-sm text-destructive">{erroClientes}</p>}
            {buscaClienteAberta && !erroClientes && (
              <ul className="max-h-60 overflow-auto rounded-md border bg-popover text-sm">
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
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modoCliente === 'buscar' && (
            <InputPadrao
              rotulo="Código"
              name="cliente-codigo"
              value={orcamento.clienteCodigo}
              readOnly
              className="bg-muted"
            />
          )}
          <div className={modoCliente === 'buscar' ? 'sm:col-span-2' : 'sm:col-span-2 lg:col-span-3'}>
            <InputPadrao
              rotulo="Cliente"
              name="cliente-nome"
              value={orcamento.clienteNome}
              onChange={(evento) => atualizar('clienteNome', evento.target.value)}
            />
          </div>
          <InputPadrao
            rotulo="CNPJ"
            name="cliente-cnpj"
            value={orcamento.cnpj}
            onChange={(evento) => atualizar('cnpj', evento.target.value)}
          />
          <InputPadrao
            rotulo="Telefone"
            name="cliente-telefone"
            value={orcamento.telefone}
            onChange={(evento) => atualizar('telefone', evento.target.value)}
          />
          <InputPadrao
            rotulo="E-mail"
            name="cliente-email"
            type="email"
            value={orcamento.email}
            onChange={(evento) => atualizar('email', evento.target.value)}
          />
          <InputPadrao
            rotulo="Contato"
            name="cliente-contato"
            value={orcamento.contato}
            onChange={(evento) => atualizar('contato', evento.target.value)}
          />
        </div>
      </CardPadrao>

      <CardPadrao compacto>
        <Abas
          className="mb-4 print:hidden"
          abaAtiva={abaAtiva}
          aoMudar={(id) => setAbaAtiva(id as AbaOrcamento)}
          abas={abasOrcamento}
        />

        <div className={abaAtiva === 'itens' ? 'space-y-4' : 'hidden space-y-4 print:block'}>
          <div className="grid gap-3 print:hidden sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <ComboboxProduto
              rotulo="Produto"
              produtos={produtosBusca}
              valor={produtoId}
              aoMudar={setProdutoId}
              aoBuscar={buscarProdutos}
              carregandoBusca={carregandoProdutos}
              disabled={ocupado}
              aoEnterComProdutoSelecionado={() => void adicionarProdutoSelecionado()}
            />
            <Button type="button" onClick={() => void adicionarProdutoSelecionado()} disabled={ocupado}>
              Adicionar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button type="button" variant="outline" onClick={() => mostrarAviso(AVISO_AINDA_NAO)}>
              Importar do pedido
            </Button>
            <Button type="button" variant="outline" onClick={() => mostrarAviso(AVISO_AINDA_NAO)}>
              % Aplicar desconto
            </Button>
            <Button type="button" variant="outline" onClick={() => mostrarAviso(AVISO_AINDA_NAO)}>
              Mais opções
            </Button>
          </div>

          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <caption className="sr-only">Itens do orçamento</caption>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Código</th>
                  <th className="px-2 py-2 font-medium">Descrição do produto</th>
                  <th className="px-2 py-2 font-medium">NCM</th>
                  <th className="px-2 py-2 font-medium">Estoque</th>
                  <th className="px-2 py-2 font-medium">Qtd.</th>
                  <th className="px-2 py-2 font-medium">Un.</th>
                  <th className="px-2 py-2 font-medium">Preço unit. (R$)</th>
                  <th className="px-2 py-2 font-medium">% Desc.</th>
                  <th className="px-2 py-2 font-medium">Valor líquido (R$)</th>
                  <th className="px-2 py-2 font-medium">Total (R$)</th>
                  <th className="px-2 py-2 font-medium print:hidden">
                    <span className="sr-only">Remover</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orcamento.itens.map((item, indice) => (
                  <tr key={item.id} className="border-b border-border/70">
                    <td className="px-2 py-2 tabular-nums">{indice + 1}</td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`Código da linha ${indice + 1}`}
                        className={cn(classesCampoCompacto, 'bg-muted')}
                        value={item.codigo}
                        readOnly
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`Descrição da linha ${indice + 1}`}
                        className={cn(classesCampoCompacto, 'bg-muted')}
                        value={item.descricao}
                        readOnly
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`NCM da linha ${indice + 1}`}
                        className={cn(classesCampoCompacto, 'bg-muted')}
                        value={item.ncm}
                        readOnly
                      />
                    </td>
                    <td className="px-2 py-2 tabular-nums text-muted-foreground">
                      {formatarEstoque(item.estoque)}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`Quantidade da linha ${indice + 1}`}
                        className={classesCampoCompacto}
                        inputMode="decimal"
                        value={String(item.quantidade)}
                        onChange={(evento) =>
                          atualizarItem(item.id, { quantidade: numeroDoCampo(evento.target.value) })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`Unidade da linha ${indice + 1}`}
                        className={classesCampoCompacto}
                        value={item.unidade}
                        onChange={(evento) => atualizarItem(item.id, { unidade: evento.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`Preço da linha ${indice + 1}`}
                        className={classesCampoCompacto}
                        inputMode="decimal"
                        value={String(item.precoUnitario)}
                        onChange={(evento) =>
                          atualizarItem(item.id, {
                            precoUnitario: numeroDoCampo(evento.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`Desconto da linha ${indice + 1}`}
                        className={classesCampoCompacto}
                        inputMode="decimal"
                        value={String(item.percentualDesconto)}
                        onChange={(evento) =>
                          atualizarItem(item.id, {
                            percentualDesconto: numeroDoCampo(evento.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {formatarPrecoUnitario(valorLiquidoUnitario(item))}
                    </td>
                    <td className="px-2 py-2 tabular-nums">{formatarMoeda(totalLinha(item))}</td>
                    <td className="px-2 py-2 print:hidden">
                      <button
                        type="button"
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Remover linha ${indice + 1}`}
                        onClick={() => removerLinha(item.id)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" className="print:hidden" onClick={limparItens}>
              Limpar itens
            </Button>
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
                <dd className="tabular-nums">{formatarMoeda(resumo.descontoTotal)}</dd>
              </div>
              {noAto ? null : (
                <div className="flex justify-between gap-3">
                  <dt>Frete</dt>
                  <dd className="tabular-nums">{formatarMoeda(resumo.frete)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt>Outras despesas</dt>
                <dd className="tabular-nums">{formatarMoeda(resumo.outrasDespesas)}</dd>
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
          <div className="print:hidden">
            <TextareaPadrao
              rotulo="Informações complementares"
              name="informacoes-complementares"
              value={complementares}
              onChange={(evento) => setComplementares(evento.target.value)}
            />
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
          <div className="space-y-3 print:hidden">
            <p className="text-sm text-muted-foreground">Nenhum anexo</p>
            <Button type="button" variant="outline" onClick={() => mostrarAviso(AVISO_AINDA_NAO)}>
              Anexar arquivo
            </Button>
          </div>
        ) : null}

        {abaAtiva === 'historico' ? (
          <p className="text-sm text-muted-foreground print:hidden">Nenhum registro</p>
        ) : null}
      </CardPadrao>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <Checkbox
            id="converter-pedido"
            checked={orcamento.converterEmPedido}
            onCheckedChange={(marcado) => atualizar('converterEmPedido', marcado === true)}
          />
          <Label htmlFor="converter-pedido">Converter em pedido após aprovação</Label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => roteador.push('/orcamentos')}>
            Cancelar
          </Button>
          <Button type="button" variant="outline" onClick={() => void salvar()} disabled={ocupado}>
            Salvar
          </Button>
          <BotaoPrimario type="button" onClick={() => void finalizar()} disabled={ocupado}>
            Salvar e finalizar
          </BotaoPrimario>
        </div>
      </div>

      {modalFinalizadoAberto ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 print:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) voltarListaPosFinalizar()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') voltarListaPosFinalizar()
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
              A proposta foi gerada com status Enviado. Deseja imprimir ou ir para Receber
              pagamento?
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button type="button" variant="outline" onClick={voltarListaPosFinalizar}>
                Voltar à lista
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
    </div>
  )
}
