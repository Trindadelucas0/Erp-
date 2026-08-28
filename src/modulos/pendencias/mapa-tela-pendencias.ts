/**
 * Quais tipos de pendência o dock mostra em cada rota.
 * Sem match → dock vazio (cadastros sem fila operacional).
 */
import type { TipoPendencia } from './tipos-pendencias.js'

const TIPOS_FINANCEIRO_CAP: TipoPendencia[] = [
  'conta_pagar_vencida',
  'conta_pagar_a_vencer',
]

const TIPOS_FINANCEIRO_CAR: TipoPendencia[] = [
  'conta_receber_vencida',
  'conta_receber_a_vencer',
]

const TIPOS_PEDIDO: TipoPendencia[] = [
  'pedido_anexo',
  'pedido_aprovar',
  'credito_fornecedor',
  'pendencia_fornecedor',
]

const TIPOS_ENTRADA: TipoPendencia[] = [
  'fila_entrada_analise',
  'fila_entrada_chegada',
  'fila_entrada_problemas',
  'fila_entrada_bloqueio',
  'problema_entrada',
  'contagem_baixar',
  'divergencia_bloquear',
]

const TIPOS_CONTAGEM: TipoPendencia[] = ['contagem_sessao']

const TIPOS_ESTOQUE: TipoPendencia[] = ['estoque_bloqueado']

const TIPOS_AUDITORIA: TipoPendencia[] = [
  'estoque_bloqueado',
  'fila_entrada_bloqueio',
]

const TIPOS_FORNECEDOR: TipoPendencia[] = [
  'credito_fornecedor',
  'pendencia_fornecedor',
]

const TIPOS_CLIENTE: TipoPendencia[] = [
  'cliente_aprovacao',
  'cliente_assinatura',
]

const TIPOS_CONFIG: TipoPendencia[] = ['recorrencia_aguardando']

/**
 * Normaliza pathname (sem query) e devolve tipos do dock.
 * Retorna null = sem dock (tela sem fila).
 * Retorna [] vazio com sentido "global" só para /inicio — usamos `null` vs array.
 */
export function tiposParaTela(pathname: string | null | undefined): TipoPendencia[] | 'global' | null {
  const path = (pathname ?? '').split('?')[0].replace(/\/+$/, '') || '/'

  if (path === '/inicio' || path === '/') return 'global'
  if (path === '/pendencias') return null

  if (path === '/contas-a-pagar' || path.startsWith('/contas-a-pagar/')) {
    return TIPOS_FINANCEIRO_CAP
  }
  if (path === '/contas-a-receber' || path.startsWith('/contas-a-receber/')) {
    return TIPOS_FINANCEIRO_CAR
  }
  if (
    path === '/pedidos-compra' ||
    path.startsWith('/pedidos-compra/')
  ) {
    return TIPOS_PEDIDO
  }
  if (path === '/entrada-notas' || path.startsWith('/entrada-notas/')) {
    return TIPOS_ENTRADA
  }
  if (path === '/contagens' || path.startsWith('/contagens/')) {
    return TIPOS_CONTAGEM
  }
  if (path === '/estoque' || path.startsWith('/estoque/')) {
    return TIPOS_ESTOQUE
  }
  if (path === '/auditoria-entradas' || path.startsWith('/auditoria-entradas/')) {
    return TIPOS_AUDITORIA
  }
  if (path === '/fornecedores' || path.startsWith('/fornecedores/')) {
    return TIPOS_FORNECEDOR
  }
  if (path === '/clientes' || path.startsWith('/clientes/')) {
    return TIPOS_CLIENTE
  }
  if (path === '/configuracoes' || path.startsWith('/configuracoes')) {
    return TIPOS_CONFIG
  }

  return null
}
