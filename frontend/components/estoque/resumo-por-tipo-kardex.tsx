'use client'

import { formatarQtdEstoque, type ResumoTipoKardex } from '@/lib/estoque'
import { cn } from '@/lib/utils'

type Props = {
  resumo: ResumoTipoKardex[]
}

export function ResumoPorTipoKardex({ resumo }: Props) {
  if (resumo.length === 0) return null

  return (
    <div className="max-w-xl overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
            <th className="px-3 py-2">Tipo de movimento</th>
            <th className="px-3 py-2 text-right">Entradas</th>
            <th className="px-3 py-2 text-right">Saídas</th>
            <th className="px-3 py-2 text-right">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {resumo.map((row) => {
            const especial =
              row.tipoMovimento === '__saldo_inicial' ||
              row.tipoMovimento === '__saldo_final'
            return (
              <tr
                key={row.tipoMovimento}
                className={cn('border-b last:border-0', especial && 'bg-muted/20 font-medium')}
              >
                <td className="px-3 py-2">{row.tipoRotulo}</td>
                <td
                  className={cn(
                    'px-3 py-2 text-right tabular-nums',
                    row.entradas > 0 ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {row.entradas > 0 || especial
                    ? formatarQtdEstoque(row.entradas)
                    : '—'}
                </td>
                <td
                  className={cn(
                    'px-3 py-2 text-right tabular-nums',
                    row.saidas > 0 ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  {row.saidas > 0 || row.tipoMovimento === '__saldo_final'
                    ? formatarQtdEstoque(row.saidas)
                    : '—'}
                </td>
                <td
                  className={cn(
                    'px-3 py-2 text-right tabular-nums',
                    row.saldo < 0 ? 'text-destructive' : 'text-primary'
                  )}
                >
                  {formatarQtdEstoque(row.saldo)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
