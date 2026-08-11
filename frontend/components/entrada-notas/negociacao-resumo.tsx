'use client'

import { useState, type ReactNode } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  PackageMinus,
  PackageX,
  Scale,
  Tag,
} from 'lucide-react'
import { BadgeStatus } from '@/components/ui/badge-status'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type CategoriaAchadoNegociacao =
  | 'fora_pedido'
  | 'fora_nota'
  | 'quantidade'
  | 'preco'
  | 'prazo'
  | 'pedido'

export type AchadoNegociacao = {
  categoria: CategoriaAchadoNegociacao
  severidade: 'bloqueio' | 'aviso'
  mensagem: string
  produto?: string
  valorNf?: number
  valorPedido?: number
  numeroPedido?: number
}

export type ResultadoEtapaNegociacao = {
  status: string
  avisos: string[]
  bloqueios: string[]
  bloqueiosNaoLiberaveis?: string[]
  detalhes?: {
    achados?: AchadoNegociacao[]
    pedidoCompraId?: string
    numero?: number
    classificacao?: string
    [key: string]: unknown
  }
}

const ORDEM_CATEGORIAS: CategoriaAchadoNegociacao[] = [
  'fora_pedido',
  'fora_nota',
  'quantidade',
  'preco',
  'prazo',
  'pedido',
]

const META_CATEGORIA: Record<
  CategoriaAchadoNegociacao,
  { rotulo: string; dica: string; Icon: typeof PackageX }
> = {
  fora_pedido: {
    rotulo: 'Fora do pedido',
    dica: 'Itens da NF sem correspondente no pedido selecionado. Troque o pedido ou libere críticas com senha.',
    Icon: PackageX,
  },
  fora_nota: {
    rotulo: 'Fora da nota fiscal',
    dica: 'Itens do pedido sem correspondente na NF. Confira se o pedido está correto — entrega parcial é comum.',
    Icon: PackageMinus,
  },
  quantidade: {
    rotulo: 'Quantidade',
    dica: 'Quantidade da NF diferente do pedido. Acima bloqueia; abaixo só avisa.',
    Icon: Scale,
  },
  preco: {
    rotulo: 'Preço',
    dica: 'Preço unitário da NF diferente do pedido. Acima bloqueia; abaixo só avisa.',
    Icon: Tag,
  },
  prazo: {
    rotulo: 'Prazo',
    dica: 'Informe o prazo no card Pedido e prazo ou libere críticas.',
    Icon: ClipboardList,
  },
  pedido: {
    rotulo: 'Pedido',
    dica: 'Selecione um pedido de compra aberto no card abaixo.',
    Icon: ClipboardList,
  },
}

const LIMITE_LISTA = 8

function formatarNumero(n: number, casas = 4): string {
  if (!Number.isFinite(n)) return String(n)
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas,
  })
}

function varianteStatus(status: string): 'reprovado' | 'pendente' | 'sucesso' | 'info' {
  if (status === 'bloqueante') return 'reprovado'
  if (status === 'aviso' || status === 'pendente') return 'pendente'
  if (status === 'ok') return 'sucesso'
  return 'info'
}

function rotuloStatus(status: string): string {
  const mapa: Record<string, string> = {
    bloqueante: 'Bloqueante',
    aviso: 'Com avisos',
    ok: 'Ok',
    pendente: 'Pendente',
  }
  return mapa[status] ?? status
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'ok') return <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
  if (status === 'bloqueante') return <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden />
  return <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden />
}

function EtapaResumoFlat({ etapa }: { etapa: ResultadoEtapaNegociacao }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusIcon status={etapa.status} />
        <BadgeStatus variante={varianteStatus(etapa.status)}>{rotuloStatus(etapa.status)}</BadgeStatus>
      </div>
      {etapa.bloqueios?.map((b) => (
        <p key={b} className="text-destructive">
          {b}
        </p>
      ))}
      {etapa.bloqueiosNaoLiberaveis?.map((b) => (
        <p key={b} className="text-destructive">
          {b}
        </p>
      ))}
      {etapa.avisos?.map((a) => (
        <p key={a} className="text-muted-foreground">
          {a}
        </p>
      ))}
    </div>
  )
}

