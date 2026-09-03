'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { CfopOpcaoEntrada } from '@/components/entrada-notas/item-vinculo-fiscal-grid'

export type CfopEntradaResumo = { id: string; codigo: string; nome: string }

type Props = {
  cfopXml: string | null | undefined
  cfopEntrada: CfopEntradaResumo | null | undefined
  cfopsEntrada: CfopOpcaoEntrada[]
  finalizada: boolean
  acao: boolean
  onDefinirCfopEntrada: (cfopId: string) => void | Promise<void>
  /** Layout compacto para card de lista de CT-es */
  compacto?: boolean
  /** false no dossiê NFS-e / uso e consumo — só CFOP de entrada da nota, sem rótulo de CT-e */
  exibirCfopXml?: boolean
}

/**
 * CFOP do CT-e (XML, leitura) + CFOP de entrada (sugestão/Trocar) — aba Frete/CT-e.
 */
export function CfopEntradaFreteCampos({
  cfopXml,
  cfopEntrada,
  cfopsEntrada,
  finalizada,
  acao,
  onDefinirCfopEntrada,
  compacto = false,
  exibirCfopXml = true,
}: Props) {
  const [trocando, setTrocando] = useState(false)
  const rotuloSelect = exibirCfopXml
    ? 'Selecionar CFOP de entrada do CT-e'
    : 'Selecionar CFOP de entrada'

  const blocoEntrada = (
    <div className={compacto ? 'space-y-1' : undefined}>
      {!trocando ? (
        <div className="flex flex-wrap items-center gap-2">
          {cfopEntrada ? (
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              {cfopEntrada.codigo} — {cfopEntrada.nome}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
              Sem sugestão — escolha manualmente
            </span>
          )}
          {!finalizada && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={acao}
              onClick={() => setTrocando(true)}
            >
              Trocar
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-8 rounded-md border bg-background px-2 text-xs"
            defaultValue={cfopEntrada?.id ?? ''}
            disabled={acao}
            aria-label={rotuloSelect}
            onChange={async (e) => {
              const cfopId = e.target.value
              if (!cfopId) return
              await onDefinirCfopEntrada(cfopId)
              setTrocando(false)
            }}
          >
            <option value="">Selecione…</option>
            {cfopsEntrada.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} — {c.descricao}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" variant="ghost" onClick={() => setTrocando(false)}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )

  if (!exibirCfopXml) {
    return blocoEntrada
  }

  if (compacto) {
    return (
      <dl className="mt-1 space-y-1 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium text-foreground/80">CFOP do CT-e</dt>
          <dd className="font-mono">{cfopXml ?? '—'}</dd>
        </div>
        <div className="space-y-1">
          <dt className="font-medium text-foreground/80">CFOP de entrada</dt>
          <dd>{blocoEntrada}</dd>
        </div>
      </dl>
    )
  }

  return (
    <>
      <div>
        <dt className="text-muted-foreground">CFOP do CT-e</dt>
        <dd className="font-mono font-medium">{cfopXml ?? '—'}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">CFOP de entrada</dt>
        <dd className="mt-1">{blocoEntrada}</dd>
      </div>
    </>
  )
}
