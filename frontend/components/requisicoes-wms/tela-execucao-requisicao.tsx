'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import {
  etapaJaConferida,
  esperadoDaEtapa,
  podeConcluirExecucao,
  ROTULO_ETAPA_CONFERENCIA,
  ROTULO_TIPO_OPERACAO,
  type EtapaConferencia,
  type RequisicaoWms,
} from '@/lib/requisicoes-wms'

type Props = {
  item: RequisicaoWms
  usuarioId: string
  ocupado: string | null
  erro: string
  onConferir: (etapa: EtapaConferencia, valor: string) => Promise<void>
  onPausar: () => void
  onRetomar: () => void
  onConcluir: () => void
}

export function TelaExecucaoRequisicao({
  item,
  usuarioId,
  ocupado,
  erro,
  onConferir,
  onPausar,
  onRetomar,
  onConcluir,
}: Props) {
  const passos = item.passosExigidos ?? []
  const proximo = passos.find((p) => !etapaJaConferida(item, p))
  const [valor, setValor] = useState('')
  const ehResponsavel = item.responsavelId === usuarioId
  const emExecucao = item.status === 'em_execucao'
  const pausada = item.status === 'pausada'
  const podeBipar = ehResponsavel && emExecucao && Boolean(proximo)

  useEffect(() => {
    setValor('')
  }, [proximo, podeBipar, item.id])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!proximo || !valor.trim() || ocupado) return
    await onConferir(proximo, valor.trim())
  }

  if (!ehResponsavel) {
    return (
      <p className="text-sm text-destructive">
        Só o responsável desta requisição pode executar os passos.
      </p>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[480px] space-y-4">
      <div className="rounded-lg border-2 border-border p-4 text-sm">
        <p className="font-medium">
          {item.tipoOperacao === 'armazenagem' ? 'Guardar' : ROTULO_TIPO_OPERACAO[item.tipoOperacao]}
          {item.produtoSku ? ` · ${item.produtoSku}` : ''}
          {item.produtoNome ? ` · ${item.produtoNome}` : ''}
        </p>
        <p className="mt-1 text-muted-foreground">
          Pedido: {item.quantidade ?? '—'} {item.produtoUnidade ?? 'UN'}
          {item.qtdDisponivel != null ? ` · Disponível: ${item.qtdDisponivel} UN` : ''}
        </p>
        {item.tipoOperacao === 'armazenagem' ? (
          <p className="mt-2 break-all text-base font-semibold">
            Destino: {item.destinoCodigo || '—'}
          </p>
        ) : (
          <p className="mt-1 break-all text-muted-foreground">
            {(item.origemCodigo || '—') + ' → ' + (item.destinoCodigo || '—')}
          </p>
        )}
      </div>

      {pausada ? (
        <p className="text-sm text-muted-foreground">Pausada. Retome para continuar a conferência.</p>
      ) : null}

      <ol className="space-y-3">
        {passos.map((etapa, idx) => {
          const ok = etapaJaConferida(item, etapa)
          const ativo = etapa === proximo && emExecucao
          return (
            <li
              key={etapa}
              className="rounded-lg border-2 border-border p-4"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Passo {idx + 1}/{passos.length} · {ROTULO_ETAPA_CONFERENCIA[etapa]}
                {ok ? ' · OK' : ''}
              </p>
              <p className="mt-1 text-sm">Esperado: {esperadoDaEtapa(item, etapa) || '—'}</p>
              {ativo ? (
                <form className="mt-3 space-y-3" onSubmit={(e) => void enviar(e)}>
                  <InputPadrao
                    rotulo="Bip ou digite para confirmar"
                    value={valor}
                    onChange={(ev) => setValor(ev.target.value)}
                    className="min-h-12 text-base"
                    autoFocus
                    autoComplete="off"
                    inputMode={etapa === 'quantidade' ? 'decimal' : 'text'}
                    disabled={ocupado !== null}
                  />
                  <Button
                    type="submit"
                    className="min-h-12 w-full"
                    disabled={ocupado !== null || !valor.trim()}
                  >
                    Confirmar {ROTULO_ETAPA_CONFERENCIA[etapa].toLowerCase()}
                  </Button>
                </form>
              ) : null}
            </li>
          )
        })}
      </ol>

      {passos.length === 0 && emExecucao ? (
        <p className="text-sm text-muted-foreground">Nenhum bip exigido nesta ordem. Pode concluir.</p>
      ) : null}

      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        {emExecucao ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-12 flex-1"
            disabled={ocupado !== null}
            onClick={onPausar}
          >
            Pausar
          </Button>
        ) : null}
        {pausada ? (
          <Button
            type="button"
            className="min-h-12 flex-1"
            disabled={ocupado !== null}
            onClick={onRetomar}
          >
            Retomar
          </Button>
        ) : null}
        <Button
          type="button"
          className="min-h-12 flex-1"
          disabled={ocupado !== null || !podeConcluirExecucao(item, usuarioId)}
          onClick={onConcluir}
        >
          {item.tipoOperacao === 'armazenagem' ? 'Guardar' : 'Concluir'}
        </Button>
      </div>
    </div>
  )
}
