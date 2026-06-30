'use client'

import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'

type Props = {
  aoFechar: () => void
  aoAnterior?: () => void
  aoProximo?: () => void
  mostrarAnterior?: boolean
  mostrarProximo?: boolean
  rotuloProximo?: string
  aoEditar?: () => void
  podeEditar?: boolean
  aoAlternarStatus?: () => void
  podeDesativar?: boolean
  registroAtivo?: boolean
  carregandoStatus?: boolean
  rotuloDesativar?: string
  rotuloReativar?: string
}

export function RodapeModalVisualizacao({
  aoFechar,
  aoAnterior,
  aoProximo,
  mostrarAnterior = false,
  mostrarProximo = false,
  rotuloProximo = 'Próximo →',
  aoEditar,
  podeEditar = false,
  aoAlternarStatus,
  podeDesativar = false,
  registroAtivo = true,
  carregandoStatus = false,
  rotuloDesativar = 'Desativar',
  rotuloReativar = 'Reativar',
}: Props) {
  const mostrarAlternarStatus = podeDesativar && aoAlternarStatus

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <div className="flex shrink-0 gap-2">
        {mostrarAlternarStatus && (
          <Button
            type="button"
            variant={registroAtivo ? 'destructive' : 'outline'}
            onClick={aoAlternarStatus}
            disabled={carregandoStatus}
          >
            {carregandoStatus
              ? 'Aguarde...'
              : registroAtivo
                ? rotuloDesativar
                : rotuloReativar}
          </Button>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" variant="outline" onClick={aoFechar}>
          Fechar
        </Button>
        {mostrarAnterior && aoAnterior && (
          <Button type="button" variant="outline" onClick={aoAnterior}>
            ← Anterior
          </Button>
        )}
        {mostrarProximo && aoProximo && (
          <Button type="button" variant="outline" onClick={aoProximo}>
            {rotuloProximo}
          </Button>
        )}
        {podeEditar && aoEditar && (
          <BotaoPrimario type="button" onClick={aoEditar}>
            Editar
          </BotaoPrimario>
        )}
      </div>
    </div>
  )
}
