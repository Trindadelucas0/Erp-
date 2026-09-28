'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import { BadgeStatusRequisicao } from '@/components/requisicoes-wms/badges-requisicao'
import {
  formatarNumeroRequisicao,
  podeConcluirExecucao,
  type RequisicaoWms,
  type StatusRequisicao,
} from '@/lib/requisicoes-wms'
import { cn } from '@/lib/utils'

type FiltroItens = 'todos' | 'pendentes' | 'separados'

type Props = {
  item: RequisicaoWms
  usuarioId: string
  podeEditar: boolean
  ocupado: string | null
  erro: string
  confirmado: boolean
  onBipar: (valor: string) => Promise<void>
  onIniciar: () => void
  onPausar: () => void
  onRetomar: () => void
  onConcluir: () => void
  onCancelar: (motivo: string) => void
}

const PASSOS = ['Requisição aberta', 'Separação em andamento', 'Finalizada'] as const

function indicePasso(status: StatusRequisicao) {
  if (status === 'em_execucao' || status === 'pausada') return 1
  if (status === 'concluida') return 2
  return 0
}

function formatarQuando(iso: string) {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return '—'
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatarQtd(valor: number | null | undefined) {
  if (valor == null) return '—'
  return Number.isInteger(valor) ? String(valor) : String(valor)
}

export function TelaSeparacaoPedido({
  item,
  usuarioId,
  podeEditar,
  ocupado,
  erro,
  confirmado,
  onBipar,
  onIniciar,
  onPausar,
  onRetomar,
  onConcluir,
  onCancelar,
}: Props) {
  const campoBip = useRef<HTMLInputElement>(null)
  const [codigo, setCodigo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [motivoAberto, setMotivoAberto] = useState(false)
  const [filtro, setFiltro] = useState<FiltroItens>('todos')
  const ehResponsavel = item.responsavelId === usuarioId
  const emExecucao = item.status === 'em_execucao'
  const pausada = item.status === 'pausada'
  const pedida = item.quantidade ?? 0
  const separada = item.qtdExecutada ?? 0
  const unidade = item.produtoUnidade ?? 'UN'
  const completo = pedida > 0 && separada >= pedida
  const percentual = pedida > 0 ? Math.min(100, Math.round((separada / pedida) * 100)) : 0
  const podeBipar = ehResponsavel && emExecucao && !completo && ocupado === null
  const passo = indicePasso(item.status)
  const produtoIncorreto = erro.startsWith('PRODUTO INCORRETO')
  const mostraItem =
    filtro === 'todos' || (filtro === 'separados' ? completo : !completo)
  const podeCancelar =
    podeEditar &&
    (item.status === 'pendente' ||
      item.status === 'disponivel' ||
      item.status === 'atribuida' ||
      item.status === 'em_execucao' ||
      item.status === 'pausada')

  useEffect(() => {
    if (podeBipar) campoBip.current?.focus()
  }, [podeBipar, item.qtdExecutada, item.id])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const valor = codigo.trim()
    if (!valor || !podeBipar) return
    setCodigo('')
    await onBipar(valor)
    campoBip.current?.focus()
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button asChild type="button" variant="outline" size="sm">
          <Link href="/separacao">
            <ArrowLeft className="mr-1 size-4" />
            Voltar
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{formatarQuando(item.createdAt)}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 size-4" />
            Imprimir lista
          </Button>
        </div>
      </div>

      <section className="rounded-lg border-2 border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold">
            Requisição {formatarNumeroRequisicao(item.numero)}
          </h1>
          <BadgeStatusRequisicao status={item.status} />
        </div>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Data</dt>
            <dd>{formatarQuando(item.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Itens</dt>
            <dd>1</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Observação</dt>
            <dd>{item.observacao?.trim() || '—'}</dd>
          </div>
        </dl>
      </section>

      <ol className="grid gap-2 sm:grid-cols-3 print:hidden">
        {PASSOS.map((rotulo, indice) => {
          const feito = indice < passo
          const atual = indice === passo
          return (
            <li
              key={rotulo}
              className={cn(
                'rounded-lg border-2 px-3 py-2 text-sm',
                atual ? 'border-primary bg-primary/10 font-medium' : 'border-border',
                feito ? 'text-muted-foreground' : ''
              )}
            >
              <span className="mr-2 inline-grid size-5 place-items-center rounded-full border border-current text-xs">
                {indice + 1}
              </span>
              {rotulo}
            </li>
          )
        })}
      </ol>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="space-y-4 rounded-lg border-2 border-border bg-card p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">Item atual</h2>
            <p className="text-sm text-muted-foreground">
              {formatarQtd(separada)} de {formatarQtd(pedida)} {unidade}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div>
              <p className="text-base font-semibold">{item.produtoNome || 'Produto não informado'}</p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Código original</dt>
                  <dd className="font-medium">{item.produtoSku || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Código de barras</dt>
                  <dd className="font-medium">{item.produtoCodigoBarras || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Quantidade solicitada</dt>
                  <dd className="text-lg font-semibold">
                    {formatarQtd(item.quantidade)} {unidade}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Quantidade separada</dt>
                  <dd className="text-lg font-semibold">
                    {formatarQtd(separada)} {unidade}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Estoque disponível</dt>
                  <dd>
                    {item.qtdDisponivel != null ? `${formatarQtd(item.qtdDisponivel)} ${unidade}` : '—'}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="rounded-lg border-2 border-border px-4 py-3 text-center md:min-w-40">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Endereço de coleta</p>
              <p className="mt-1 font-mono text-2xl font-bold">{item.origemCodigo || '—'}</p>
            </div>
          </div>

          <form className="space-y-3 print:hidden" onSubmit={(e) => void enviar(e)}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <InputPadrao
                  ref={campoBip}
                  rotulo="Bipe o código de barras do produto"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  autoComplete="off"
                  disabled={!podeBipar}
                  className="min-h-12 text-base"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-12"
                disabled={!podeBipar}
                onClick={() => campoBip.current?.focus()}
              >
                Digitar código
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Após a leitura, a quantidade separada sobe 1 {unidade}.
            </p>
          </form>

          {confirmado ? (
            <p className="rounded-lg border-2 border-primary bg-primary/10 px-3 py-2 text-sm font-medium">
              Produto confirmado
            </p>
          ) : null}

          {produtoIncorreto ? (
            <div className="rounded-lg border-2 border-destructive bg-destructive/10 px-3 py-3" role="alert">
              <p className="text-base font-bold">PRODUTO INCORRETO</p>
              <p className="text-sm">Este produto não pertence à requisição.</p>
            </div>
          ) : erro ? (
            <p className="text-sm text-destructive" role="alert">
              {erro}
            </p>
          ) : null}

          {!ehResponsavel && item.status === 'atribuida' ? (
            <div className="text-sm text-muted-foreground print:hidden">
              <p>
                Iniciar só aparece para o responsável ({item.responsavelNome?.trim() || 'desta requisição'}).
                {podeEditar
                  ? ' Troque Atribuir a para o seu usuário, clique Atribuir, e o botão Iniciar aparece.'
                  : ''}
              </p>
              <Link href={`/requisicoes/${item.id}`} className="font-medium text-primary underline">
                Abrir a ficha
              </Link>
            </div>
          ) : !ehResponsavel && (emExecucao || pausada) ? (
            <p className="text-sm text-destructive print:hidden">
              Só o responsável desta requisição pode separar.{' '}
              <Link href={`/requisicoes/${item.id}`} className="underline">
                Abrir a ficha
              </Link>
            </p>
          ) : null}

          {pausada ? (
            <p className="text-sm text-muted-foreground">Pausada. Retome para continuar a bipagem.</p>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-border pt-3 print:hidden sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-sm">
              {podeCancelar ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    aria-expanded={motivoAberto}
                    disabled={ocupado !== null}
                    onClick={() => setMotivoAberto((aberto) => !aberto)}
                  >
                    Cancelar requisição
                  </Button>
                  {motivoAberto ? (
                    <>
                      <InputPadrao
                        rotulo="Motivo do cancelamento"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        disabled={ocupado !== null}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={ocupado !== null || !motivo.trim()}
                        onClick={() => onCancelar(motivo.trim())}
                      >
                        Cancelar requisição
                      </Button>
                    </>
                  ) : null}
                </>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {item.status === 'disponivel' || (item.status === 'atribuida' && ehResponsavel) ? (
                <Button type="button" disabled={ocupado !== null} onClick={onIniciar}>
                  Iniciar
                </Button>
              ) : null}
              {ehResponsavel && emExecucao ? (
                <Button type="button" variant="outline" disabled={ocupado !== null} onClick={onPausar}>
                  Pausar
                </Button>
              ) : null}
              {ehResponsavel && pausada ? (
                <Button type="button" variant="outline" disabled={ocupado !== null} onClick={onRetomar}>
                  Retomar
                </Button>
              ) : null}
              <Button
                type="button"
                disabled={!podeConcluirExecucao(item, usuarioId) || ocupado !== null}
                onClick={onConcluir}
              >
                Concluir separação
              </Button>
            </div>
          </div>
        </section>

        <aside className="space-y-3 rounded-lg border-2 border-border bg-card p-4">
          <div>
            <h2 className="font-semibold">Progresso da separação</h2>
            <p className="text-sm text-muted-foreground">
              {formatarQtd(separada)} de {formatarQtd(pedida)} {unidade}
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${percentual}%` }} />
          </div>
          <p className="text-right text-sm font-medium">{percentual}%</p>
          <div className="flex gap-1 text-xs">
            {(
              [
                ['todos', 'Todos (1)'],
                ['pendentes', completo ? 'Pendentes (0)' : 'Pendentes (1)'],
                ['separados', completo ? 'Separados (1)' : 'Separados (0)'],
              ] as const
            ).map(([chave, rotulo]) => (
              <button
                key={chave}
                type="button"
                className={cn(
                  'rounded-md border px-2 py-1',
                  filtro === chave ? 'border-primary bg-primary/10' : 'border-border'
                )}
                onClick={() => setFiltro(chave)}
              >
                {rotulo}
              </button>
            ))}
          </div>
          {mostraItem ? (
            <div className="rounded-md border border-border p-2 text-sm">
              <p className="font-medium">{item.produtoNome || '—'}</p>
              <p className="text-muted-foreground">{item.produtoSku || '—'}</p>
              <p>
                {formatarQtd(item.quantidade)} {unidade} · {completo ? 'Separado' : 'Pendente'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum item neste filtro.</p>
          )}
        </aside>
      </div>
    </div>
  )
}
