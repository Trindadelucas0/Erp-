/**
 * Catálogo de abas de área por tela (menu). Usado em papéis, sessão e API 403.
 */
import { PAINEIS_ENTRADA_LISTAGEM } from '../../modulos/focus-nfe/paineis-entrada-listagem.js'

export type AbaCatalogo = {
  id: string
  rotulo: string
}

export type GrupoTelasCatalogo = {
  id: string
  rotulo: string
  telas: TelaCatalogo[]
}

export type TelaCatalogo = {
  pageKey: string
  rotulo: string
  abas: AbaCatalogo[]
}

const ROTULOS_PAINEL_ENTRADA: Record<string, string> = {
  analise: 'Em análise',
  aguardando_chegada: 'Aguardando chegada',
  contagem: 'Liberadas p/ contagem',
  pronta_consolidar: 'Prontas para consolidar',
  consolidada: 'Entradas consolidadas',
  problemas: 'Com problemas',
  cancelada: 'Canceladas',
}

const ABAS_ENTRADA_NOTAS: AbaCatalogo[] = PAINEIS_ENTRADA_LISTAGEM.map((id) => ({
  id,
  rotulo: ROTULOS_PAINEL_ENTRADA[id] ?? id,
}))

const ABAS_CONTAS_PAGAR: AbaCatalogo[] = [
  { id: 'titulos', rotulo: 'Títulos' },
  { id: 'baixas', rotulo: 'Baixas' },
  { id: 'pagamentos', rotulo: 'Pagamentos' },
]

const ABAS_CONTAS_RECEBER: AbaCatalogo[] = [
  { id: 'titulos', rotulo: 'Títulos' },
  { id: 'baixas', rotulo: 'Baixas' },
  { id: 'recebimentos', rotulo: 'Recebimentos' },
]

const ABAS_ESTOQUE: AbaCatalogo[] = [
  { id: 'disponivel', rotulo: 'Disponível' },
  { id: 'fisico', rotulo: 'Físico' },
  { id: 'fiscal', rotulo: 'Fiscal' },
]

/** Abas folha em Configurações (pageKey configuracoes). */
const ABAS_CONFIGURACOES: AbaCatalogo[] = [
  { id: 'geral:usuarios', rotulo: 'Geral — Usuários' },
  { id: 'geral:papeis', rotulo: 'Geral — Papéis' },
  { id: 'geral:assinatura:configuracao', rotulo: 'Geral — Assinatura — Configuração' },
  { id: 'geral:assinatura:documentos', rotulo: 'Geral — Assinatura — Documentos' },
  { id: 'geral:atalhos', rotulo: 'Geral — Atalhos' },
  { id: 'vendas:parametrizacao', rotulo: 'Vendas — Parametrização de custos' },
  { id: 'logistica:unidades', rotulo: 'Logística — Unidades de medida' },
  { id: 'logistica:estrutura', rotulo: 'Logística — Estrutura WMS' },
  { id: 'logistica:veiculos', rotulo: 'Logística — Tipos de Veículos' },
  { id: 'financeiro:planos:receitas', rotulo: 'Financeiro — Planos — Receitas' },
  { id: 'financeiro:planos:despesas', rotulo: 'Financeiro — Planos — Despesas' },
  { id: 'financeiro:planos:resultado', rotulo: 'Financeiro — Planos — Resultado' },
  { id: 'financeiro:recorrencia', rotulo: 'Financeiro — Recorrência' },
  { id: 'financeiro:adquirentes', rotulo: 'Financeiro — Adquirentes' },
  { id: 'financeiro:cartoes', rotulo: 'Financeiro — Cartões de Pagamento' },
  { id: 'financeiro:boleto', rotulo: 'Financeiro — Boleto' },
  { id: 'fiscal:cfop', rotulo: 'Fiscal — CFOP' },
  { id: 'fiscal:buscador', rotulo: 'Fiscal — Buscador de NF' },
]

const ABAS_POR_PAGINA: Record<string, AbaCatalogo[]> = {
  'entrada-notas': ABAS_ENTRADA_NOTAS,
  'contas-a-pagar': ABAS_CONTAS_PAGAR,
  'contas-a-receber': ABAS_CONTAS_RECEBER,
  estoque: ABAS_ESTOQUE,
  configuracoes: ABAS_CONFIGURACOES,
}

