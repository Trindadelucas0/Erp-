'use client'

import { useState, type ReactNode } from 'react'
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

type LinhaEspelhoProps = {
  rotulo: string
  valor: ReactNode
  valorClassName?: string
}

function LinhaEspelho({ rotulo, valor, valorClassName }: LinhaEspelhoProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
      <dt className="font-medium text-foreground/80">{rotulo}</dt>
      <dd className={cn('font-mono', valorClassName)}>{valor}</dd>
    </div>
  )
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

  const estiloSistema = vinculado
    ? 'border-l-4 border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
    : 'border-l-4 border-l-muted-foreground/30'

  function cabecalhoNf() {
    return (
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground">NF</p>
        <p className="font-medium">
          #{item.nItem} {item.descricao ?? '—'}
        </p>
      </div>
    )
  }

  function cabecalhoSistema() {
    return (
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground">SISTEMA</p>
        {item.produto ? (
          <p className="font-medium">{item.produto.nomeVenda}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sem produto vinculado — resolva na aba Cadastro.
          </p>
        )}
      </div>
    )
  }

  function campoNcmNf() {
    return <LinhaEspelho rotulo="NCM" valor={item.ncm ?? '—'} />
  }

  function campoNcmSistema() {
    if (!item.produto) return null
    return (
      <LinhaEspelho
        rotulo="NCM cadastro"
        valor={item.produto.ncm ?? '—'}
        valorClassName={cn(ncmDivergente && 'font-semibold text-destructive')}
      />
    )
  }

  function campoOrigemNf() {
    return <LinhaEspelho rotulo="Origem" valor={item.origem ?? '—'} />
  }

  function campoOrigemSistema() {
    if (!item.produto) return null
    return (
      <LinhaEspelho
        rotulo="Origem cadastro"
        valor={item.produto.codigoOrigem ?? '—'}
        valorClassName={cn(origDivergente && 'font-semibold text-destructive')}
      />
    )
  }

  function campoCstNf() {
    return <LinhaEspelho rotulo="CST/CSOSN" valor={item.cst ?? '—'} />
  }

  function campoCfopNf() {
    return <LinhaEspelho rotulo="CFOP" valor={item.cfop ?? '—'} />
  }

  function campoCfopEntradaSistema() {
    return (
      <div className="space-y-1 text-xs text-muted-foreground">
        <p className="font-medium text-foreground/80">CFOP de entrada</p>
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
              className="h-8 max-w-full rounded-md border bg-background px-2 text-xs"
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
    )
  }

  function rodapeSistema() {
    return (
      <div className="space-y-2">
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
      </div>
    )
  }

  return (
    <article className="overflow-hidden rounded-md border text-sm">
      {/* Mobile: NF completo, depois SISTEMA. */}
      <div className="sm:hidden">
        <section
          className="min-w-0 space-y-2 border-b bg-muted/40 p-3"
          aria-label="Dados fiscais da nota fiscal"
        >
          {cabecalhoNf()}
          <dl className="grid gap-1">
            {campoNcmNf()}
            {campoOrigemNf()}
            {campoCstNf()}
            {campoCfopNf()}
          </dl>
        </section>
        <section
          className={cn('min-w-0 space-y-2 p-3', estiloSistema)}
          aria-label="Dados fiscais do sistema"
        >
          {cabecalhoSistema()}
          <dl className="grid gap-1">
            {campoNcmSistema()}
            {campoOrigemSistema()}
          </dl>
          {campoCfopEntradaSistema()}
          {rodapeSistema()}
        </section>
      </div>

      {/* Desktop: linhas pareadas — NCM/origem/CST/CFOP cara a cara. */}
      <div className="hidden sm:grid sm:grid-cols-2 sm:grid-rows-[auto_auto_auto_auto_auto]">
        <section
          className="min-w-0 bg-muted/40 p-3 sm:row-span-5 sm:grid sm:grid-rows-subgrid sm:gap-y-1 sm:border-r"
          aria-label="Dados fiscais da nota fiscal"
        >
          {cabecalhoNf()}
          <div>{campoNcmNf()}</div>
          <div>{campoOrigemNf()}</div>
          <div>{campoCstNf()}</div>
          <div>{campoCfopNf()}</div>
        </section>
        <section
          className={cn(
            'min-w-0 p-3 sm:row-span-5 sm:grid sm:grid-rows-subgrid sm:gap-y-1',
            estiloSistema
          )}
          aria-label="Dados fiscais do sistema"
        >
          {cabecalhoSistema()}
          <div>{campoNcmSistema()}</div>
          <div>{campoOrigemSistema()}</div>
          <div aria-hidden className="min-h-0" />
          <div>{campoCfopEntradaSistema()}</div>
        </section>
      </div>
      <div className="hidden sm:grid sm:grid-cols-2">
        <div className="bg-muted/40 sm:border-r" aria-hidden />
        <div className={cn('p-3 pt-1', estiloSistema)}>{rodapeSistema()}</div>
      </div>
    </article>
  )
}
