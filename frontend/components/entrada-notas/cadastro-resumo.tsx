'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Link2Off, PackageSearch, Building2, FileWarning } from 'lucide-react'
import { BadgeStatus } from '@/components/ui/badge-status'
import { Button } from '@/components/ui/button'
import {
  EtapaResumo,
  StatusIconEtapa,
  rotuloStatusEtapa,
  varianteStatusEtapa,
  type ResultadoEtapaUi,
} from '@/components/entrada-notas/etapa-resumo'
import { cn } from '@/lib/utils'

export type CategoriaAchadoCadastro =
  | 'fornecedor'
  | 'item_sem_produto'
  | 'item_desvinculado'
  | 'sem_itens'
  | 'documental'

export type AchadoCadastro = {
  categoria: CategoriaAchadoCadastro
  severidade: 'bloqueio' | 'aviso'
  mensagem: string
  itemId?: string
  nItem?: number | null
  descricao?: string | null
  gtin?: string | null
  codigoProduto?: string | null
}

type ItemNotaRef = {
  id: string
  nItem: number
  descricao: string | null
  gtin: string | null
  codigoProduto: string | null
}

const LIMITE_LISTA = 8

function valorOuTraco(v: string | null | undefined): string {
  const t = (v ?? '').trim()
  if (!t || t === '—') return '—'
  return t
}

/** Fallback para análise antiga sem `detalhes.achados`. */
function achadosDeBloqueios(etapa: ResultadoEtapaUi): AchadoCadastro[] {
  const achados: AchadoCadastro[] = []
  for (const raw of etapa.bloqueios ?? []) {
    const b = typeof raw === 'string' ? raw : ''
    if (!b) continue
    const sem = b.match(
      /Item da NF sem produto correspondente no cadastro \(barras:\s*([^/]*?)\s*\/\s*código original:\s*([^)]*)\)/i
    )
    if (sem) {
      achados.push({
        categoria: 'item_sem_produto',
        severidade: 'bloqueio',
        mensagem: b,
        gtin: sem[1]?.trim() || null,
        codigoProduto: sem[2]?.trim() || null,
      })
      continue
    }
    const des = b.match(
      /Item desvinculado manualmente \(GTIN:\s*([^/]*?)\s*\/\s*cProd:\s*([^)]*)\)/i
    )
    if (des) {
      achados.push({
        categoria: 'item_desvinculado',
        severidade: 'bloqueio',
        mensagem: b,
        gtin: des[1]?.trim() || null,
        codigoProduto: des[2]?.trim() || null,
      })
      continue
    }
    if (/fornecedor|emitente/i.test(b)) {
      achados.push({ categoria: 'fornecedor', severidade: 'bloqueio', mensagem: b })
      continue
    }
    if (/sem itens parseados/i.test(b)) {
      achados.push({ categoria: 'sem_itens', severidade: 'bloqueio', mensagem: b })
      continue
    }
    achados.push({ categoria: 'item_sem_produto', severidade: 'bloqueio', mensagem: b })
  }
  for (const raw of etapa.avisos ?? []) {
    const a = typeof raw === 'string' ? raw : ''
    if (!a) continue
    achados.push({
      categoria: /documental/i.test(a) ? 'documental' : 'documental',
      severidade: 'aviso',
      mensagem: a,
    })
  }
  return achados
}

function enriquecerComItens(
  achados: AchadoCadastro[],
  itens?: ItemNotaRef[]
): AchadoCadastro[] {
  if (!itens?.length) return achados
  return achados.map((a) => {
    if (a.nItem != null || a.descricao) return a
    const porId = a.itemId ? itens.find((i) => i.id === a.itemId) : undefined
    if (porId) {
      return {
        ...a,
        nItem: a.nItem ?? porId.nItem,
        descricao: a.descricao ?? porId.descricao,
        gtin: a.gtin ?? porId.gtin,
        codigoProduto: a.codigoProduto ?? porId.codigoProduto,
      }
    }
    const gtin = valorOuTraco(a.gtin)
    const cod = valorOuTraco(a.codigoProduto)
    const porCodigo = itens.find((i) => {
      const ig = valorOuTraco(i.gtin)
      const ic = valorOuTraco(i.codigoProduto)
      return (
        (gtin !== '—' && ig === gtin) ||
        (cod !== '—' && ic === cod)
      )
    })
    if (!porCodigo) return a
    return {
      ...a,
      nItem: a.nItem ?? porCodigo.nItem,
      descricao: a.descricao ?? porCodigo.descricao,
      itemId: a.itemId ?? porCodigo.id,
    }
  })
}

function tituloItem(a: AchadoCadastro): string {
  const num = a.nItem != null ? `#${a.nItem}` : null
  const nome = (a.descricao ?? '').trim()
  if (num && nome) return `${num} · ${nome}`
  if (num) return num
  if (nome) return nome
  return 'Item sem vínculo'
}

type Props = {
  etapa?: ResultadoEtapaUi | null
  itens?: ItemNotaRef[]
}

