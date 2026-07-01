'use client'

import { Button } from '@/components/ui/button'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { cn } from '@/lib/utils'

type Props = {
  aoGravar: () => void
  aoCancelar: () => void
  aoExcluir?: () => void
  gravando?: boolean
  podeGravar?: boolean
  podeExcluir?: boolean
  className?: string
}

/** Barra lateral legada — preferir rodapé do Modal em telas novas */
export function BarraLateralAcoesErp({
  aoGravar,
  aoCancelar,
  aoExcluir,
  gravando,
  podeGravar = true,
  podeExcluir = false,
  className,
}: Props) {
  return (
    <div className={cn('flex w-full flex-col gap-2 sm:w-32', className)}>
      <BotaoPrimario type="button" onClick={aoGravar} disabled={gravando || !podeGravar}>
        Salvar
      </BotaoPrimario>
      <Button type="button" variant="outline" onClick={aoCancelar} disabled={gravando}>
        Cancelar
      </Button>
      {aoExcluir && podeExcluir && (
        <Button
          type="button"
          variant="outline"
          className="border-destructive/50 text-destructive hover:bg-destructive/10"
          onClick={aoExcluir}
          disabled={gravando}
        >
          Desativar
        </Button>
      )}
    </div>
  )
}