function ComparacaoValores({
  valorNf,
  valorPedido,
  severidade,
}: {
  valorNf: number
  valorPedido: number
  severidade: 'bloqueio' | 'aviso'
}) {
  const delta = valorNf - valorPedido
  const deltaTxt =
    delta === 0
      ? 'igual'
      : `${delta > 0 ? '+' : ''}${formatarNumero(delta)}`
  return (
    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs tabular-nums">
      <span>
        <span className="text-muted-foreground">NF </span>
        <span className="font-medium text-foreground">{formatarNumero(valorNf)}</span>
      </span>
      <span className="text-muted-foreground" aria-hidden>
        ×
      </span>
      <span>
        <span className="text-muted-foreground">Pedido </span>
        <span className="font-medium text-foreground">{formatarNumero(valorPedido)}</span>
      </span>
      <span
        className={cn(
          'font-medium',
          severidade === 'bloqueio' ? 'text-destructive' : 'text-amber-700'
        )}
      >
        ({deltaTxt})
      </span>
    </div>
  )
}

function ListaComLimite({
  total,
  expandido,
  onToggle,
  children,
}: {
  total: number
  expandido: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      {children}
      {total > LIMITE_LISTA && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={onToggle}
        >
          {expandido ? (
            <>
              <ChevronUp className="size-3.5" aria-hidden />
              Mostrar menos
            </>
          ) : (
            <>
              <ChevronDown className="size-3.5" aria-hidden />
              Ver todos ({total})
            </>
          )}
        </Button>
      )}
    </div>
  )
}

