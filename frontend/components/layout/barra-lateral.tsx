'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, LogOut, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { ResumoDoPerfil } from '@/components/layout/resumo-do-perfil'
import { Button } from '@/components/ui/button'
import {
  iconeDaPagina,
  montarEntradasDoMenu,
  paginaEstaAtiva,
  type GrupoMontadoDoMenu,
} from '@/lib/menu-grupos'
import type { PaginaDoSistema } from '@/types/sessao'

type Props = {
  aoFecharMenuMobile?: () => void
  className?: string
}

function classesItem(ativo: boolean, indentado?: boolean) {
  return cn(
    'flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors',
    indentado ? 'px-3 pl-9' : 'px-3',
    ativo
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  )
}

function LinkPagina({
  pagina,
  caminhoAtual,
  aoFecharMenuMobile,
  indentado,
}: {
  pagina: PaginaDoSistema
  caminhoAtual: string
  aoFecharMenuMobile?: () => void
  indentado?: boolean
}) {
  const Icone = iconeDaPagina(pagina.chave)
  const ativo = paginaEstaAtiva(caminhoAtual, pagina)

  return (
    <Link
      href={pagina.caminho}
      onClick={aoFecharMenuMobile}
      className={classesItem(ativo, indentado)}
    >
      <Icone className="size-4 shrink-0" />
      {pagina.rotulo}
    </Link>
  )
}

export function BarraLateral({ aoFecharMenuMobile, className }: Props) {
  const caminhoAtual = usePathname()
  const { perfil, estaAutenticado, encerrarSessao } = useSessaoDoUsuario()

  const itensDoMenu = perfil?.paginasPermitidas ?? []
  const entradas = useMemo(() => montarEntradasDoMenu(itensDoMenu), [itensDoMenu])

  const idsAbertosPorRota = useMemo(() => {
    const ids = new Set<string>()
    for (const entrada of entradas) {
      if (entrada.tipo !== 'grupo') continue
      if (entrada.filhos.some((filho) => paginaEstaAtiva(caminhoAtual, filho))) {
        ids.add(entrada.id)
      }
    }
    return ids
  }, [entradas, caminhoAtual])

  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setGruposAbertos((atual) => {
      const proximo = { ...atual }
      for (const id of idsAbertosPorRota) {
        proximo[id] = true
      }
      return proximo
    })
  }, [idsAbertosPorRota])

  function grupoEstaAberto(grupo: GrupoMontadoDoMenu) {
    if (gruposAbertos[grupo.id] !== undefined) return gruposAbertos[grupo.id]
    return idsAbertosPorRota.has(grupo.id)
  }

  function alternarGrupo(id: string) {
    setGruposAbertos((atual) => ({
      ...atual,
      [id]: !(atual[id] ?? idsAbertosPorRota.has(id)),
    }))
  }

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
            className={classesItem(caminhoAtual === '/login')}
          >
            Login
          </Link>
        )}

        {estaAutenticado &&
          entradas.map((entrada) => {
            if (entrada.tipo === 'item') {
              return (
                <LinkPagina
                  key={entrada.pagina.chave}
                  pagina={entrada.pagina}
                  caminhoAtual={caminhoAtual}
                  aoFecharMenuMobile={aoFecharMenuMobile}
                />
              )
            }

            const aberto = grupoEstaAberto(entrada)
            const grupoAtivo = entrada.filhos.some((filho) =>
              paginaEstaAtiva(caminhoAtual, filho)
            )

            return (
              <div key={entrada.id} className="space-y-1">
                <button
                  type="button"
                  aria-expanded={aberto}
                  onClick={() => alternarGrupo(entrada.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors',
                    grupoAtivo && !aberto
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <ChevronRight
                    className={cn(
                      'size-4 shrink-0 transition-transform',
                      aberto && 'rotate-90'
                    )}
                  />
                  {entrada.rotulo}
                </button>
                {aberto &&
                  entrada.filhos.map((filho) => (
                    <LinkPagina
                      key={filho.chave}
                      pagina={filho}
                      caminhoAtual={caminhoAtual}
                      aoFecharMenuMobile={aoFecharMenuMobile}
                      indentado
                    />
                  ))}
              </div>
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
