'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import type { RequisicaoWms } from '@/lib/requisicoes-wms'
import { SelectPadrao } from '@/components/ui/select-padrao'

type Operador = { id: string; name: string }

type Props = {
  item: RequisicaoWms
  usuarioId: string
  podeEditar: boolean
  ocupado: string | null
  operadores: Operador[]
  onAcao: (acao: string, extra?: { motivo?: string; usuarioId?: string }) => void
}

export function BarraAcoesRequisicao({
  item,
  usuarioId,
  podeEditar,
  ocupado,
  operadores,
  onAcao,
}: Props) {
  const [motivo, setMotivo] = useState('')
  const [responsavel, setResponsavel] = useState(item.responsavelId ?? '')
  const ehResponsavel = item.responsavelId === usuarioId
  const busy = ocupado !== null
  const mesmoResponsavelAtual =
    Boolean(responsavel) && responsavel === (item.responsavelId ?? '')

  useEffect(() => {
    setResponsavel(item.responsavelId ?? '')
  }, [item.responsavelId])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {podeEditar && item.status === 'pendente' && (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => onAcao('disponibilizar')}
          >
            Disponibilizar
          </Button>
        )}
        {ehResponsavel && item.status === 'atribuida' && (
          <Button type="button" size="sm" disabled={busy} onClick={() => onAcao('iniciar')}>
            Iniciar
          </Button>
        )}
        {item.status === 'disponivel' && (
          <Button type="button" size="sm" disabled={busy} onClick={() => onAcao('iniciar')}>
            Iniciar
          </Button>
        )}
        {item.tipoOperacao === 'contagem_entrada' &&
          (item.status === 'atribuida' ||
            item.status === 'em_execucao' ||
            item.status === 'pausada') && (
            <Button asChild type="button" size="sm" variant="outline">
              <Link
                href={
                  item.nfeRecebidaId
                    ? `/contagens?nfeRecebidaId=${encodeURIComponent(item.nfeRecebidaId)}`
                    : '/contagens'
                }
              >
                Contar
              </Link>
            </Button>
          )}
        {ehResponsavel && item.status === 'em_execucao' && item.tipoOperacao !== 'contagem_entrada' && (
          <>
            <Button asChild type="button" size="sm">
              <Link href={`/requisicoes/${item.id}/executar`}>Executar</Link>
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onAcao('pausar')}>
              Pausar
            </Button>
          </>
        )}
        {ehResponsavel && item.status === 'pausada' && item.tipoOperacao !== 'contagem_entrada' && (
          <>
            <Button asChild type="button" size="sm" variant="outline">
              <Link href={`/requisicoes/${item.id}/executar`}>Executar</Link>
            </Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => onAcao('retomar')}>
              Retomar
            </Button>
          </>
        )}
        {podeEditar && item.status === 'bloqueada' && (
          <Button type="button" size="sm" disabled={busy} onClick={() => onAcao('desbloquear')}>
            Desbloquear
          </Button>
        )}
      </div>

      {podeEditar &&
        (item.status === 'pendente' || item.status === 'disponivel' || item.status === 'atribuida') && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <SelectPadrao
                rotulo="Atribuir a"
                valor={responsavel}
                aoMudar={setResponsavel}
                opcoes={operadores.map((o) => ({ value: o.id, label: o.name }))}
                placeholder="Operador"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !responsavel || mesmoResponsavelAtual}
              onClick={() => onAcao('atribuir', { usuarioId: responsavel })}
            >
              Atribuir
            </Button>
          </div>
        )}

      {podeEditar &&
        item.status !== 'concluida' &&
        item.status !== 'cancelada' && (
          <div className="space-y-2 border-t border-border pt-3">
            <InputPadrao
              rotulo="Motivo (obrigatório para cancelar ou bloquear)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {item.status !== 'bloqueada' &&
                item.status !== 'em_execucao' &&
                item.status !== 'pausada' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || !motivo.trim()}
                    onClick={() => onAcao('bloquear', { motivo: motivo.trim() })}
                  >
                    Bloquear
                  </Button>
                )}
              {(item.status === 'pendente' ||
                item.status === 'disponivel' ||
                item.status === 'atribuida' ||
                item.status === 'em_execucao' ||
                item.status === 'pausada') && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={busy || !motivo.trim()}
                  onClick={() => onAcao('cancelar', { motivo: motivo.trim() })}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        )}
    </div>
  )
}
