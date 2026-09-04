'use client'

import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SeletorDeEmpresa } from '@/components/layout/seletor-de-empresa'
import { AlternadorDeTema } from '@/components/layout/alternador-de-tema'
import { SinoPendencias } from '@/components/pendencias/sino-pendencias'
import { textoVersaoSistema } from '@/lib/versao-sistema'

const TITULOS_POR_ROTA: Record<string, string> = {
  '/login': 'Login',
  '/inicio': 'Início',
  '/cadastros': 'Cadastros',
  '/users': 'Usuários',
  '/papeis': 'Gerenciar papéis',
  '/auditoria': 'Auditoria',
  '/auditoria-entradas': 'Auditoria de entradas',
  '/configuracoes': 'Configurações',
  '/clientes': 'Clientes',
  '/clientes/aprovacao': 'Aprovação de clientes',
  '/fornecedores': 'Fornecedores',
  '/transportadoras': 'Transportadoras',
  '/produtos': 'Produtos',
  '/pedidos-compra': 'Pedidos de compra',
  '/pedidos-compra/novo': 'Novo pedido de compra',
  '/entrada-notas': 'Entrada de Notas',
  '/contagens': 'Contagens de entrada',
  '/estoque': 'Estoque',
  '/enderecos-wms': 'Endereços WMS',
  '/estrutura-wms': 'Estrutura WMS',
  '/contas-a-pagar': 'Contas a Pagar',
  '/contas-a-receber': 'Contas a Receber',
  '/pendencias': 'Pendências',
}

const PREFIXOS_TITULO: { prefixo: string; titulo: string }[] = [
  { prefixo: '/auditoria-entradas/', titulo: 'Auditoria de entradas' },
  { prefixo: '/pedidos-compra/', titulo: 'Pedido de compra' },
  { prefixo: '/entrada-notas/', titulo: 'Entrada de Notas' },
  { prefixo: '/contagens/', titulo: 'Contagem de entrada' },
]

function resolverTituloRota(caminho: string | null): string {
  if (!caminho) return 'Sistema de Gestão'
  if (TITULOS_POR_ROTA[caminho]) {
    return TITULOS_POR_ROTA[caminho]
  }

  for (const { prefixo, titulo } of PREFIXOS_TITULO) {
    if (caminho.startsWith(prefixo) && caminho.length > prefixo.length) {
      return titulo
    }
  }

  return 'Sistema de Gestão'
}

type Props = {
  titulo?: string
  acoes?: React.ReactNode
  aoAbrirMenuMobile?: () => void
}

export function Cabecalho({ titulo, acoes, aoAbrirMenuMobile }: Props) {
  const caminhoAtual = usePathname()
  const tituloExibido = titulo ?? resolverTituloRota(caminhoAtual)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={aoAbrirMenuMobile}
          aria-label="Abrir menu"
        >
          <Menu className="size-5" />
        </Button>
        <h2 className="truncate text-base font-semibold tracking-tight sm:text-lg">
          {tituloExibido}
        </h2>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <span
          className="hidden max-w-[11rem] truncate text-[11px] text-muted-foreground sm:inline lg:max-w-none"
          title={textoVersaoSistema()}
        >
          {textoVersaoSistema()}
        </span>
        <SinoPendencias />
        <AlternadorDeTema />
        <SeletorDeEmpresa />
        {acoes && <div className="flex items-center gap-2">{acoes}</div>}
      </div>
    </header>
  )
}