function ConteudoCategoria({
  categoria,
  itens,
}: {
  categoria: CategoriaAchadoNegociacao
  itens: AchadoNegociacao[]
}) {
  const [expandido, setExpandido] = useState(false)
  const visiveis = expandido ? itens : itens.slice(0, LIMITE_LISTA)
  const temBloqueio = itens.some((a) => a.severidade === 'bloqueio')

  if (categoria === 'fora_pedido' || categoria === 'fora_nota') {
    const numeroPedido =
      itens.find((a) => a.numeroPedido != null)?.numeroPedido ??
      (() => {
        const m = itens[0]?.mensagem?.match(/pedido\s*#(\d+)/i)
        return m ? Number(m[1]) : null
      })()
    const resumo =
      categoria === 'fora_pedido' ? (
        <>
          {itens.length === 1
            ? '1 item da NF não está no'
            : `${itens.length} itens da NF não estão no`}{' '}
          {numeroPedido != null ? (
            <span className="font-medium">pedido #{numeroPedido}</span>
          ) : (
            <span className="font-medium">pedido selecionado</span>
          )}
          .
        </>
      ) : (
        <>
          {itens.length === 1
            ? '1 item do'
            : `${itens.length} itens do`}{' '}
          {numeroPedido != null ? (
            <span className="font-medium">pedido #{numeroPedido}</span>
          ) : (
            <span className="font-medium">pedido selecionado</span>
          )}{' '}
          {itens.length === 1 ? 'não está na NF' : 'não estão na NF'}.
        </>
      )

    return (
      <ListaComLimite
        total={itens.length}
        expandido={expandido}
        onToggle={() => setExpandido((v) => !v)}
      >
        <p className="text-sm text-foreground">{resumo}</p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {visiveis.map((a, i) => (
            <li
              key={`${a.produto ?? a.mensagem}-${i}`}
              className={cn(
                'rounded-md border px-2.5 py-1.5 text-sm',
                temBloqueio
                  ? 'border-destructive/20 bg-destructive/5 text-destructive'
                  : 'border-amber-500/25 bg-amber-500/5 text-amber-800'
              )}
            >
              <span className="line-clamp-2">{a.produto ?? a.mensagem}</span>
            </li>
          ))}
        </ul>
      </ListaComLimite>
    )
  }

  if (categoria === 'quantidade' || categoria === 'preco') {
    return (
      <ListaComLimite
        total={itens.length}
        expandido={expandido}
        onToggle={() => setExpandido((v) => !v)}
      >
        <ul className="space-y-2">
          {visiveis.map((a, i) => {
            const temComparacao =
              typeof a.valorNf === 'number' && typeof a.valorPedido === 'number'
            return (
              <li
                key={`${a.produto ?? a.mensagem}-${i}`}
                className={cn(
                  'rounded-md border px-3 py-2',
                  a.severidade === 'bloqueio'
                    ? 'border-destructive/25 bg-destructive/5'
                    : 'border-amber-500/25 bg-amber-500/5'
                )}
              >
                <p
                  className={cn(
                    'text-sm font-medium leading-snug',
                    a.severidade === 'bloqueio' ? 'text-destructive' : 'text-amber-800'
                  )}
                >
                  {a.produto ?? a.mensagem}
                </p>
                {temComparacao ? (
                  <ComparacaoValores
                    valorNf={a.valorNf!}
                    valorPedido={a.valorPedido!}
                    severidade={a.severidade}
                  />
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">{a.mensagem}</p>
                )}
              </li>
            )
          })}
        </ul>
      </ListaComLimite>
    )
  }

  return (
    <ListaComLimite
      total={itens.length}
      expandido={expandido}
      onToggle={() => setExpandido((v) => !v)}
    >
      <ul className="space-y-1.5">
        {visiveis.map((a, i) => (
          <li
            key={`${a.mensagem}-${i}`}
            className={cn(
              'rounded-md border px-3 py-2 text-sm',
              a.severidade === 'bloqueio'
                ? 'border-destructive/25 bg-destructive/5 text-destructive'
                : 'border-amber-500/25 bg-amber-500/5 text-amber-800'
            )}
          >
            {a.mensagem}
          </li>
        ))}
      </ul>
    </ListaComLimite>
  )
}

type Props = {
  etapa?: ResultadoEtapaNegociacao | null
}

export function NegociacaoResumo({ etapa }: Props) {
  if (!etapa) return <p className="text-sm text-muted-foreground">Pendente</p>

  const achadosBrutos = etapa.detalhes?.achados
  const achados = Array.isArray(achadosBrutos) ? achadosBrutos : null
  if (!achados || achados.length === 0) {
    return <EtapaResumoFlat etapa={etapa} />
  }

  const porCategoria = ORDEM_CATEGORIAS.map((categoria) => ({
    categoria,
    itens: achados.filter((a) => a.categoria === categoria),
  })).filter((g) => g.itens.length > 0)

  const qtdBloqueios = achados.filter((a) => a.severidade === 'bloqueio').length
  const qtdAvisos = achados.filter((a) => a.severidade === 'aviso').length
  const numeroPedido = etapa.detalhes?.numero

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusIcon status={etapa.status} />
        <BadgeStatus variante={varianteStatus(etapa.status)}>
          {rotuloStatus(etapa.status)}
        </BadgeStatus>
        {numeroPedido != null && (
          <span className="text-xs text-muted-foreground">Pedido #{numeroPedido}</span>
        )}
        {(qtdBloqueios > 0 || qtdAvisos > 0) && (
          <span className="text-xs text-muted-foreground">
            {qtdBloqueios > 0 && (
              <span className="text-destructive">{qtdBloqueios} bloqueio{qtdBloqueios === 1 ? '' : 's'}</span>
            )}
            {qtdBloqueios > 0 && qtdAvisos > 0 && ' · '}
            {qtdAvisos > 0 && (
              <span className="text-amber-700">{qtdAvisos} aviso{qtdAvisos === 1 ? '' : 's'}</span>
            )}
          </span>
        )}
      </div>

      {etapa.status === 'bloqueante' && (
        <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          Resolva as divergências abaixo, troque o pedido no card <strong>Pedido e prazo</strong> ou
          use <strong>Liberar críticas</strong> com senha de gerente.
        </p>
      )}

      {etapa.status === 'ok' && (
        <p className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-800">
          NF alinhada ao pedido — pode avançar para Lançamento.
        </p>
      )}

      <div className="space-y-3">
        {porCategoria.map(({ categoria, itens }) => {
          const meta = META_CATEGORIA[categoria]
          if (!meta) return null
          const Icon = meta.Icon
          const temBloqueio = itens.some((a) => a.severidade === 'bloqueio')
          return (
            <section
              key={categoria}
              className={cn(
                'rounded-lg border p-3',
                temBloqueio ? 'border-destructive/25' : 'border-amber-500/25'
              )}
              aria-label={meta.rotulo}
            >
              <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <Icon
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      temBloqueio ? 'text-destructive' : 'text-amber-600'
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{meta.rotulo}</p>
                    <p className="text-xs text-muted-foreground">{meta.dica}</p>
                  </div>
                </div>
                <BadgeStatus variante={temBloqueio ? 'reprovado' : 'pendente'}>
                  {itens.length}
                </BadgeStatus>
              </header>
              <ConteudoCategoria categoria={categoria} itens={itens} />
            </section>
          )
        })}
      </div>
    </div>
  )
}
