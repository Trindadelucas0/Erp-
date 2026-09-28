import { mascaraCnpj, mascaraCpf, mascaraTelefone } from '@/lib/documentos'

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
  { value: 'em_elaboracao', label: 'Em elaboração' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'aprovado', label: 'Aprovado' },
]

export const OPCOES_VENDEDOR_ORCAMENTO: readonly OpcaoFixa[] = [
  { value: '199', label: '199 - Edson Feliciano' },
]

export const OPCOES_CONDICAO_PAGAMENTO: readonly OpcaoFixa[] = [
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'a_vista', label: 'À vista' },
]

export const OPCOES_PRAZO_ENTREGA: readonly OpcaoFixa[] = [
  { value: 'a_combinar', label: 'A combinar' },
  { value: '7', label: '7 dias' },
  { value: '15', label: '15 dias' },
  { value: '30', label: '30 dias' },
]

export const OPCOES_FRETE: readonly OpcaoFixa[] = [
  { value: 'cif', label: 'CIF - Pago por nós' },
  { value: 'fob', label: 'FOB - Pago pelo cliente' },
]

export type ItemOrcamentoLayout = {
  id: string
  codigo: string
  descricao: string
  ncm: string
  estoque: number | null
  quantidade: number
  unidade: string
  precoUnitario: number
  percentualDesconto: number
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
  condicaoPagamento: string
  prazoEntrega: string
  frete: string
  mensagem: string
  descontoTotal: number
  valorFrete: number
  outrasDespesas: number
  converterEmPedido: boolean
  itens: ItemOrcamentoLayout[]
}

export type ResumoOrcamento = {
  subtotal: number
  descontoTotal: number
  frete: number
  outrasDespesas: number
  total: number
  qtdItens: number
  qtdTotal: number
}

export function itemOrcamentoVazio(id: string): ItemOrcamentoLayout {
  return {
    id,
    codigo: '',
    descricao: '',
    ncm: '',
    estoque: null,
    quantidade: 1,
    unidade: 'UN',
    precoUnitario: 0,
    percentualDesconto: 0,
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
  const subtotalCentavos = preenchidos.reduce((soma, item) => soma + centavosLinha(item), 0)
  const descontoCentavos = Math.round(orcamento.descontoTotal * 100)
  const freteCentavos = Math.round(orcamento.valorFrete * 100)
  const outrasCentavos = Math.round(orcamento.outrasDespesas * 100)
  const qtdTotal = preenchidos.reduce((soma, item) => soma + item.quantidade, 0)

  return {
    subtotal: subtotalCentavos / 100,
    descontoTotal: descontoCentavos / 100,
    frete: freteCentavos / 100,
    outrasDespesas: outrasCentavos / 100,
    total: (subtotalCentavos - descontoCentavos + freteCentavos + outrasCentavos) / 100,
    qtdItens: preenchidos.length,
    qtdTotal,
  }
}

export function rotuloStatusOrcamento(status: string): string {
  return OPCOES_STATUS_ORCAMENTO.find((opcao) => opcao.value === status)?.label ?? status
}

export function formatarDataCivil(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  if (!ano || !mes || !dia) return iso
  return `${dia}/${mes}/${ano}`
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
  status: 'em_elaboracao',
  vendedorId: '199',
  clienteCodigo: '11.838',
  clienteNome: 'B&F COMERCIO E SERVICO DE MATERIAIS DE CONSTRUCAO LTDA',
  cnpj: '12.345.678/0001-90',
  telefone: '(61) 3401-3340',
  email: 'contato@bef.com.br',
  contato: 'João Silva',
  condicaoPagamento: 'cartao_credito',
  prazoEntrega: 'a_combinar',
  frete: 'cif',
  mensagem: MENSAGEM_CLIENTE_EXEMPLO,
  descontoTotal: 41.24,
  valorFrete: 0,
  outrasDespesas: 0,
  converterEmPedido: true,
  itens: [
    {
      id: 'item-1',
      codigo: '13.205',
      descricao: 'TIJOLO FURADO 19 X 19 X 11.5',
      ncm: '6904.10.00',
      estoque: 1250,
      quantidade: 1,
      unidade: 'UN',
      precoUnitario: 1.49,
      percentualDesconto: 0,
    },
    {
      id: 'item-2',
      codigo: '17.890',
      descricao: 'TORNEIRA LAVATÓRIO ABS CROMADO',
      ncm: '8481.80.19',
      estoque: 320,
      quantidade: 5,
      unidade: 'UN',
      precoUnitario: 45,
      percentualDesconto: 5,
    },
    {
      id: 'item-3',
      codigo: '22.450',
      descricao: 'VARAL DE PAREDE ALUMÍNIO 1,20M',
      ncm: '7616.99.00',
      estoque: 85,
      quantidade: 2,
      unidade: 'UN',
      precoUnitario: 78,
      percentualDesconto: 0,
    },
    {
      id: 'item-4',
      codigo: '33.110',
      descricao: 'VASO SANITÁRIO CERÂMICO BRANCO',
      ncm: '6910.10.00',
      estoque: 42,
      quantidade: 1,
      unidade: 'UN',
      precoUnitario: 459,
      percentualDesconto: 10,
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
