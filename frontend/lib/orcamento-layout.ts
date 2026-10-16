import { mascaraCep, mascaraCnpj, mascaraCpf, mascaraTelefone } from '@/lib/documentos'

export const AVISO_SEM_GRAVACAO =
  'Gravação, impressão e envio ficam para a próxima etapa.'

export const MENSAGEM_CLIENTE_EXEMPLO = [
  'Obrigado pelo seu interesse em nossos produtos.',
  'Este orçamento é válido pelo período informado acima.',
  'Em caso de dúvidas, estamos à disposição.',
].join('\n')

export type OpcaoFixa = {
  value: string
  label: string
}

export const OPCOES_STATUS_ORCAMENTO: readonly OpcaoFixa[] = [
  { value: 'em_aberto', label: 'Em aberto' },
  { value: 'expirado', label: 'Expirado' },
  { value: 'convertido', label: 'Convertido' },
]

export const OPCOES_VENDEDOR_ORCAMENTO: readonly OpcaoFixa[] = [
  { value: '199', label: '199 - Edson Feliciano' },
]

export const OPCOES_CONDICAO_PAGAMENTO: readonly OpcaoFixa[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
]

export const OPCOES_TIPO_ENTREGA: readonly OpcaoFixa[] = [
  { value: 'no_ato', label: 'No ato' },
  { value: 'a_retirar', label: 'A retirar' },
  { value: 'entregar', label: 'Entregar' },
  { value: 'por_encomenda', label: 'Por encomenda' },
]

const LEGADO_TIPO_ENTREGA: readonly OpcaoFixa[] = [
  { value: 'a_combinar', label: 'A combinar (legado)' },
  { value: '7', label: '7 dias (legado)' },
  { value: '15', label: '15 dias (legado)' },
  { value: '30', label: '30 dias (legado)' },
]

export function entregaNoAto(prazoEntrega: string): boolean {
  return prazoEntrega === 'no_ato'
}

export function entregaSemEndereco(prazoEntrega: string): boolean {
  return prazoEntrega === 'no_ato' || prazoEntrega === 'a_retirar'
}

export function entregaSemFrete(prazoEntrega: string): boolean {
  return prazoEntrega === 'no_ato' || prazoEntrega === 'a_retirar'
}

export function opcoesTipoEntregaOrcamento(valorAtual: string): readonly OpcaoFixa[] {
  if (!valorAtual || OPCOES_TIPO_ENTREGA.some((opcao) => opcao.value === valorAtual)) {
    return OPCOES_TIPO_ENTREGA
  }
  const legado = LEGADO_TIPO_ENTREGA.find((opcao) => opcao.value === valorAtual)
  if (legado) return [...OPCOES_TIPO_ENTREGA, legado]
  return [...OPCOES_TIPO_ENTREGA, { value: valorAtual, label: valorAtual }]
}

export const OPCOES_FRETE: readonly OpcaoFixa[] = [
  { value: 'cif', label: 'CIF - Pago por nós' },
  { value: 'fob', label: 'FOB - Pago pelo cliente' },
]

