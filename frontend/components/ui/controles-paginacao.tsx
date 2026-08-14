'use client'

import { Label } from '@/components/ui/label'
import { classesCampoCompacto } from '@/components/ui/classes-campo'
import { Button } from '@/components/ui/button'

export const OPCOES_ITENS_POR_PAGINA = [10, 25, 50] as const

export type ItensPorPagina = (typeof OPCOES_ITENS_POR_PAGINA)[number]

type ControlesPaginacaoProps = {
  total: number
  pagina: number
  itensPorPagina: ItensPorPagina
  onPaginaChange: (pagina: number) => void
  onItensPorPaginaChange: (itens: ItensPorPagina) => void
}

export function ControlesPaginacao({
  total,
  pagina,
  itensPorPagina,
  onPaginaChange,
  onItensPorPaginaChange,
}: ControlesPaginacaoProps) {
  if (total === 0) return null

  const totalPaginas = Math.max(1, Math.ceil(total / itensPorPagina))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicio = (paginaAtual - 1) * itensPorPagina + 1
  const fim = Math.min(paginaAtual * itensPorPagina, total)

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="itens-por-pagina" className="text-muted-foreground font-normal">
            Por página
          </Label>
          <select
            id="itens-por-pagina"
            className={classesCampoCompacto}
            value={itensPorPagina}
            onChange={(e) => onItensPorPaginaChange(Number(e.target.value) as ItensPorPagina)}
            aria-label="Itens por página"
          >
            {OPCOES_ITENS_POR_PAGINA.map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Mostrando {inicio}–{fim} de {total}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={paginaAtual <= 1}
          onClick={() => onPaginaChange(paginaAtual - 1)}
          aria-label="Página anterior"
        >
          Anterior
        </Button>
        <span className="min-w-[4.5rem] text-center text-sm text-muted-foreground">
          {paginaAtual} / {totalPaginas}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={paginaAtual >= totalPaginas}
          onClick={() => onPaginaChange(paginaAtual + 1)}
          aria-label="Próxima página"
        >
          Próxima
        </Button>
      </div>
    </div>
  )
}
