import { cn } from '@/lib/utils'
import { rotuloPosicaoDrop } from './estilos-hierarquia-plano'
import type { PosicaoMoverPlano } from './logica-preview-drag'

type Props = {
  nivel: number
  posicao: PosicaoMoverPlano
  linhaArrastada: { codigo: string; nome: string }
  titulo: string
  detalhe: string
  colSpan: number
}

export function LinhaPlaceholderDrag({
  nivel,
  posicao,
  linhaArrastada,
  titulo,
  detalhe,
  colSpan,
}: Props) {
  return (
    <tr className="border-b border-dashed border-primary bg-primary/5 transition-all duration-150">
      <td colSpan={colSpan} className="h-[52px] px-4 py-0">
        <div
          style={{ paddingLeft: `${nivel * 20}px` }}
          className="flex h-[52px] min-w-0 flex-col justify-center gap-0.5"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
              {rotuloPosicaoDrop(posicao)}
            </span>
            <span
              className={cn(
                'min-w-0 truncate rounded border border-dashed border-primary/50 px-2 py-0.5 text-sm font-semibold'
              )}
              title={`${linhaArrastada.codigo} - ${linhaArrastada.nome}`}
            >
              {linhaArrastada.codigo} - {linhaArrastada.nome}
            </span>
          </div>
          <div className="min-w-0 truncate text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{titulo}</span>
            <span> — {detalhe}</span>
          </div>
        </div>
      </td>
    </tr>
  )
}