export type ItemOrcamentoLayout = {
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

export type OrcamentoLayout = {
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
  parametroBoletoId?: string | null
  prazosBoleto?: number[]
  parcelasCredito?: number | null
  condicaoPagamento: string
  prazoEntrega: string
  frete: string
  mensagem: string
  descontoTotal: number
  valorFrete: number
  outrasDespesas: number
  converterEmPedido: boolean
  pedidoVenda: { id: string; numero: string } | null
  historico: Array<{
    id: string
    acao: string
    descricao: string
    createdAt: string
    usuario: { id: string; name: string } | null
  }>
  itens: ItemOrcamentoLayout[]
}

export type ResumoOrcamento = {
  subtotal: number
  descontoTotal: number
  frete: number
  outrasDespesas: number
  total: number
  totalSt: number
  qtdItens: number
  qtdTotal: number
}

export function itemOrcamentoVazio(id: string): ItemOrcamentoLayout {
  return {
    id,
    produtoId: null,
    codigo: '',
    descricao: '',
    marca: '',
    ncm: '',
    estoque: null,
    multiploVenda: 1,
    permiteVendaFracionada: true,
    miniatura: null,
    quantidade: 1,
    unidade: 'UN',
    precoUnitario: 0,
    percentualDesconto: 0,
    valorSt: 0,
  }
}

export function linhaPreenchida(item: ItemOrcamentoLayout): boolean {
  return Boolean(item.codigo.trim() || item.descricao.trim())
}

export function valorLiquidoUnitario(item: ItemOrcamentoLayout): number {
  const preco4 = Math.round(item.precoUnitario * 10000)
  const liquido4 = Math.round((preco4 * (100 - item.percentualDesconto)) / 100)
  return liquido4 / 10000
}

export function totalLinha(item: ItemOrcamentoLayout): number {
  return centavosLinha(item) / 100
}

export function resumirOrcamento(
  orcamento: Pick<OrcamentoLayout, 'itens' | 'descontoTotal' | 'valorFrete' | 'outrasDespesas'>
): ResumoOrcamento {
  const preenchidos = orcamento.itens.filter(linhaPreenchida)
  const subtotalCentavos = preenchidos.reduce(
    (soma, item) => soma + Math.round(item.precoUnitario * item.quantidade * 100),
    0
  )
  const liquidoCentavos = preenchidos.reduce((soma, item) => soma + centavosLinha(item), 0)
  const descontoCentavos = subtotalCentavos - liquidoCentavos
  const totalStCentavos = preenchidos.reduce(
    (soma, item) => soma + Math.round(item.valorSt * 100),
    0
  )
  const freteCentavos = Math.round(orcamento.valorFrete * 100)
  const outrasCentavos = Math.round(orcamento.outrasDespesas * 100)
  const qtdTotal = preenchidos.reduce((soma, item) => soma + item.quantidade, 0)

  return {
    subtotal: subtotalCentavos / 100,
    descontoTotal: descontoCentavos / 100,
    frete: freteCentavos / 100,
    outrasDespesas: outrasCentavos / 100,
    total: (liquidoCentavos + freteCentavos + outrasCentavos + totalStCentavos) / 100,
    totalSt: totalStCentavos / 100,
    qtdItens: preenchidos.length,
    qtdTotal,
  }
}

export function opcoesVendedorOrcamento(usuario?: {
  id: string
  name: string
} | null, valorAtual?: string): OpcaoFixa[] {
  const opcoes: OpcaoFixa[] = [...OPCOES_VENDEDOR_ORCAMENTO]
  if (usuario?.id && !opcoes.some((opcao) => opcao.value === usuario.id)) {
    opcoes.push({ value: usuario.id, label: usuario.name })
  }
  if (valorAtual && !opcoes.some((opcao) => opcao.value === valorAtual)) {
    opcoes.push({ value: valorAtual, label: valorAtual })
  }
  return opcoes
}

export function vendedorIdNovoOrcamento(usuario?: {
  id: string
  cargo?: string | null
} | null): string {
  if (usuario?.id && /vendedor/i.test(usuario.cargo ?? '')) return usuario.id
  return ''
}

export function avisoQuantidadeForaDoMultiplo(
  item: Pick<ItemOrcamentoLayout, 'permiteVendaFracionada' | 'multiploVenda' | 'quantidade'>
): string | null {
  if (item.permiteVendaFracionada) return null
  const multiplo = Number(item.multiploVenda)
  if (!Number.isFinite(multiplo) || multiplo <= 0) return null
  const quociente = item.quantidade / multiplo
  if (Math.abs(quociente - Math.round(quociente)) > 0.000001) {
    return `Quantidade deve ser múltipla de ${multiplo}`
  }
  return null
}

export type SituacaoEstoque = 'ok' | 'baixo' | 'sem' | 'desconhecido'

export function situacaoEstoque(estoque: number | null, quantidade: number): SituacaoEstoque {
  if (estoque == null) return 'desconhecido'
  if (estoque <= 0) return 'sem'
  if (estoque < quantidade) return 'baixo'
  return 'ok'
}

export function rotuloStatusOrcamento(status: string): string {
  return OPCOES_STATUS_ORCAMENTO.find((opcao) => opcao.value === status)?.label ?? status
}

export function formatarDataCivil(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  if (!ano || !mes || !dia) return iso
  return `${dia}/${mes}/${ano}`
}

export function somarDiasCivil(isoData: string, dias: number): string {
  const partes = isoData.split('-').map(Number)
  const ano = partes[0]
  const mes = partes[1]
  const dia = partes[2]
  if (!ano || !mes || !dia) return isoData
  const data = new Date(ano, mes - 1, dia)
  data.setDate(data.getDate() + dias)
  const mesStr = String(data.getMonth() + 1).padStart(2, '0')
  const diaStr = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mesStr}-${diaStr}`
}

export function formatarQuantidade(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

export function formatarPrecoUnitario(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}

export function formatarEstoque(valor: number | null): string {
  if (valor == null) return '—'
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

export const EXEMPLO_ORCAMENTO: OrcamentoLayout = {
  numero: 'ORC-000123',
  data: '2026-09-16',
  validade: '2026-09-30',
  status: 'em_aberto',
  vendedorId: '199',
  clienteCodigo: '11.838',
  clienteNome: 'B&F COMERCIO E SERVICO DE MATERIAIS DE CONSTRUCAO LTDA',
  cnpj: '12.345.678/0001-90',
  telefone: '(61) 3401-3340',
  email: 'contato@bef.com.br',
  contato: 'João Silva',
  condicaoPagamento: 'cartao_credito',
  prazoEntrega: 'no_ato',
  frete: 'cif',
  mensagem: MENSAGEM_CLIENTE_EXEMPLO,
  descontoTotal: 41.24,
  valorFrete: 0,
  outrasDespesas: 0,
  converterEmPedido: true,
  pedidoVenda: null,
  historico: [],
  itens: [
    {
      id: 'item-1',
      produtoId: null,
      codigo: '13.205',
      descricao: 'TIJOLO FURADO 19 X 19 X 11.5',
      marca: '',
      ncm: '6904.10.00',
      estoque: 1250,
      multiploVenda: 1,
      permiteVendaFracionada: true,
      miniatura: null,
      quantidade: 1,
      unidade: 'UN',
      precoUnitario: 1.49,
      percentualDesconto: 0,
      valorSt: 0,
    },
    {
      id: 'item-2',
      produtoId: null,
      codigo: '17.890',
      descricao: 'TORNEIRA LAVATÓRIO ABS CROMADO',
      marca: '',
      ncm: '8481.80.19',
      estoque: 320,
      multiploVenda: 1,
      permiteVendaFracionada: true,
      miniatura: null,
      quantidade: 5,
      unidade: 'UN',
      precoUnitario: 45,
      percentualDesconto: 5,
      valorSt: 0,
    },
    {
      id: 'item-3',
      produtoId: null,
      codigo: '22.450',
      descricao: 'VARAL DE PAREDE ALUMÍNIO 1,20M',
      marca: '',
      ncm: '7616.99.00',
      estoque: 85,
      multiploVenda: 1,
      permiteVendaFracionada: true,
      miniatura: null,
      quantidade: 2,
      unidade: 'UN',
      precoUnitario: 78,
      percentualDesconto: 0,
      valorSt: 0,
    },
    {
      id: 'item-4',
      produtoId: null,
      codigo: '33.110',
      descricao: 'VASO SANITÁRIO CERÂMICO BRANCO',
      marca: '',
      ncm: '6910.10.00',
      estoque: 42,
      multiploVenda: 1,
      permiteVendaFracionada: true,
      miniatura: null,
      quantidade: 1,
      unidade: 'UN',
      precoUnitario: 459,
      percentualDesconto: 10,
      valorSt: 0,
    },
  ],
}

export function clonarExemploOrcamento(): OrcamentoLayout {
  return {
    ...EXEMPLO_ORCAMENTO,
    itens: EXEMPLO_ORCAMENTO.itens.map((item) => ({ ...item })),
  }
}

export type ModoClienteOrcamento = 'digitar' | 'buscar'

export type DadosClienteOrcamento = {
  clienteCodigo: string
  clienteNome: string
  cnpj: string
  telefone: string
  email: string
  contato: string
}

export type ClienteCadastroOrcamento = {
  tipo?: string | null
  nome: string
  cnpj?: string | null
  cpf?: string | null
  email?: string | null
  telefone?: string | null
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
}

export type EnderecoEntregaOrcamento = {
  cep: string
  logradouro: string
  numero: string
  bairro: string
  cidade: string
  uf: string
}

export const CLIENTE_ORCAMENTO_VAZIO: DadosClienteOrcamento = {
  clienteCodigo: '',
  clienteNome: '',
  cnpj: '',
  telefone: '',
  email: '',
  contato: '',
}

export function modoClienteDoOrcamento(clienteCodigo: string): ModoClienteOrcamento {
  return clienteCodigo.trim() ? 'buscar' : 'digitar'
}

export function aplicarClienteNoOrcamento(cliente: ClienteCadastroOrcamento): DadosClienteOrcamento {
  const documento = documentoFormatado(cliente)
  return {
    clienteCodigo: documento,
    clienteNome: cliente.nome,
    cnpj: documento,
    telefone: cliente.telefone ? mascaraTelefone(cliente.telefone) : '',
    email: cliente.email?.trim() ?? '',
    contato: '',
  }
}

export function enderecoEntregaDoCliente(
  cliente: ClienteCadastroOrcamento
): EnderecoEntregaOrcamento {
  return {
    cep: cliente.cep ? mascaraCep(String(cliente.cep)) : '',
    logradouro: cliente.logradouro?.trim() ?? '',
    numero: cliente.numero?.trim() ?? '',
    bairro: cliente.bairro?.trim() ?? '',
    cidade: cliente.cidade?.trim() ?? '',
    uf: cliente.estado?.trim() ?? '',
  }
}

function documentoFormatado(cliente: ClienteCadastroOrcamento): string {
  const cnpj = (cliente.cnpj ?? '').replace(/\D/g, '')
  const cpf = (cliente.cpf ?? '').replace(/\D/g, '')
  if (cliente.tipo === 'PF' || (!cnpj && cpf)) return mascaraCpf(cpf)
  return mascaraCnpj(cnpj)
}

function centavosLinha(item: ItemOrcamentoLayout): number {
  if (!linhaPreenchida(item)) return 0
  const preco4 = Math.round(item.precoUnitario * 10000)
  const liquido4 = Math.round((preco4 * (100 - item.percentualDesconto)) / 100)
  return Math.round((liquido4 * item.quantidade) / 100)
}
