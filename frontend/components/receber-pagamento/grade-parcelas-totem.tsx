'use client'

import { formatarMoeda } from '@/lib/receber-pagamento-orcamento'
import { cn } from '@/lib/utils'

type Props = {
  total: number
  parcelas: Array<{ numeroParcelas: number }>
  selecionada: number | null
  disabled?: boolean
  onSelecionar: (numeroParcelas: number) => void
}

export function GradeParcelasTotem({
  total,
  parcelas,
  selecionada,
  disabled,
  onSelecionar,
}: Props) {
  if (parcelas.length === 0) return null

  return (
    <div className="space-y-3">
      <p className="text-lg font-semibold text-foreground">Escolha as parcelas</p>
      <div className="grid grid-cols-2 gap-3">
        {parcelas.map((item) => {
          const ativo = selecionada === item.numeroParcelas
          const valorParcela = total / item.numeroParcelas
          return (
            <button
              key={item.numeroParcelas}
              type="button"
              disabled={disabled}
              onClick={() => onSelecionar(item.numeroParcelas)}
              className={cn(
                'flex min-h-[88px] flex-col items-center justify-center rounded-xl border-2 px-3 py-4 touch-manipulation',
                ativo
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-card text-foreground'
              )}
            >
              <span className="text-lg font-bold">{item.numeroParcelas}x</span>
              <span className="text-sm text-muted-foreground">{formatarMoeda(valorParcela)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
