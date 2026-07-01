import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { BadgeStatus } from '@/components/ui/badge-status'
import { cn } from '@/lib/utils'
import {
  classesBadgeTipoNivel,
  classesNomePorNivel,
  rotuloTipoNivel,
} from './estilos-hierarquia-plano'
import type { LinhaPlanaBase } from './logica-preview-drag'

type Props = {
  linha: LinhaPlanaBase
  largura: number
  expandidos: Set<string>
}

export function LinhaOverlayDrag({ linha, largura, expandidos }: Props) {
  const rotuloTipo = rotuloTipoNivel(linha.nivel)

  return (
    <div
      style={{ width: largura }}
      className="cursor-grabbing rounded-md border border-primary/30 bg-card/95 shadow-md"
    >
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[4%]" />
          <col className="w-[34%]" />
          <col className="w-[22%]" />
          <col className="w-[14%]" />
          <col className="w-[18%]" />
          <col className="w-[8%]" />
        </colgroup>
        <tbody>
          <tr>
            <td className="px-1 py-3">
              <div className="flex h-8 w-8 items-center justify-center text-muted-foreground">
                <GripVertical className="size-4" />
              </div>
            </td>
            <td className="max-w-0 px-4 py-3">
              <div
                className="flex min-w-0 items-center gap-1.5"
                style={{ paddingLeft: `${linha.nivel * 20}px` }}
              >
                {linha.temFilhos ? (
                  expandidos.has(linha.id) ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )
                ) : (
                  <span className="inline-block w-5 shrink-0" />
                )}
                {rotuloTipo && (
                  <span className={classesBadgeTipoNivel(linha.nivel)}>{rotuloTipo}</span>
                )}
                <span
                  className={cn('truncate', classesNomePorNivel(linha.nivel, linha.temFilhos))}
                  title={`${linha.codigo} - ${linha.nome}`}
                >
                  {linha.codigo} - {linha.nome}
                </span>
              </div>
            </td>
            <td className="max-w-0 px-4 py-3 text-muted-foreground">
              <span className="block truncate" title={linha.classificacao ?? undefined}>
                {linha.classificacao || '—'}
              </span>
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {linha.mostrarNaDre ? 'Sim' : ''}
            </td>
            <td className="px-4 py-3">
              <BadgeStatus variante={linha.ativo ? 'ativo' : 'reprovado'}>
                {linha.ativo ? 'Habilitado' : 'Desabilitado'}
              </BadgeStatus>
            </td>
            <td className="px-2 py-3" />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
