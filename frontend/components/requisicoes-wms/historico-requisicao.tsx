'use client'

import { ROTULO_STATUS, type EventoRequisicao } from '@/lib/requisicoes-wms'

function formatarQuando(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function HistoricoRequisicao({ eventos }: { eventos: EventoRequisicao[] }) {
  if (eventos.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
  }
  return (
    <ul className="space-y-2 text-sm">
      {eventos.map((ev) => (
        <li key={ev.id} className="border-b border-border pb-2 last:border-0">
          <p>
            {formatarQuando(ev.createdAt)} · {ev.usuarioNome} · {ev.acao}
            {ev.deStatus || ev.paraStatus
              ? ` · ${ev.deStatus ? ROTULO_STATUS[ev.deStatus as keyof typeof ROTULO_STATUS] ?? ev.deStatus : '—'} → ${ROTULO_STATUS[ev.paraStatus as keyof typeof ROTULO_STATUS] ?? ev.paraStatus}`
              : null}
          </p>
          {ev.motivo ? <p className="text-muted-foreground">{ev.motivo}</p> : null}
        </li>
      ))}
    </ul>
  )
}
