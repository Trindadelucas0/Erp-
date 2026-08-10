'use client'

import { useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  CabecalhoOpcaoProduto,
  LinhaOpcaoProduto,
} from '@/components/produtos/linha-opcao-produto'
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
  /** Frete rateado no item (prévia após etapa Frete com destinatário) */
  custoFreteRateado?: number | null
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

function formatarDetalheEmbalagens(qtdEmbalagens: number, undPorEmbalagem: number): string {
  const n = Number.isFinite(qtdEmbalagens) ? qtdEmbalagens : 0
  const rotulo = n === 1 ? 'embalagem' : 'embalagens'
  return `(${n} ${rotulo} com ${undPorEmbalagem} und cada)`
}

function rotuloProdutoSistema(produto: NonNullable<ItemVinculoCadastro['produto']>) {
  const extras: string[] = []
  const marca = produto.marca?.trim()
  const unidade = produto.unidade?.trim()
  if (marca) extras.push(marca)
  if (unidade) extras.push(unidade)

  return (
    <>
      {produto.sku?.trim() ? (
        <span className="mr-1.5 font-mono text-xs tabular-nums text-muted-foreground">
          {produto.sku.trim()}
        </span>
      ) : null}
      {produto.nomeVenda}
      {extras.length > 0 ? (
        <span className="ml-1 text-xs text-muted-foreground">· {extras.join(' · ')}</span>
      ) : null}
    </>
  )
}

type LinhaEspelhoProps = {
  rotulo: string
  valor: ReactNode
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
  carregandoBusca?: boolean
  buscaProduto: string
  produtos: ProdutoBuscaVinculo[]
  onAbrirBusca: () => void
  onFecharBusca: () => void
  onBuscaChange: (valor: string) => void
  onBuscar: () => void
  onVincular: (produtoId: string) => void | Promise<void>
  onGravarCodigoOriginal?: () => void | Promise<void>
  /** Após gravar com sucesso nesta sessão da tela */
  codigoOriginalGravado?: boolean
  /**
   * Entrada documental (uso/consumo): vínculo não obrigatório.
   * Se false, oculta Conciliar produto.
   */
  permitirAcoesVinculo?: boolean
  /** Soften “Sem vínculo” quando documental e produto não exigido */
  vinculoNaoExigido?: boolean
}

