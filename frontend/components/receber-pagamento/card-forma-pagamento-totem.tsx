'use client'

import type { FormaTotemTouch } from '@/lib/receber-pagamento-totem'
import { rotuloFormaTotemTouch } from '@/lib/receber-pagamento-totem'
import { cn } from '@/lib/utils'

type Props = {
  forma: FormaTotemTouch
  chavePix?: string | null
  numeroParcelas?: number | null
  className?: string
}

export function CardFormaPagamentoTotem({
  forma,
  chavePix,
  numeroParcelas,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'flex min-h-[140px] flex-col justify-center rounded-2xl border-2 border-primary/30 bg-primary/5 px-5 py-6',
        className
      )}
    >
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Forma de pagamento
      </p>
      <p className="mt-1 text-2xl font-bold text-foreground">{rotuloFormaTotemTouch(forma)}</p>
      {forma === 'pix' ? (
        <div className="mt-3 space-y-1 text-base">
          <p className="font-medium text-foreground">Pix — aprovação imediata</p>
          {chavePix ? (
            <p className="break-all text-muted-foreground">Chave: {chavePix}</p>
          ) : (
            <p className="text-muted-foreground">Chave Pix não cadastrada em Configurações.</p>
          )}
        </div>
      ) : null}
      {forma === 'cartao_debito' ? (
        <p className="mt-3 text-base text-muted-foreground">
          Passe o cartão na maquininha. A venda conclui após aprovação.
        </p>
      ) : null}
      {forma === 'cartao_credito' ? (
        <p className="mt-3 text-base text-muted-foreground">
          {numeroParcelas && numeroParcelas > 1
            ? `${numeroParcelas}x na maquininha`
            : 'Crédito à vista ou parcelado na maquininha'}
          {numeroParcelas ? (
            <span className="mt-1 block font-semibold text-foreground">
              Parcelas escolhidas: {numeroParcelas}x
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}
