'use client'

import Link from 'next/link'
import { ExternalLink, Package } from 'lucide-react'
import {
  formatarMoedaKardex,
  formatarQtdEstoque,
  type FornecedorVinculoKardex,
  type ProdutoKardex,
} from '@/lib/estoque'

type Props = {
  produto: ProdutoKardex
  fornecedores: FornecedorVinculoKardex[]
}

function Meta({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {rotulo}
      </p>
      <p className="truncate text-sm font-medium text-foreground">{valor?.trim() || '—'}</p>
    </div>
  )
}

export function PainelProdutoKardex({ produto, fornecedores }: Props) {
  const hrefCadastro = `/produtos?id=${encodeURIComponent(produto.id)}`

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Package className="size-4 shrink-0 text-primary" />
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {produto.nomeVenda}
            </h2>
          </div>
          {produto.nomeCompra && produto.nomeCompra !== produto.nomeVenda && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Compra: {produto.nomeCompra}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {!produto.ativo && (
              <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                Inativo
              </span>
            )}
            {!produto.controlaEstoque && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                Não controla estoque
              </span>
            )}
            {produto.bloqueadoVenda && (
              <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                Bloqueado venda
              </span>
            )}
            {produto.permiteEstoqueNegativo && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Permite negativo
              </span>
            )}
          </div>
        </div>
        <Link
          href={hrefCadastro}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Abrir cadastro
          <ExternalLink className="size-3" />
        </Link>
      </div>

      <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-5">
        <Meta rotulo="Código" valor={produto.sku} />
        <Meta rotulo="Unidade" valor={produto.unidade} />
        <Meta rotulo="Marca" valor={produto.marca} />
        <Meta rotulo="Código de barras" valor={produto.codigoBarras} />
        <Meta
          rotulo="Múltiplo venda"
          valor={formatarQtdEstoque(produto.multiploVenda)}
        />
      </div>

      <div className="grid gap-3 rounded-md border border-dashed bg-muted/20 p-3 sm:grid-cols-3">
        <p className="sm:col-span-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Fiscal
        </p>
        <Meta rotulo="NCM" valor={produto.ncm} />
        <Meta rotulo="Origem" valor={produto.codigoOrigem} />
        <Meta rotulo="Preço de custo atual" valor={formatarMoedaKardex(produto.precoCusto)} />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Vínculos com fornecedores
        </p>
        {fornecedores.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Produto sem vínculo com fornecedor.{' '}
            <Link href={hrefCadastro} className="text-primary hover:underline">
              Cadastrar no produto
            </Link>
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-2.5 py-2">Fornecedor</th>
                  <th className="px-2.5 py-2">Documento</th>
                  <th className="px-2.5 py-2">Cód. original</th>
                  <th className="px-2.5 py-2">Unid. entrada</th>
                  <th className="px-2.5 py-2 text-right">Múltiplo</th>
                </tr>
              </thead>
              <tbody>
                {fornecedores.map((f) => (
                  <tr key={f.id} className="border-b last:border-0">
                    <td className="px-2.5 py-2 font-medium">{f.nome}</td>
                    <td className="px-2.5 py-2 font-mono text-xs">
                      {f.documento || '—'}
                    </td>
                    <td className="px-2.5 py-2 font-mono text-xs">
                      {f.codigoFornecedor || '—'}
                    </td>
                    <td className="px-2.5 py-2">{f.unidadeEntrada || '—'}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums">
                      {f.multiplicadorEntrada != null
                        ? formatarQtdEstoque(f.multiplicadorEntrada)
                        : f.multiploEntrada != null
                          ? formatarQtdEstoque(f.multiploEntrada)
                          : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
