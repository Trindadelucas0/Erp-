'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, LogOut, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { ResumoDoPerfil } from '@/components/layout/resumo-do-perfil'
import { Button } from '@/components/ui/button'

type Props = {
  aoFecharMenuMobile?: () => void
  className?: string
}

export function BarraLateral({ aoFecharMenuMobile, className }: Props) {
  const caminhoAtual = usePathname()
  const { perfil, estaAutenticado, encerrarSessao } = useSessaoDoUsuario()

  const itensDoMenu = perfil?.paginasPermitidas ?? []

  return (
    <aside
      className={cn(
        'flex h-full w-64 flex-col border-r border-border bg-card',
        className
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-4">
        <div className="min-w-0 pl-2">
          <h1 className="text-lg font-bold tracking-tight text-primary">
            ERP
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Sistema de Gestão</p>
        </div>
        {aoFecharMenuMobile && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={aoFecharMenuMobile}
            aria-label="Fechar menu"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {!estaAutenticado && (
          <Link
            href="/login"
            onClick={aoFecharMenuMobile}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              caminhoAtual === '/login'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            Login
          </Link>
        )}

        {estaAutenticado &&
          itensDoMenu.map((pagina) => {
            const estaAtivo =
              caminhoAtual === pagina.caminho ||
              (pagina.caminho !== '/' &&
                caminhoAtual.startsWith(pagina.caminho.split('?')[0] + '/') ) ||
              (pagina.chave === 'configuracoes' &&
                caminhoAtual.startsWith('/configuracoes'))

            return (
              <Link
                key={pagina.chave}
                href={pagina.caminho}
                onClick={aoFecharMenuMobile}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  estaAtivo
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <LayoutDashboard className="size-4 shrink-0" />
                {pagina.rotulo}
              </Link>
            )
          })}
      </nav>

      <div className="shrink-0 border-t border-border px-6 py-4 space-y-3">
        {estaAutenticado && perfil && <ResumoDoPerfil perfil={perfil} />}
        {estaAutenticado && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 px-0 text-muted-foreground hover:text-foreground"
            onClick={() => {
              encerrarSessao()
              aoFecharMenuMobile?.()
            }}
          >
            <LogOut className="size-4" />
            Sair
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
           acesso restrito por cargo
        </p>
      </div>
    </aside>
  )
}