export function ItemVinculoCadastroGrid({
  item,
  finalizada,
  acao,
  buscando,
  carregandoBusca = false,
  buscaProduto,
  produtos,
  onAbrirBusca,
  onFecharBusca,
  onBuscaChange,
  onBuscar,
  onVincular,
  onGravarCodigoOriginal,
  codigoOriginalGravado = false,
  permitirAcoesVinculo = true,
  vinculoNaoExigido = false,
}: Props) {
  const [gravandoCodigo, setGravandoCodigo] = useState(false)
  const vinculado = Boolean(item.produtoId)
  const pendenteDocumental = !vinculado && vinculoNaoExigido
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

  const qtdUnitTexto = formatarQtdUnit(item.quantidade, item.valorUnitario)

  const precoUnitarioSistema =
    temMultiploCompra &&
    item.valorUnitario != null &&
    Number.isFinite(item.valorUnitario)
      ? item.valorUnitario / itensPorEmbalagem
      : item.valorUnitario
  const qtdEntrada =
    temMultiploCompra && item.qtdTotalUn != null ? item.qtdTotalUn : item.quantidade
  const freteRateado =
    item.custoFreteRateado != null && Number.isFinite(item.custoFreteRateado)
      ? item.custoFreteRateado
      : null
  const fretePorUnd =
    freteRateado != null &&
    freteRateado > 0 &&
    qtdEntrada != null &&
    Number.isFinite(qtdEntrada) &&
    qtdEntrada > 0
      ? freteRateado / qtdEntrada
      : null
  const fretePorUndTexto =
    fretePorUnd != null && fretePorUnd > 0
      ? fretePorUnd.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : null
  const qtdEntradaValorSistema = (
    <>
      <span>{formatarQtdUnit(qtdEntrada, precoUnitarioSistema)}</span>
      {temMultiploCompra ? (
        <span className="ml-1.5 font-sans text-[11px] font-normal leading-none text-muted-foreground">
          {formatarDetalheEmbalagens(item.quantidade ?? 0, itensPorEmbalagem)}
        </span>
      ) : null}
    </>
  )
  const podeGravarOriginal =
    vinculado &&
    !finalizada &&
    Boolean(item.codigoProduto?.trim()) &&
    !codigoOriginalGravado &&
    Boolean(onGravarCodigoOriginal)

  const rotuloVinculo = rotuloVinculoModo(item.vinculoModo)
  const unidadeNfTitulo = item.unidade?.trim() || null
  const mostrarFrete = vinculado && fretePorUndTexto != null

  const estiloSistema = vinculado
    ? 'border-l-4 border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
    : pendenteDocumental
      ? 'border-l-4 border-l-muted-foreground/40 bg-muted/20'
      : 'border-l-4 border-l-destructive bg-destructive/10'

  function cabecalhoNf() {
    return (
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground">NF</p>
        <p className="font-medium">
          #{item.nItem} {item.descricao ?? '—'}
          {unidadeNfTitulo ? (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              · {unidadeNfTitulo}
            </span>
          ) : null}
        </p>
      </div>
    )
  }

  function cabecalhoSistema() {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">SISTEMA</p>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-semibold',
              vinculado
                ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300'
                : pendenteDocumental
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-destructive/15 text-destructive'
            )}
          >
            {vinculado ? 'Vinculado' : pendenteDocumental ? 'Não exigido' : 'Sem vínculo'}
          </span>
        </div>
        {item.produto ? (
          <p className="font-medium">{rotuloProdutoSistema(item.produto)}</p>
        ) : (
          <p
            className={cn(
              'font-medium',
              pendenteDocumental ? 'text-muted-foreground' : 'text-destructive'
            )}
          >
            {pendenteDocumental ? 'Vínculo não exigido (uso/consumo)' : 'Sem vínculo'}
          </p>
        )}
      </div>
    )
  }

  function campoBarrasNf() {
    return <LinhaEspelho rotulo="Código de barras" valor={gtinNf} />
  }
  function campoBarrasSistema() {
    return (
      <LinhaEspelho
        rotulo="Código de barras"
        valor={gtinSistema}
        valorClassName={cn(
          gtinBate && 'font-semibold text-emerald-700 dark:text-emerald-300',
          gtinSistema === 'sem GTIN' && 'text-muted-foreground'
        )}
      />
    )
  }
  function campoOriginalNf() {
    return <LinhaEspelho rotulo="Código original" valor={codOrigNf} />
  }
  function campoOriginalSistema() {
    return (
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
    )
  }
  function campoQtdNf() {
    return (
      <LinhaEspelho rotulo="Qtd × unit." valor={qtdUnitTexto} valorClassName="font-sans" />
    )
  }
  function campoQtdSistema() {
    return (
      <LinhaEspelho
        rotulo="Qtd entrada"
        valor={qtdEntradaValorSistema}
        valorClassName="font-sans text-foreground"
      />
    )
  }
  function campoFreteSistema() {
    if (!mostrarFrete) return null
    return (
      <LinhaEspelho
        rotulo="Frete por und"
        valor={fretePorUndTexto}
        valorClassName="font-sans text-foreground"
      />
    )
  }

  function rodapeSistema() {
    return (
      <div className="space-y-2">
        {vinculado && rotuloVinculo && (
          <p className="text-right text-[10px] text-muted-foreground/70">
            vínculo: {rotuloVinculo}
          </p>
        )}

        {item.criticaCadastro && !vinculoNaoExigido && (
          <p className="text-xs text-destructive">Crítica de cadastro — concilie o produto</p>
        )}

        {vinculado && !finalizada && (
          <p className="text-xs text-muted-foreground">
            Vínculo travado — ajuste no cadastro do produto se houver divergência.
          </p>
        )}

        {!finalizada && permitirAcoesVinculo && !item.produtoId && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <Button type="button" size="sm" disabled={acao} onClick={onAbrirBusca}>
              Conciliar produto
            </Button>
          </div>
        )}

        {buscando && permitirAcoesVinculo && !item.produtoId && (
          <div className="mt-1 space-y-2 rounded-md border border-dashed p-3">
            <p className="text-[11px] text-muted-foreground">
              Digite palavras-chave — a lista atualiza sozinha enquanto você digita.
            </p>
            <div className="flex gap-2">
              <input
                autoFocus
                className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Ex.: esgoto 75 ou ESG…"
                aria-label="Buscar produto para conciliar"
                aria-busy={carregandoBusca}
                value={buscaProduto}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => onBuscaChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onBuscar()
                }}
              />
              {carregandoBusca ? (
                <span
                  className="inline-flex items-center px-2 text-muted-foreground"
                  aria-live="polite"
                >
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  <span className="sr-only">Buscando…</span>
                </span>
              ) : null}
              <Button type="button" size="sm" variant="ghost" onClick={onFecharBusca}>
                Fechar
              </Button>
            </div>
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {produtos.length > 0 ? (
                <li className="px-2 py-0.5" aria-hidden>
                  <CabecalhoOpcaoProduto className="border-0 px-0 py-0.5" />
                </li>
              ) : null}
              {produtos.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted"
                >
                  <LinhaOpcaoProduto
                    sku={p.sku}
                    nome={p.nomeVenda}
                    termoBusca={buscaProduto}
                    complemento={
                      p.marca?.trim() ? (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          · {p.marca.trim()}
                        </span>
                      ) : null
                    }
                    className="text-left"
                  />
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
              {!carregandoBusca && produtos.length === 0 && (
                <li className="px-2 py-1 text-xs text-muted-foreground">
                  {buscaProduto.trim().length < 2
                    ? 'Digite pelo menos 2 caracteres para buscar.'
                    : 'Nenhum produto ainda — continue digitando ou refine as palavras-chave.'}
                </li>
              )}
              {carregandoBusca && produtos.length === 0 && (
                <li className="px-2 py-1 text-xs text-muted-foreground">Buscando…</li>
              )}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <article className="overflow-hidden rounded-md border text-sm">
      {/* Mobile: NF completo, depois SISTEMA (frete no final). */}
      <div className="sm:hidden">
        <section
          className="min-w-0 space-y-2 border-b bg-muted/40 p-3"
          aria-label="Produto da nota fiscal"
        >
          {cabecalhoNf()}
          <dl className="grid gap-1 text-xs text-muted-foreground">
            {campoBarrasNf()}
            {campoOriginalNf()}
            {campoQtdNf()}
          </dl>
        </section>
        <section
          className={cn('relative min-w-0 space-y-2 p-3', estiloSistema)}
          aria-label="Produto do sistema"
        >
          {cabecalhoSistema()}
          <dl className="grid gap-1 text-xs text-muted-foreground">
            {campoBarrasSistema()}
            {campoOriginalSistema()}
            {campoQtdSistema()}
            {campoFreteSistema()}
          </dl>
          {rodapeSistema()}
        </section>
      </div>

      {/* Desktop: linhas pareadas — barras/original/qtd cara a cara; frete só à direita no fim. */}
      <div className="hidden sm:grid sm:grid-cols-2 sm:grid-rows-[auto_auto_auto_auto_auto]">
        <section
          className="min-w-0 bg-muted/40 p-3 sm:row-span-5 sm:grid sm:grid-rows-subgrid sm:gap-y-1 sm:border-r"
          aria-label="Produto da nota fiscal"
        >
          {cabecalhoNf()}
          <div className="text-xs text-muted-foreground">{campoBarrasNf()}</div>
          <div className="text-xs text-muted-foreground">{campoOriginalNf()}</div>
          <div className="text-xs text-muted-foreground">{campoQtdNf()}</div>
          <div aria-hidden className="min-h-0" />
        </section>
        <section
          className={cn(
            'relative min-w-0 p-3 sm:row-span-5 sm:grid sm:grid-rows-subgrid sm:gap-y-1',
            estiloSistema
          )}
          aria-label="Produto do sistema"
        >
          {cabecalhoSistema()}
          <div className="text-xs text-muted-foreground">{campoBarrasSistema()}</div>
          <div className="text-xs text-muted-foreground">{campoOriginalSistema()}</div>
          <div className="text-xs text-muted-foreground">{campoQtdSistema()}</div>
          <div className="text-xs text-muted-foreground">{campoFreteSistema()}</div>
        </section>
      </div>
      <div className="hidden sm:grid sm:grid-cols-2">
        <div className="bg-muted/40 sm:border-r" aria-hidden />
        <div className={cn('p-3 pt-1', estiloSistema)}>{rodapeSistema()}</div>
      </div>
    </article>
  )
}
