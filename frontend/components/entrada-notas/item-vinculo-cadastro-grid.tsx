'use client'

import { useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ItemVinculoCadastro = {
  id: string
  nItem: number
  descricao: string | null
  gtin: string | null
  codigoProduto: string | null
  unidade?: string | null
  quantidade: number | null
  valorUnitario: number | null
  produtoId: string | null
  vinculoModo: string | null
  criticaCadastro: boolean
  codigoFornecedorVinculo?: string | null
  /** Múltiplo de compra (itens por embalagem) do vínculo produto × fornecedor da nota; 1 quando não configurado */
  itensPorEmbalagem?: number
  /** quantidade (NF) × itensPorEmbalagem — prévia da quantidade em unidade de venda */
  qtdTotalUn?: number | null
  produto: {
    id: string
    nomeVenda: string
    sku: string | null
    codigoBarras?: string | null
    marca?: string | null
    unidade?: string | null
  } | null
}

export type ProdutoBuscaVinculo = {
  id: string
  nomeVenda: string
  sku?: string | null
  codigoBarras?: string | null
  marca?: string | null
}

function rotuloVinculoModo(modo: string | null): string | null {
  if (modo === 'barras') return 'código de barras'
  if (modo === 'codigo_original') return 'código original'
  if (modo === 'manual') return 'manual'
  if (!modo || modo === 'desvinculado') return null
  return modo
}

function normalizarGtin(gtin: string | null | undefined): string | null {
  const limpo = (gtin ?? '').replace(/\D/g, '')
  if (!limpo || /^0+$/.test(limpo)) return null
  return limpo
}

function formatarGtin(gtin: string | null | undefined): string {
  return normalizarGtin(gtin) ?? 'sem GTIN'
}

function formatarCodigoOriginal(valor: string | null | undefined): string {
  const limpo = (valor ?? '').trim()
  return limpo || '—'
}

function formatarValorUnitario(valor: number | null | undefined): string {
  if (valor == null) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarQtdUnit(quantidade: number | null, valorUnitario: number | null): string {
  const qtd = quantidade ?? '—'
  return `${qtd} × ${formatarValorUnitario(valorUnitario)}`
}

function formatarUnidade(valor: string | null | undefined): string {
  const limpo = (valor ?? '').trim()
  return limpo || '—'
}

function rotuloProdutoSistema(produto: NonNullable<ItemVinculoCadastro['produto']>) {
  const extras: string[] = []
  const marca = produto.marca?.trim()
  const unidade = produto.unidade?.trim()
  if (marca) extras.push(marca)
  if (unidade) extras.push(unidade)

  return (
    <>
      {produto.nomeVenda}
      {produto.sku ? (
        <span className="ml-1 font-mono text-xs text-muted-foreground">({produto.sku})</span>
      ) : null}
      {extras.length > 0 ? (
        <span className="ml-1 text-xs text-muted-foreground">· {extras.join(' · ')}</span>
      ) : null}
    </>
  )
}

function rotuloProdutoBusca(produto: ProdutoBuscaVinculo): string {
  const partes: string[] = []
  let nome = produto.nomeVenda
  if (produto.sku) nome += ` (${produto.sku})`
  partes.push(nome)
  const marca = produto.marca?.trim()
  if (marca) partes.push(marca)
  return partes.join(' · ')
}

type LinhaEspelhoProps = {
  rotulo: string
  valor: string
  valorClassName?: string
  acao?: ReactNode
}

function LinhaEspelho({ rotulo, valor, valorClassName, acao }: LinhaEspelhoProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <dt className="font-medium text-foreground/80">{rotulo}</dt>
      <dd className={cn('font-mono', valorClassName)}>
        {valor}
        {acao ? <span className="ml-1.5 inline-flex align-baseline">{acao}</span> : null}
      </dd>
    </div>
  )
}

type Props = {
  item: ItemVinculoCadastro
  finalizada: boolean
  acao: boolean
  buscando: boolean
  buscaProduto: string
  produtos: ProdutoBuscaVinculo[]
  onAbrirBusca: () => void
  onFecharBusca: () => void
  onBuscaChange: (valor: string) => void
  onBuscar: () => void
  onVincular: (produtoId: string) => void | Promise<void>
  onDesvincular: () => void | Promise<void>
  onGravarCodigoOriginal?: () => void | Promise<void>
  /** Após gravar com sucesso nesta sessão da tela */
  codigoOriginalGravado?: boolean
}

export function ItemVinculoCadastroGrid({
  item,
  finalizada,
  acao,
  buscando,
  buscaProduto,
  produtos,
  onAbrirBusca,
  onFecharBusca,
  onBuscaChange,
  onBuscar,
  onVincular,
  onDesvincular,
  onGravarCodigoOriginal,
  codigoOriginalGravado = false,
}: Props) {
  const [gravandoCodigo, setGravandoCodigo] = useState(false)
  const vinculado = Boolean(item.produtoId)
  const itensPorEmbalagem = item.itensPorEmbalagem ?? 1
  const temMultiploCompra = itensPorEmbalagem > 1

  const gtinNf = formatarGtin(item.gtin)
  const gtinSistema = vinculado ? formatarGtin(item.produto?.codigoBarras) : 'sem GTIN'
  const gtinBate =
    vinculado && gtinNf !== 'sem GTIN' && gtinNf === gtinSistema

  const codOrigNf = formatarCodigoOriginal(item.codigoProduto)
  const codOrigSistemaRaw =
    item.codigoFornecedorVinculo?.trim() ||
    (codigoOriginalGravado && item.codigoProduto ? item.codigoProduto.trim() : '')
  const codOrigSistema = vinculado ? formatarCodigoOriginal(codOrigSistemaRaw) : '—'
  const codOrigBate =
    vinculado &&
    codOrigNf !== '—' &&
    codOrigSistema !== '—' &&
    codOrigNf.toLowerCase() === codOrigSistema.toLowerCase()

  const unidadeNf = formatarUnidade(item.unidade)
  const unidadeSistema = vinculado ? formatarUnidade(item.produto?.unidade) : '—'
  const unidadeBate =
    vinculado &&
    unidadeNf !== '—' &&
    unidadeSistema !== '—' &&
    unidadeNf.toLowerCase() === unidadeSistema.toLowerCase()

  const qtdUnitTexto = formatarQtdUnit(item.quantidade, item.valorUnitario)
  const podeGravarOriginal =
    vinculado &&
    !finalizada &&
    Boolean(item.codigoProduto?.trim()) &&
    !codigoOriginalGravado &&
    Boolean(onGravarCodigoOriginal)

  const rotuloVinculo = rotuloVinculoModo(item.vinculoModo)

  const dlEspelho = (
    <dl className="grid gap-1 text-xs text-muted-foreground">
      <LinhaEspelho rotulo="Unidade" valor={unidadeNf} />
      <LinhaEspelho rotulo="Código de barras" valor={gtinNf} />
      <LinhaEspelho rotulo="Código original" valor={codOrigNf} />
      <LinhaEspelho rotulo="Qtd × unit." valor={qtdUnitTexto} valorClassName="font-sans" />
      {temMultiploCompra && (
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium text-foreground/80">Qtd embalagem</dt>
          <dd>
            {itensPorEmbalagem} · Qtd total UN:{' '}
            <span className="font-medium text-foreground">{item.qtdTotalUn ?? '—'}</span>
          </dd>
        </div>
      )}
    </dl>
  )

  return (
    <article className="overflow-hidden rounded-md border text-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <section
          className="min-w-0 space-y-2 border-b bg-muted/40 p-3 sm:border-b-0 sm:border-r"
          aria-label="Produto da nota fiscal"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">NF</p>
          <p className="font-medium">
            #{item.nItem} {item.descricao ?? '—'}
          </p>
          {dlEspelho}
        </section>

        <section
          className={cn(
            'relative flex min-h-full min-w-0 flex-col space-y-2 p-3',
            vinculado
              ? 'border-l-4 border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
              : 'border-l-4 border-l-destructive bg-destructive/10'
          )}
          aria-label="Produto do sistema"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">SISTEMA</p>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-semibold',
                vinculado
                  ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-destructive/15 text-destructive'
              )}
            >
              {vinculado ? 'Vinculado' : 'Sem vínculo'}
            </span>
          </div>

          {item.produto ? (
            <p className="font-medium">{rotuloProdutoSistema(item.produto)}</p>
          ) : (
            <p className="font-medium text-destructive">Sem vínculo</p>
          )}

          <dl className="flex-1 grid gap-1 text-xs text-muted-foreground">
            <LinhaEspelho
              rotulo="Unidade"
              valor={unidadeSistema}
              valorClassName={cn(
                unidadeBate && 'font-semibold text-emerald-700 dark:text-emerald-300'
              )}
            />
            <LinhaEspelho
              rotulo="Código de barras"
              valor={gtinSistema}
              valorClassName={cn(
                gtinBate && 'font-semibold text-emerald-700 dark:text-emerald-300',
                gtinSistema === 'sem GTIN' && 'text-muted-foreground'
              )}
            />
            <LinhaEspelho
              rotulo="Código original"
              valor={codOrigSistema}
              valorClassName={cn(
                codOrigBate && 'font-semibold text-emerald-700 dark:text-emerald-300'
              )}
              acao={
                podeGravarOriginal ? (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs font-normal"
                    disabled={acao || gravandoCodigo}
                    aria-label={gravandoCodigo ? 'Gravando código original' : 'Gravar código original'}
                    onClick={async () => {
                      if (!onGravarCodigoOriginal) return
                      setGravandoCodigo(true)
                      try {
                        await onGravarCodigoOriginal()
                      } finally {
                        setGravandoCodigo(false)
                      }
                    }}
                  >
                    {gravandoCodigo ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      'Gravar'
                    )}
                  </Button>
                ) : undefined
              }
            />
            <LinhaEspelho
              rotulo="Qtd × unit."
              valor={qtdUnitTexto}
              valorClassName="font-sans text-foreground"
            />
            {temMultiploCompra && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-foreground/80">Qtd embalagem</dt>
                <dd>
                  {itensPorEmbalagem} · Qtd total UN:{' '}
                  <span className="font-medium text-foreground">{item.qtdTotalUn ?? '—'}</span>
                </dd>
              </div>
            )}
          </dl>

          {vinculado && rotuloVinculo && (
            <p className="text-right text-[10px] text-muted-foreground/70">
              vínculo: {rotuloVinculo}
            </p>
          )}

          {item.criticaCadastro && (
            <p className="text-xs text-destructive">Crítica de cadastro — concilie o produto</p>
          )}

          {!finalizada && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {!item.produtoId && (
                <Button type="button" size="sm" disabled={acao} onClick={onAbrirBusca}>
                  Conciliar produto
                </Button>
              )}
              {item.produtoId && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={acao}
                    onClick={onAbrirBusca}
                  >
                    Trocar vínculo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={acao}
                    onClick={() => void onDesvincular()}
                  >
                    Desvincular
                  </Button>
                </>
              )}
            </div>
          )}

          {buscando && (
            <div className="mt-1 space-y-2 rounded-md border border-dashed p-3">
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Buscar produto…"
                  aria-label="Buscar produto para conciliar"
                  value={buscaProduto}
                  onChange={(e) => onBuscaChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onBuscar()
                  }}
                />
                <Button type="button" size="sm" onClick={onBuscar}>
                  Buscar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={onFecharBusca}>
                  Fechar
                </Button>
              </div>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {produtos.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1 truncate text-left">{rotuloProdutoBusca(p)}</span>
                    <Button
                      type="button"
                      size="sm"
                      disabled={acao}
                      onClick={() => void onVincular(p.id)}
                    >
                      Conciliar
                    </Button>
                  </li>
                ))}
                {produtos.length === 0 && (
                  <li className="px-2 py-1 text-xs text-muted-foreground">
                    Nenhum produto encontrado. Ajuste o termo e busque de novo.
                  </li>
                )}
              </ul>
            </div>
          )}
        </section>
      </div>
    </article>
  )
}
