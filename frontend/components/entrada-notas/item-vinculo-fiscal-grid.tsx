'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type CfopOpcaoEntrada = { id: string; codigo: string; descricao: string }

export type ItemVinculoFiscal = {
  id: string
  nItem: number
  descricao: string | null
  ncm: string | null
  cfop: string | null
  cst: string | null
  origem: string | null
  produtoId: string | null
  criticaFiscal: boolean
  cfopEntrada: { id: string; codigo: string; nome: string } | null
  produto: {
    id: string
    nomeVenda: string
    ncm: string | null
    codigoOrigem: string | null
  } | null
}

function normalizarNcm(valor?: string | null): string {
  return (valor ?? '').replace(/\D/g, '').trim()
}

export function itemPrecisaImportarFiscal(item: ItemVinculoFiscal): boolean {
  if (!item.produtoId || !item.produto) return false
  const ncmNf = normalizarNcm(item.ncm)
  const ncmProd = normalizarNcm(item.produto.ncm)
  if (ncmNf && ncmNf !== ncmProd) return true
  const origNf = (item.origem ?? '').trim()
  const origProd = (item.produto.codigoOrigem ?? '').trim()
  if (origNf && origNf !== origProd) return true
  return false
}

type Props = {
  item: ItemVinculoFiscal
  finalizada: boolean
  acao: boolean
  cfopsEntrada: CfopOpcaoEntrada[]
  onImportarFiscal: () => void
  onDefinirCfopEntrada: (cfopId: string) => void | Promise<void>
}

export function ItemVinculoFiscalGrid({
  item,
  finalizada,
  acao,
  cfopsEntrada,
  onImportarFiscal,
  onDefinirCfopEntrada,
}: Props) {
  const [trocandoCfop, setTrocandoCfop] = useState(false)
  const vinculado = Boolean(item.produtoId)
  const precisaImportar = itemPrecisaImportarFiscal(item)
  const ncmNf = normalizarNcm(item.ncm)
  const ncmDivergente = Boolean(item.produto) && Boolean(ncmNf) && ncmNf !== normalizarNcm(item.produto?.ncm)
  const origNf = (item.origem ?? '').trim()
  const origDivergente =
    Boolean(item.produto) && Boolean(origNf) && origNf !== (item.produto?.codigoOrigem ?? '').trim()

  return (
    <article className="overflow-hidden rounded-md border text-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <section
          className="min-w-0 space-y-2 border-b bg-muted/40 p-3 sm:border-b-0 sm:border-r"
          aria-label="Dados fiscais da nota fiscal"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">NF</p>
          <p className="font-medium">
            #{item.nItem} {item.descricao ?? '—'}
          </p>
          <dl className="grid gap-1 text-xs text-muted-foreground">
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-foreground/80">NCM</dt>
              <dd className="font-mono">{item.ncm ?? '—'}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-foreground/80">CST/CSOSN</dt>
              <dd className="font-mono">{item.cst ?? '—'}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-foreground/80">Origem</dt>
              <dd className="font-mono">{item.origem ?? '—'}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-foreground/80">CFOP</dt>
              <dd className="font-mono">{item.cfop ?? '—'}</dd>
            </div>
          </dl>
        </section>

        <section
          className={
            vinculado
              ? 'min-w-0 space-y-2 border-l-4 border-l-emerald-500 bg-emerald-50 p-3 dark:bg-emerald-950/30'
              : 'min-w-0 space-y-2 border-l-4 border-l-muted-foreground/30 p-3'
          }
          aria-label="Dados fiscais do sistema"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">SISTEMA</p>

          {item.produto ? (
            <>
              <p className="font-medium">{item.produto.nomeVenda}</p>
              <dl className="grid gap-1 text-xs text-muted-foreground">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-foreground/80">NCM cadastro</dt>
                  <dd className={cn('font-mono', ncmDivergente && 'font-semibold text-destructive')}>
                    {item.produto.ncm ?? '—'}
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-foreground/80">Origem cadastro</dt>
                  <dd className={cn('font-mono', origDivergente && 'font-semibold text-destructive')}>
                    {item.produto.codigoOrigem ?? '—'}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Sem produto vinculado — resolva na aba Cadastro.
            </p>
          )}

          <div className="space-y-1 pt-1">
            <p className="text-xs font-medium text-foreground/80">CFOP de entrada</p>
            {!trocandoCfop ? (
              <div className="flex flex-wrap items-center gap-2">
                {item.cfopEntrada ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-600/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    {item.cfopEntrada.codigo} — {item.cfopEntrada.nome}
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
                    onClick={() => setTrocandoCfop(true)}
                  >
                    Trocar
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                  defaultValue={item.cfopEntrada?.id ?? ''}
                  disabled={acao}
                  onChange={async (e) => {
                    const cfopId = e.target.value
                    if (!cfopId) return
                    await onDefinirCfopEntrada(cfopId)
                    setTrocandoCfop(false)
                  }}
                >
                  <option value="">Selecione…</option>
                  {cfopsEntrada.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} — {c.descricao}
                    </option>
                  ))}
                </select>
                <Button type="button" size="sm" variant="ghost" onClick={() => setTrocandoCfop(false)}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>

          {item.criticaFiscal && (
            <p className="text-xs text-destructive">
              Crítica fiscal — CST/CFOP ausente ou divergência de NCM/origem
            </p>
          )}

          {!finalizada && item.produtoId && precisaImportar && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={acao}
              onClick={onImportarFiscal}
            >
              Importar NCM/origem da NF
            </Button>
          )}
        </section>
      </div>
    </article>
  )
}
