import type { LucideIcon } from 'lucide-react'
import {
  Archive,
  Banknote,
  Bell,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Factory,
  FileInput,
  MapPin,
  Package,
  ScrollText,
  SearchCheck,
  Settings,
  Shield,
  ShoppingCart,
  Truck,
  UserCheck,
  UserCog,
  Users,
  Warehouse,
} from 'lucide-react'
import type { PaginaDoSistema } from '@/types/sessao'

export type GrupoDoMenu = {
  id: string
  rotulo: string
  chaves: readonly string[]
}

export const GRUPOS_DO_MENU: readonly GrupoDoMenu[] = [
  {
    id: 'cadastros',
    rotulo: 'Cadastros',
    chaves: [
      'clientes',
      'clientes-aprovacao',
      'fornecedores',
      'transportadoras',
      'produtos',
      'cadastros',
    ],
  },
  {
    id: 'compras',
    rotulo: 'Compras',
    chaves: ['pedidos-compra', 'entrada-notas', 'auditoria-entradas'],
  },
  {
    id: 'logistica',
    rotulo: 'Logística',
    chaves: ['contagens', 'estoque', 'enderecos-wms', 'requisicoes', 'guardar-mercadorias'],
  },
  {
    id: 'financeiro',
    rotulo: 'Financeiro',
    chaves: ['contas-a-pagar', 'contas-a-receber'],
  },
]

const CHAVES_AVULSAS = [
  'pendencias',
  'configuracoes',
  'auditoria',
] as const

const ICONES_POR_CHAVE: Record<string, LucideIcon> = {
  cadastros: Building2,
  clientes: Users,
  fornecedores: Factory,
  transportadoras: Truck,
  produtos: Package,
  'pedidos-compra': ShoppingCart,
  'entrada-notas': FileInput,
  contagens: ClipboardCheck,
  'auditoria-entradas': SearchCheck,
  estoque: Warehouse,
  'enderecos-wms': MapPin,
  requisicoes: ClipboardList,
  'guardar-mercadorias': Archive,
  'contas-a-pagar': Banknote,
  'contas-a-receber': CircleDollarSign,
  pendencias: Bell,
  configuracoes: Settings,
  usuarios: UserCog,
  papeis: Shield,
  auditoria: ScrollText,
  'clientes-aprovacao': UserCheck,
}

export type ItemMontadoDoMenu = {
  tipo: 'item'
  pagina: PaginaDoSistema
}

export type GrupoMontadoDoMenu = {
  tipo: 'grupo'
  id: string
  rotulo: string
  filhos: PaginaDoSistema[]
}

export type EntradaDoMenu = ItemMontadoDoMenu | GrupoMontadoDoMenu

export function iconeDaPagina(chave: string): LucideIcon {
  return ICONES_POR_CHAVE[chave] ?? Package
}

export function paginaEstaAtiva(caminhoAtual: string, pagina: PaginaDoSistema): boolean {
  const caminhoBase = pagina.caminho.split('?')[0]
  if (pagina.chave === 'configuracoes') {
    return caminhoAtual === '/configuracoes' || caminhoAtual.startsWith('/configuracoes/')
  }
  if (caminhoAtual === caminhoBase) return true
  if (caminhoBase !== '/' && caminhoAtual.startsWith(`${caminhoBase}/`)) return true
  return false
}

export function montarEntradasDoMenu(paginas: PaginaDoSistema[]): EntradaDoMenu[] {
  const porChave = new Map(paginas.map((pagina) => [pagina.chave, pagina]))
  const usadas = new Set<string>()
  const entradas: EntradaDoMenu[] = []

  for (const grupo of GRUPOS_DO_MENU) {
    const filhos = grupo.chaves
      .map((chave) => porChave.get(chave))
      .filter((pagina): pagina is PaginaDoSistema => Boolean(pagina))
    if (filhos.length === 0) continue
    for (const filho of filhos) usadas.add(filho.chave)
    entradas.push({ tipo: 'grupo', id: grupo.id, rotulo: grupo.rotulo, filhos })
  }

  for (const chave of CHAVES_AVULSAS) {
    const pagina = porChave.get(chave)
    if (!pagina || usadas.has(chave)) continue
    usadas.add(chave)
    entradas.push({ tipo: 'item', pagina })
  }

  for (const pagina of paginas) {
    if (usadas.has(pagina.chave)) continue
    entradas.push({ tipo: 'item', pagina })
  }

  return entradas
}
