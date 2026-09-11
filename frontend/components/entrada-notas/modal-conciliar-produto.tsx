'use client'

import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { CampoBuscaLista } from '@/components/compartilhado/campo-busca-lista'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { TextoDestaqueBusca } from '@/components/ui/texto-destaque-busca'
import { cn } from '@/lib/utils'

export type ProdutoBuscaConciliar = {
  id: string
  nomeVenda: string
  sku?: string | null
  marca?: string | null
  unidade?: string | null
  caracteristicas?: string | null
  nomeCompra?: string | null
}

export type ItemNfConciliar = {
  nItem: number
  descricao: string | null
  gtin: string | null
  codigoProduto: string | null
  unidade?: string | null
  quantidade: number | null
  valorUnitario: number | null
}

type Props = {
  aberto: boolean
  item: ItemNfConciliar | null
  buscaProduto: string
  buscaMarca: string
  produtos: ProdutoBuscaConciliar[]
  carregando: boolean
  acao: boolean
  erroBusca?: string | null
  onBuscaProdutoChange: (valor: string) => void
  onBuscaMarcaChange: (valor: string) => void
  onVincular: (produtoId: string) => void | Promise<void>
  onFechar: () => void
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

const COLUNAS_DESKTOP =
  'sm:grid sm:grid-cols-[4.75rem_minmax(0,1fr)_7.5rem_3.25rem_auto] sm:items-start sm:gap-x-3'

export function ModalConciliarProduto({
  aberto,
  item,
  buscaProduto,
  buscaMarca,
  produtos,
  carregando,
  acao,
  erroBusca,
  onBuscaProdutoChange,
  onBuscaMarcaChange,
  onVincular,
  onFechar,
}: Props) {
  const produtoTrim = buscaProduto.trim()
  const marcaTrim = buscaMarca.trim()
  const temBusca = produtoTrim.length >= 2 || marcaTrim.length >= 2
  const campoProdutoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!aberto) return
    const timer = window.setTimeout(() => campoProdutoRef.current?.focus(), 50)
    return () => window.clearTimeout(timer)
  }, [aberto])

  return (
    <Modal
      aberto={aberto}
      aoFechar={onFechar}
      titulo="Conciliar produto"
      descricao="Palavras-chave; pode preencher um ou os dois campos."
      largura="4xl"
      alturaMinimaConteudo="md"
      manterPosicao
      rodape={
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {item ? (
          <section
            className="rounded-md border bg-muted/40 px-3 py-2.5 text-sm"
            aria-label="Produto da nota fiscal"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Item da NF
            </p>
            <p className="mt-1 break-words font-medium">
              #{item.nItem} {item.descricao ?? '—'}
              {item.unidade?.trim() ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  · {item.unidade.trim()}
                </span>
              ) : null}
            </p>
            <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
              <div>
                <dt className="inline font-medium text-foreground/80">Barras </dt>
                <dd className="inline font-mono">{formatarGtin(item.gtin)}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-foreground/80">Original </dt>
                <dd className="inline font-mono">{formatarCodigoOriginal(item.codigoProduto)}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-foreground/80">Qtd × unit. </dt>
                <dd className="inline font-sans">
                  {formatarQtdUnit(item.quantidade, item.valorUnitario)}
                </dd>
              </div>
            </dl>
          </section>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <CampoBuscaLista
            ref={campoProdutoRef}
            nomeCampo="conciliar-produto-q"
            rotulo="Produto / código"
            value={buscaProduto}
            onChange={(e) => onBuscaProdutoChange(e.target.value)}
            placeholder="Nome, SKU ou barras…"
            className="h-10"
          />
          <CampoBuscaLista
            nomeCampo="conciliar-produto-marca"
            rotulo="Marca"
            value={buscaMarca}
            onChange={(e) => onBuscaMarcaChange(e.target.value)}
            placeholder="Marca do cadastro…"
            className="h-10"
          />
        </div>

        {erroBusca ? (
          <p className="text-sm text-destructive" role="alert">
            {erroBusca}
          </p>
        ) : null}

        <div className="space-y-1">
          {produtos.length > 0 ? (
            <div
              className={cn(
                'hidden border-b border-border px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground',
                COLUNAS_DESKTOP
              )}
            >
              <span>Código</span>
              <span>Nome</span>
              <span>Marca</span>
              <span>Un.</span>
              <span className="sr-only">Ação</span>
            </div>
          ) : null}

          <ul className="space-y-1" aria-busy={carregando} aria-label="Resultados da busca">
            {produtos.map((produto) => {
              const caracteristicas = produto.caracteristicas?.trim() || ''
              const nomeCompra = produto.nomeCompra?.trim() || ''
              const mostrarNomeCompra =
                Boolean(nomeCompra) &&
                nomeCompra.toLocaleLowerCase() !== produto.nomeVenda.toLocaleLowerCase()
              const sku = produto.sku?.trim() || ''
              const marca = produto.marca?.trim() || ''
              const unidade = produto.unidade?.trim() || ''

              return (
                <li
                  key={produto.id}
                  className={cn(
                    'rounded-md px-2 py-2 hover:bg-muted',
                    'flex flex-col gap-2 sm:flex-row sm:items-start',
                    COLUNAS_DESKTOP
                  )}
                >
                  <span className="break-words font-mono text-xs tabular-nums text-muted-foreground">
                    {sku ? (
                      produtoTrim ? (
                        <TextoDestaqueBusca texto={sku} termo={produtoTrim} />
                      ) : (
                        sku
                      )
                    ) : (
                      '—'
                    )}
                  </span>
                  <span className="min-w-0 break-words">
                    {produtoTrim ? (
                      <TextoDestaqueBusca texto={produto.nomeVenda} termo={produtoTrim} />
                    ) : (
                      produto.nomeVenda
                    )}
                    {caracteristicas ? (
                      <span className="mt-0.5 block break-words text-xs text-muted-foreground">
                        {produtoTrim ? (
                          <TextoDestaqueBusca texto={caracteristicas} termo={produtoTrim} />
                        ) : (
                          caracteristicas
                        )}
                      </span>
                    ) : null}
                    {mostrarNomeCompra ? (
                      <span className="mt-0.5 block break-words text-xs text-muted-foreground">
                        Compra:{' '}
                        {produtoTrim ? (
                          <TextoDestaqueBusca texto={nomeCompra} termo={produtoTrim} />
                        ) : (
                          nomeCompra
                        )}
                      </span>
                    ) : null}
                  </span>
                  <span className="min-w-0 break-words text-sm">
                    {marca ? (
                      marcaTrim ? (
                        <TextoDestaqueBusca texto={marca} termo={marcaTrim} />
                      ) : (
                        marca
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">{unidade || '—'}</span>
                  <Button
                    type="button"
                    size="sm"
                    className="self-start sm:justify-self-end"
                    disabled={acao}
                    onClick={() => void onVincular(produto.id)}
                  >
                    Conciliar
                  </Button>
                </li>
              )
            })}
            {!carregando && produtos.length === 0 && (
              <li className="px-2 py-3 text-sm text-muted-foreground">
                {!temBusca
                  ? 'Digite pelo menos 2 caracteres no produto ou na marca.'
                  : 'Nenhum produto ainda — refine produto ou marca.'}
              </li>
            )}
            {carregando && produtos.length === 0 && (
              <li className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Buscando…
              </li>
            )}
          </ul>
          {carregando && produtos.length > 0 ? (
            <p className="flex items-center gap-2 px-2 text-xs text-muted-foreground" aria-live="polite">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Atualizando lista…
            </p>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
