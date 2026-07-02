import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { BadgeStatus } from '@/components/ui/badge-status'
import { cn } from '@/lib/utils'
import { classesNomePorNivel } from './estilos-hierarquia-plano'
import { COLUNAS_FLAGS_PLANO, textoFlagSim } from './flags-plano-financeiro'
import type { LinhaPlanaBase } from './logica-preview-drag'

type Props = {
  linha: LinhaPlanaBase
  largura: number
  expandidos: Set<string>
}

export function LinhaOverlayDrag({ linha, largura, expandidos }: Props) {
  return (
    <div
      style={{ width: largura }}
      className="cursor-grabbing rounded-md border border-primary/30 bg-card/95 shadow-md"
    >
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[4%]" />
          <col className="w-[32%]" />
          <col className="w-[9%]" />
          <col className="w-[9%]" />
          <col className="w-[9%]" />
          <col className="w-[9%]" />
          <col className="w-[20%]" />
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
                <span
                  className={cn('truncate', classesNomePorNivel(linha.nivel, linha.temFilhos))}
                  title={`${linha.codigo} - ${linha.nome}`}
                >
                  {linha.codigo} - {linha.nome}
                </span>
              </div>
            </td>
            {COLUNAS_FLAGS_PLANO.map((coluna) => (
              <td key={coluna.chave} className="px-2 py-3 text-center text-muted-foreground">
                {textoFlagSim(linha[coluna.chave])}
              </td>
            ))}
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
