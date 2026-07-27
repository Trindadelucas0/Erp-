'use client'

import { Button } from '@/components/ui/button'

export type ItemVinculoCadastro = {
  id: string
  nItem: number
  descricao: string | null
  gtin: string | null
  codigoProduto: string | null
  ncm: string | null
  quantidade: number | null
  valorUnitario: number | null
  produtoId: string | null
  vinculoModo: string | null
  criticaCadastro: boolean
  produto: {
    id: string
    nomeVenda: string
    sku: string | null
    ncm: string | null
  } | null
}

export type ProdutoBuscaVinculo = {
  id: string
  nomeVenda: string
  sku?: string | null
  codigoBarras?: string | null
}

function normalizarNcm(valor?: string | null): string {
  return (valor ?? '').replace(/\D/g, '').trim()
}

export function itemPrecisaImportarNcm(item: ItemVinculoCadastro): boolean {
  if (!item.produtoId || !item.produto) return false
  const ncmNf = normalizarNcm(item.ncm)
  if (!ncmNf) return false
  const ncmProd = normalizarNcm(item.produto.ncm)
  return ncmNf !== ncmProd
}

function rotuloVinculoModo(modo: string | null): string {
  if (modo === 'barras') return 'código de barras'
  if (modo === 'codigo_original') return 'código original'
  if (modo === 'manual') return 'manual'
  return modo ?? 'vinculado'
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
  onImportarNcm: () => void
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
  onImportarNcm,
  onDesvincular,
  onGravarCodigoOriginal,
  codigoOriginalGravado = false,
}: Props) {
  const precisaNcm = itemPrecisaImportarNcm(item)
  const vinculado = Boolean(item.produtoId)

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
          <dl className="grid gap-1 text-xs text-muted-foreground">
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-foreground/80">Código de barras</dt>
              <dd className="font-mono">{item.gtin ?? '—'}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-foreground/80">NCM</dt>
              <dd className="font-mono">{item.ncm ?? '—'}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-foreground/80">Código original</dt>
              <dd className="font-mono">{item.codigoProduto ?? '—'}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-foreground/80">Qtd × unit.</dt>
              <dd>
                {item.quantidade ?? '—'} ×{' '}
                {item.valorUnitario != null
                  ? item.valorUnitario.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  : '—'}
              </dd>
            </div>
          </dl>
        </section>

        <section
          className={
            vinculado
              ? 'min-w-0 space-y-2 border-l-4 border-l-emerald-500 bg-emerald-50 p-3 dark:bg-emerald-950/30'
              : 'min-w-0 space-y-2 border-l-4 border-l-destructive bg-destructive/10 p-3'
          }
          aria-label="Produto do sistema"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">SISTEMA</p>
            <span
              className={
                vinculado
                  ? 'rounded-full bg-emerald-600/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300'
                  : 'rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive'
              }
            >
              {vinculado ? 'Vinculado' : 'Sem vínculo'}
            </span>
          </div>
          {item.produto ? (
            <>
              <p className="font-medium">
                {item.produto.nomeVenda}
                {item.produto.sku ? (
                  <span className="ml-1 font-mono text-xs text-muted-foreground">
                    ({item.produto.sku})
                  </span>
                ) : null}
              </p>
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Vínculo: {rotuloVinculoModo(item.vinculoModo)}
              </p>
              <p className="text-xs text-muted-foreground">
                NCM cadastro:{' '}
                <span className="font-mono">{item.produto.ncm ?? '—'}</span>
              </p>
            </>
          ) : (
            <p className="font-medium text-destructive">Sem vínculo</p>
          )}
          {item.criticaCadastro && (
            <p className="text-xs text-destructive">Crítica de cadastro — concilie o produto</p>
          )}

          {!finalizada && (
            <div className="flex flex-wrap gap-2 pt-1">
              {!item.produtoId && (
                <Button type="button" size="sm" disabled={acao} onClick={onAbrirBusca}>
                  Conciliar produto
                </Button>
              )}
              {item.produtoId && (
                <>
                  <Button type="button" size="sm" variant="outline" disabled={acao} onClick={onAbrirBusca}>
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
              {item.produtoId && precisaNcm && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={acao}
                  onClick={onImportarNcm}
                >
                  Importar NCM
                </Button>
              )}
              {item.produtoId && item.codigoProduto && onGravarCodigoOriginal && (
                codigoOriginalGravado ? (
                  <span className="inline-flex h-8 items-center rounded-md bg-emerald-600/15 px-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Cód. original gravado
                  </span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={acao}
                    onClick={() => void onGravarCodigoOriginal()}
                  >
                    Gravar cód. original
                  </Button>
                )
              )}
            </div>
          )}

          {buscando && (
            <div className="mt-2 space-y-2 rounded-md border border-dashed p-3">
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
                    <span className="min-w-0 flex-1 truncate text-left">
                      {p.nomeVenda} {p.sku ? `(${p.sku})` : ''}
                    </span>
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
