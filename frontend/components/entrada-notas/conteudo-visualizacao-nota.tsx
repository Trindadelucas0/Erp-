'use client'

import { mascaraCnpj, mascaraCpf } from '@/lib/documentos'

export type ItemVisualizacaoNota = {
  nItem: number
  descricao: string | null
  gtin: string | null
  codigoProduto: string | null
  ncm: string | null
  cfop: string | null
  quantidade: number | null
  valorUnitario: number | null
  valorTotal: number | null
}

export type VisualizacaoNota = {
  tipoDocumento: 'nfe55' | 'nfse' | 'cte' | 'desconhecido'
  chaveNfe: string | null
  numero: string | null
  serie: string | null
  naturezaOperacao: string | null
  dataEmissao: string | null
  emitente: {
    nome: string | null
    documento: string | null
    endereco: string | null
  }
  destinatario: {
    nome: string | null
    documento: string | null
  }
  valorTotal: number | null
  prazoPagamento: string | null
  descricaoServico: string | null
  itens: ItemVisualizacaoNota[]
}

function formatarDoc(doc: string | null | undefined): string {
  if (!doc) return '—'
  const limpo = doc.toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (limpo.length === 14 || /[A-Z]/.test(limpo)) return mascaraCnpj(doc)
  if (limpo.length === 11) return mascaraCpf(limpo)
  return doc
}

function formatarMoeda(valor: number | null | undefined): string {
  if (valor == null) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR')
}

/** Conteúdo legível da nota fiscal (não mostra XML bruto). */
export function ConteudoVisualizacaoNota({
  visualizacao,
}: {
  visualizacao: VisualizacaoNota
}) {
  const ehNfse = visualizacao.tipoDocumento === 'nfse'
  const ehCte = visualizacao.tipoDocumento === 'cte'
  const ehDocumental = ehNfse || ehCte
  const tituloTipo =
    ehNfse ? 'NFS-e (serviço)' : ehCte ? 'CTe (transporte)' : 'NFe 55 (produto)'
  const rotuloEmitente = ehNfse ? 'Prestador' : ehCte ? 'Transportadora' : 'Emitente'
  const rotuloDest = ehNfse ? 'Tomador' : ehCte ? 'Destinatário / Tomador' : 'Destinatário'

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {tituloTipo}
          </p>
          <p className="mt-1 text-lg font-semibold">
            {visualizacao.numero
              ? `Nº ${visualizacao.numero}${visualizacao.serie ? ` · Série ${visualizacao.serie}` : ''}`
              : ehCte
                ? 'Conhecimento de transporte'
                : 'Nota fiscal'}
          </p>
        </div>
        <p className="text-right text-lg font-semibold tabular-nums">
          {formatarMoeda(visualizacao.valorTotal)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {rotuloEmitente}
          </p>
          <p className="mt-1 font-medium">{visualizacao.emitente.nome ?? '—'}</p>
          <p className="text-xs text-muted-foreground">
            {formatarDoc(visualizacao.emitente.documento)}
          </p>
          {visualizacao.emitente.endereco && (
            <p className="mt-1 text-xs text-muted-foreground">{visualizacao.emitente.endereco}</p>
          )}
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {rotuloDest}
          </p>
          <p className="mt-1 font-medium">{visualizacao.destinatario.nome ?? '—'}</p>
          <p className="text-xs text-muted-foreground">
            {formatarDoc(visualizacao.destinatario.documento)}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <p>
          <span className="text-muted-foreground">Emissão:</span> {formatarData(visualizacao.dataEmissao)}
        </p>
        {visualizacao.naturezaOperacao && (
          <p className="sm:col-span-2">
            <span className="text-muted-foreground">Natureza:</span>{' '}
            {visualizacao.naturezaOperacao}
          </p>
        )}
        {visualizacao.prazoPagamento && (
          <p className="sm:col-span-2">
            <span className="text-muted-foreground">Vencimento(s):</span>{' '}
            {visualizacao.prazoPagamento}
          </p>
        )}
      </div>

      {ehDocumental && visualizacao.descricaoServico && (
        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {ehCte ? 'Observações / natureza' : 'Descrição do serviço'}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{visualizacao.descricaoServico}</p>
        </div>
      )}

      {!ehDocumental && visualizacao.itens.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                <th className="px-2 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">Produto</th>
                <th className="px-2 py-2 font-medium">NCM</th>
                <th className="px-2 py-2 font-medium">CFOP</th>
                <th className="px-2 py-2 text-right font-medium">Qtd</th>
                <th className="px-2 py-2 text-right font-medium">Unit.</th>
                <th className="px-2 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {visualizacao.itens.map((item) => (
                <tr key={item.nItem} className="border-b border-border last:border-0">
                  <td className="px-2 py-2 tabular-nums">{item.nItem}</td>
                  <td className="max-w-[14rem] px-2 py-2">
                    <div className="font-medium">{item.descricao ?? '—'}</div>
                    {(item.codigoProduto || item.gtin) && (
                      <div className="text-muted-foreground">
                        {[item.codigoProduto, item.gtin].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 font-mono">{item.ncm ?? '—'}</td>
                  <td className="px-2 py-2 font-mono">{item.cfop ?? '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {item.quantidade != null
                      ? item.quantidade.toLocaleString('pt-BR')
                      : '—'}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatarMoeda(item.valorUnitario)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatarMoeda(item.valorTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!ehDocumental && visualizacao.itens.length === 0 && (
        <p className="text-muted-foreground">Sem itens de produto no XML desta nota.</p>
      )}

      <p className="break-all font-mono text-[11px] text-muted-foreground">
        Chave: {visualizacao.chaveNfe ?? '—'}
      </p>
    </div>
  )
}
