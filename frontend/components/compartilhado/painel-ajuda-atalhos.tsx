'use client'

import { useEffect } from 'react'
import { REGISTRO_DE_ACOES } from '@/lib/atalhos/registro-de-acoes'
import { formatarTeclaParaExibicao } from '@/lib/atalhos/interpretar-tecla'
import type {
  AtalhoConfigurado,
  ChaveDaAcao,
  CondicoesDeAtalhos,
  HandlersDeAtalhos,
} from '@/lib/atalhos/tipos'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

type Props = {
  atalhos: AtalhoConfigurado[]
  registro: { handlers: HandlersDeAtalhos; quando: CondicoesDeAtalhos }
  aoFechar: () => void
}

export function PainelAjudaAtalhos({ atalhos, registro, aoFechar }: Props) {
  useEffect(() => {
    function aoPressionarEsc(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault()
        aoFechar()
      }
    }
    document.addEventListener('keydown', aoPressionarEsc, true)
    return () => document.removeEventListener('keydown', aoPressionarEsc, true)
  }, [aoFechar])

  const mapaTeclas = new Map(
    atalhos.filter((a) => a.ativo).map((a) => [a.acao, a.tecla])
  )

  const acoesDisponiveis = REGISTRO_DE_ACOES.filter((def) => {
    if (def.global) return true
    const handler = registro.handlers[def.chave]
    const habilitado = registro.quando[def.chave] ?? Boolean(handler)
    return Boolean(handler) && habilitado
  })

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar()
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Atalhos de teclado</h2>
            <p className="text-sm text-muted-foreground">
              Atalhos disponíveis nesta tela
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={aoFechar}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {acoesDisponiveis.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum atalho disponível nesta tela.
            </p>
          ) : (
            <ul className="space-y-2">
              {acoesDisponiveis.map((def) => {
                const tecla = mapaTeclas.get(def.chave as ChaveDaAcao)
                return (
                  <li
                    key={def.chave}
                    className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{def.rotulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {def.descricao}
                      </p>
                    </div>
                    {tecla && (
                      <kbd className="shrink-0 rounded border border-border bg-muted px-2 py-1 font-mono text-xs">
                        {formatarTeclaParaExibicao(tecla)}
                      </kbd>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
