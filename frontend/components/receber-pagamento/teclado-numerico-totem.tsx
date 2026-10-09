'use client'

import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  buscando: boolean
  buscarHabilitado: boolean
  onDigito: (digito: string) => void
  onApagar: () => void
  onLimpar: () => void
  onBuscar: () => void
  className?: string
}

function Tecla({
  children,
  disabled,
  onClick,
  className,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className={cn('min-h-16 text-xl font-semibold', className)}
    >
      {children}
    </Button>
  )
}

export function TecladoNumericoTotem({
  buscando,
  buscarHabilitado,
  onDigito,
  onApagar,
  onLimpar,
  onBuscar,
  className,
}: Props) {
  const desabilitado = buscando
  const digitos = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

  return (
    <div className={cn('grid gap-2', className)}>
      <div className="grid grid-cols-3 gap-2">
        {digitos.map((d) => (
          <Tecla key={d} disabled={desabilitado} onClick={() => onDigito(d)}>
            {d}
          </Tecla>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Tecla disabled={desabilitado} onClick={onLimpar} className="text-base">
          Limpar
        </Tecla>
        <Tecla disabled={desabilitado} onClick={() => onDigito('0')}>
          0
        </Tecla>
        <Tecla disabled={desabilitado} onClick={onApagar} className="text-base">
          Apagar
        </Tecla>
      </div>
      <BotaoPrimario
        type="button"
        className="min-h-14 w-full text-lg"
        disabled={desabilitado || !buscarHabilitado}
        onClick={onBuscar}
      >
        {buscando ? 'Buscando…' : 'Buscar'}
      </BotaoPrimario>
    </div>
  )
}
