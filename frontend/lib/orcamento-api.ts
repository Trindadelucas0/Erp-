import {
  entregaSemFrete,
  entregaSemEndereco,
  itemOrcamentoVazio,
  linhaPreenchida,
  somarDiasCivil,
  type ItemOrcamentoLayout,
  type OrcamentoLayout,
} from './orcamento-layout'

export type EnderecoOrcamento = {
  cep: string
  logradouro: string
  numero: string
  bairro: string
  cidade: string
  uf: string
}

export type ItemOrcamentoApi = {
  id: string
  produtoId: string | null
  codigo: string
  descricao: string
  marca: string
  ncm: string
  estoque: number | null
  multiploVenda: number
  permiteVendaFracionada: boolean
  miniatura: string | null
  quantidade: number
  unidade: string
  precoUnitario: number
  percentualDesconto: number
  valorSt: number
}

export type OrcamentoApi = {
  id: string
  numero: string
  data: string
  validade: string
  status: string
  vendedorId: string
  clienteCodigo: string
  clienteNome: string
  cnpj: string
  telefone: string
  email: string
  contato: string
  condicaoPagamento: string
  prazoEntrega: string
  frete: string
  mensagem: string
  descontoTotal: number
  valorFrete: number
  outrasDespesas: number
  converterEmPedido: boolean
  endereco: EnderecoOrcamento
  complementares: string
  observacoes: string
  itens: ItemOrcamentoApi[]
  total: number
  pedidoVenda?: { id: string; numero: string } | null
  historico?: Array<{
    id: string
    acao: string
    descricao: string
    createdAt: string
    usuario: { id: string; name: string } | null
  }>
}

export type OrcamentoListaApi = {
  id: string
  numero: string
  clienteNome: string
  data: string
  status: string
  total: number
}

export const ENDERECO_ORCAMENTO_VAZIO: EnderecoOrcamento = {
  cep: '',
  logradouro: '',
  numero: '',
  bairro: '',
  cidade: '',
  uf: '',
}

function dataDeHoje(): string {
  const hoje = new Date()
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const dia = String(hoje.getDate()).padStart(2, '0')
  return `${hoje.getFullYear()}-${mes}-${dia}`
}

export function orcamentoEmBranco(opcoes?: {
  numeroPreview?: string
  validadeOrcamentoDias?: number
  vendedorId?: string
}): OrcamentoLayout {
  const data = dataDeHoje()
  const dias = opcoes?.validadeOrcamentoDias ?? 14
  return {
    numero: opcoes?.numeroPreview ?? '',
    data,
    validade: somarDiasCivil(data, dias),
    status: 'em_aberto',
    vendedorId: opcoes?.vendedorId ?? '',
    clienteCodigo: '',
    clienteNome: '',
    cnpj: '',
    telefone: '',
    email: '',
    contato: '',
    condicaoPagamento: 'a_vista',
    prazoEntrega: 'no_ato',
    frete: '',
    mensagem: '',
    descontoTotal: 0,
    valorFrete: 0,
    outrasDespesas: 0,
    converterEmPedido: false,
    pedidoVenda: null,
    historico: [],
    itens: [],
  }
}

export function statusAoSalvar(status: string): string {
  return status === 'em_aberto' ? 'em_aberto' : status
}

export function montarCorpoOrcamento(
  orcamento: OrcamentoLayout,
  endereco: EnderecoOrcamento,
  complementares: string,
  observacoes: string,
  opcoes?: { numeroAoCriar?: string }
) {
  const numero =
    opcoes?.numeroAoCriar !== undefined ? opcoes.numeroAoCriar : orcamento.numero
  const semFrete = entregaSemFrete(orcamento.prazoEntrega)
  const enderecoGravar = entregaSemEndereco(orcamento.prazoEntrega)
    ? ENDERECO_ORCAMENTO_VAZIO
    : endereco
  return {
    numero,
    data: orcamento.data,
    validade: orcamento.validade,
    status: statusAoSalvar(orcamento.status),
    vendedorId: orcamento.vendedorId,
    clienteCodigo: orcamento.clienteCodigo,
    clienteNome: orcamento.clienteNome,
    cnpj: orcamento.cnpj,
    telefone: orcamento.telefone,
    email: orcamento.email,
    contato: orcamento.contato,
    condicaoPagamento: orcamento.condicaoPagamento,
    prazoEntrega: orcamento.prazoEntrega,
    frete: semFrete ? '' : orcamento.frete,
    mensagem: orcamento.mensagem,
    descontoTotal: orcamento.descontoTotal,
    valorFrete: semFrete ? 0 : orcamento.valorFrete,
    outrasDespesas: orcamento.outrasDespesas,
    converterEmPedido: orcamento.converterEmPedido,
    endereco: enderecoGravar,
    complementares,
    observacoes,
    itens: orcamento.itens.filter(linhaPreenchida).map((item) => ({
      produtoId: item.produtoId,
      codigo: item.codigo,
      descricao: item.descricao,
      marca: item.marca,
      ncm: item.ncm,
      quantidade: item.quantidade,
      unidade: item.unidade,
      precoUnitario: item.precoUnitario,
      percentualDesconto: item.percentualDesconto,
      valorSt: item.valorSt,
    })),
  }
}

export function deOrcamentoApi(api: OrcamentoApi): {
  orcamento: OrcamentoLayout
  endereco: EnderecoOrcamento
  complementares: string
  observacoes: string
} {
  const itens: ItemOrcamentoLayout[] = api.itens.map((item) => ({ ...item }))

  return {
    orcamento: {
      numero: api.numero,
      data: api.data,
      validade: api.validade,
      status: api.status,
      vendedorId: api.vendedorId,
      clienteCodigo: api.clienteCodigo,
      clienteNome: api.clienteNome,
      cnpj: api.cnpj,
      telefone: api.telefone,
      email: api.email,
      contato: api.contato,
      condicaoPagamento: api.condicaoPagamento,
      prazoEntrega: api.prazoEntrega,
      frete: api.frete,
      mensagem: api.mensagem,
      descontoTotal: api.descontoTotal,
      valorFrete: api.valorFrete,
      outrasDespesas: api.outrasDespesas,
      converterEmPedido: api.converterEmPedido,
      pedidoVenda: api.pedidoVenda ?? null,
      historico: api.historico ?? [],
      itens,
    },
    endereco: api.endereco,
    complementares: api.complementares,
    observacoes: api.observacoes,
  }
}