/** Árvore para a tela de Papéis (espelha grupos do menu). */
export const GRUPOS_TELAS_CATALOGO: GrupoTelasCatalogo[] = [
  {
    id: 'cadastros',
    rotulo: 'Cadastros',
    telas: [
      { pageKey: 'clientes', rotulo: 'Clientes', abas: [] },
      { pageKey: 'fornecedores', rotulo: 'Fornecedores', abas: [] },
      { pageKey: 'transportadoras', rotulo: 'Transportadoras', abas: [] },
      { pageKey: 'produtos', rotulo: 'Produtos', abas: [] },
      { pageKey: 'cadastros', rotulo: 'Empresas', abas: [] },
    ],
  },
  {
    id: 'vendas',
    rotulo: 'Vendas',
    telas: [
      { pageKey: 'orcamentos', rotulo: 'Orçamentos', abas: [] },
      { pageKey: 'receber-pagamento', rotulo: 'Receber pagamento', abas: [] },
    ],
  },
  {
    id: 'compras',
    rotulo: 'Compras',
    telas: [
      { pageKey: 'pedidos-compra', rotulo: 'Pedidos de Compra', abas: [] },
      {
        pageKey: 'entrada-notas',
        rotulo: 'Entrada de Notas',
        abas: ABAS_ENTRADA_NOTAS,
      },
      { pageKey: 'auditoria-entradas', rotulo: 'Auditoria de entradas', abas: [] },
    ],
  },
  {
    id: 'logistica',
    rotulo: 'Logística',
    telas: [
      { pageKey: 'contagens', rotulo: 'Contagens de entrada', abas: [] },
      { pageKey: 'estoque', rotulo: 'Estoque', abas: ABAS_ESTOQUE },
      { pageKey: 'enderecos-wms', rotulo: 'Endereços WMS', abas: [] },
      { pageKey: 'requisicoes', rotulo: 'Requisições', abas: [] },
      { pageKey: 'guardar-mercadorias', rotulo: 'Guardar mercadorias', abas: [] },
      { pageKey: 'separacao', rotulo: 'Separação de pedidos', abas: [] },
    ],
  },
  {
    id: 'financeiro',
    rotulo: 'Financeiro',
    telas: [
      {
        pageKey: 'contas-a-pagar',
        rotulo: 'Contas a Pagar',
        abas: ABAS_CONTAS_PAGAR,
      },
      {
        pageKey: 'contas-a-receber',
        rotulo: 'Contas a Receber',
        abas: ABAS_CONTAS_RECEBER,
      },
      { pageKey: 'contas', rotulo: 'Contas', abas: [] },
      { pageKey: 'pendencias', rotulo: 'Pendências', abas: [] },
    ],
  },
  {
    id: 'configuracoes',
    rotulo: 'Configurações',
    telas: [
      {
        pageKey: 'configuracoes',
        rotulo: 'Configurações',
        abas: ABAS_CONFIGURACOES,
      },
    ],
  },
]

export function listarAbasDaPagina(pageKey: string): AbaCatalogo[] {
  return ABAS_POR_PAGINA[pageKey] ?? []
}

export function paginaPossuiAbasNoCatalogo(pageKey: string): boolean {
  return listarAbasDaPagina(pageKey).length > 0
}

export function abaValidaParaPagina(pageKey: string, tabKey: string): boolean {
  return listarAbasDaPagina(pageKey).some((aba) => aba.id === tabKey)
}

export function idsAbasDaPagina(pageKey: string): string[] {
  return listarAbasDaPagina(pageKey).map((a) => a.id)
}

export function todasAbasDaPagina(pageKey: string): string[] {
  return idsAbasDaPagina(pageKey)
}

/** Mapeia aba interna de Contas a Pagar/Receber para checagem de API. */
export function tabKeyContasFinanceiro(
  pageKey: 'contas-a-pagar' | 'contas-a-receber',
  abaUi: string
): string {
  return abaUi
}

/** Configurações: URL ?aba=&secao= (+ sub aba assinatura/planos). */
export function tabKeyConfiguracoes(
  aba: string,
  secao?: string | null,
  subAbaAssinatura?: string | null,
  subAbaPlanos?: string | null
): string | null {
  if (aba === 'geral' && secao === 'usuarios') return 'geral:usuarios'
  if (aba === 'geral' && secao === 'papeis') return 'geral:papeis'
  if (aba === 'geral' && secao === 'assinatura') {
    if (subAbaAssinatura === 'documentos') return 'geral:assinatura:documentos'
    return 'geral:assinatura:configuracao'
  }
  if (aba === 'geral' && secao === 'atalhos') return 'geral:atalhos'
  if (aba === 'vendas') return 'vendas:parametrizacao'
  if (aba === 'logistica' && secao === 'unidades') return 'logistica:unidades'
  if (aba === 'logistica' && secao === 'estrutura') return 'logistica:estrutura'
  if (aba === 'logistica' && secao === 'veiculos') return 'logistica:veiculos'
  if (aba === 'financeiro' && secao === 'planos') {
    if (subAbaPlanos === 'despesas') return 'financeiro:planos:despesas'
    if (subAbaPlanos === 'resultado') return 'financeiro:planos:resultado'
    return 'financeiro:planos:receitas'
  }
  if (aba === 'financeiro' && secao === 'recorrencia') return 'financeiro:recorrencia'
  if (aba === 'financeiro' && secao === 'adquirentes') return 'financeiro:adquirentes'
  if (aba === 'financeiro' && secao === 'cartoes') return 'financeiro:cartoes'
  if (aba === 'financeiro' && secao === 'boleto') return 'financeiro:boleto'
  if (aba === 'fiscal' && secao === 'cfop') return 'fiscal:cfop'
  if (aba === 'fiscal' && secao === 'buscador') return 'fiscal:buscador'
  return null
}