export function CadastroResumo({ etapa, itens }: Props) {
  const [expandido, setExpandido] = useState(false)

  if (!etapa) return <p className="text-sm text-muted-foreground">Pendente</p>

  const crusBrutos = etapa.detalhes?.achados
  const crus =
    Array.isArray(crusBrutos) && crusBrutos.length > 0
      ? (crusBrutos as AchadoCadastro[])
      : achadosDeBloqueios(etapa)

  const achados = enriquecerComItens(crus, itens)
  if (achados.length === 0) {
    return <EtapaResumo etapa={etapa} />
  }

  const itensPendentes = achados.filter(
    (a) => a.categoria === 'item_sem_produto' || a.categoria === 'item_desvinculado'
  )
  const outros = achados.filter(
    (a) => a.categoria !== 'item_sem_produto' && a.categoria !== 'item_desvinculado'
  )

  const qtdBloqueios = achados.filter((a) => a.severidade === 'bloqueio').length
  const qtdAvisos = achados.filter((a) => a.severidade === 'aviso').length
  const visiveis = expandido ? itensPendentes : itensPendentes.slice(0, LIMITE_LISTA)

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusIconEtapa status={etapa.status} />
        <BadgeStatus variante={varianteStatusEtapa(etapa.status)}>
          {rotuloStatusEtapa(etapa.status)}
        </BadgeStatus>
        {(qtdBloqueios > 0 || qtdAvisos > 0) && (
          <span className="text-xs text-muted-foreground">
            {qtdBloqueios > 0 && (
              <span className="text-destructive">
                {qtdBloqueios} bloqueio{qtdBloqueios === 1 ? '' : 's'}
              </span>
            )}
            {qtdBloqueios > 0 && qtdAvisos > 0 && ' · '}
            {qtdAvisos > 0 && (
              <span className="text-amber-700 dark:text-amber-400">
                {qtdAvisos} aviso{qtdAvisos === 1 ? '' : 's'}
              </span>
            )}
          </span>
        )}
      </div>

      {etapa.status === 'bloqueante' && itensPendentes.length > 0 && (
        <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive">
          Use <strong>Conciliar produto</strong> no grid abaixo ou cadastre barras / código
          original no vínculo produto×fornecedor. Depois clique em <strong>Reanalisar</strong>.
        </p>
      )}

      {etapa.status === 'ok' && (
        <p className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
          Fornecedor e itens vinculados — pode avançar.
        </p>
      )}

      {outros.map((a, i) => {
        const Icon =
          a.categoria === 'fornecedor'
            ? Building2
            : a.categoria === 'sem_itens'
              ? FileWarning
              : PackageSearch
        return (
          <div
            key={`${a.categoria}-${i}`}
            className={cn(
              'flex gap-2 rounded-lg border px-3 py-2.5',
              a.severidade === 'bloqueio'
                ? 'border-destructive/25 bg-destructive/5'
                : 'border-amber-500/25 bg-amber-500/5'
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 size-4 shrink-0',
                a.severidade === 'bloqueio' ? 'text-destructive' : 'text-amber-600'
              )}
              aria-hidden
            />
            <p
              className={cn(
                'leading-snug',
                a.severidade === 'bloqueio'
                  ? 'text-foreground'
                  : 'text-amber-900 dark:text-amber-200'
              )}
            >
              {a.mensagem}
            </p>
          </div>
        )
      })}

      {itensPendentes.length > 0 && (
        <section
          className="rounded-lg border border-destructive/25 p-3"
          aria-label="Itens sem vínculo"
        >
          <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <Link2Off className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <div className="min-w-0">
                <p className="font-semibold text-foreground">
                  {itensPendentes.length === 1
                    ? '1 item sem produto no cadastro'
                    : `${itensPendentes.length} itens sem produto no cadastro`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cada linha abaixo precisa de Conciliar produto no grid.
                </p>
              </div>
            </div>
            <BadgeStatus variante="reprovado">{itensPendentes.length}</BadgeStatus>
          </header>

          <ul className="grid gap-2 sm:grid-cols-2">
            {visiveis.map((a, i) => (
              <li
                key={a.itemId ?? `${a.gtin}-${a.codigoProduto}-${i}`}
                className="rounded-md border border-border/80 bg-muted/30 px-3 py-2"
              >
                <p className="line-clamp-2 text-sm font-medium text-foreground">
                  {tituloItem(a)}
                </p>
                <dl className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                  <div className="flex gap-1.5">
                    <dt className="shrink-0">Barras</dt>
                    <dd className="min-w-0 break-all font-mono text-foreground/90">
                      {valorOuTraco(a.gtin)}
                    </dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="shrink-0">Cód. orig.</dt>
                    <dd className="min-w-0 break-all font-mono text-foreground/90">
                      {valorOuTraco(a.codigoProduto)}
                    </dd>
                  </div>
                  {a.categoria === 'item_desvinculado' && (
                    <dd className="pt-0.5 text-amber-700 dark:text-amber-400">
                      Desvinculado manualmente
                    </dd>
                  )}
                </dl>
              </li>
            ))}
          </ul>

          {itensPendentes.length > LIMITE_LISTA && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2 text-xs text-muted-foreground"
              onClick={() => setExpandido((v) => !v)}
            >
              {expandido ? (
                <>
                  <ChevronUp className="size-3.5" aria-hidden />
                  Mostrar menos
                </>
              ) : (
                <>
                  <ChevronDown className="size-3.5" aria-hidden />
                  Ver todos ({itensPendentes.length})
                </>
              )}
            </Button>
          )}
        </section>
      )}
    </div>
  )
}
