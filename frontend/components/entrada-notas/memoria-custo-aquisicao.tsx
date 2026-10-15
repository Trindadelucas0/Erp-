'use client'
import type { MemoriaCusto } from '@/lib/custo-aquisicao'
import { moedaCusto } from '@/lib/custo-aquisicao'

export function MemoriaCustoAquisicao({ memoria }: { memoria: MemoriaCusto }) {
  const fontesFrete = memoria.componentes.flatMap(c => c.regra?.fontesFrete ?? [])
  return <div className="space-y-3 text-sm">
    <p>Custo total = bruto − desconto + despesas + tributos adicionais − créditos aplicáveis.</p>
    <dl className="grid gap-2 sm:grid-cols-3">
      {Object.entries({ 'Total do item': moedaCusto(memoria.total), 'Quantidade NF': memoria.quantidadeNf, 'Multiplicador de embalagem': memoria.multiplicador, 'Quantidade de venda': memoria.quantidadeVenda, 'Custo por unidade NF': moedaCusto(memoria.unitarioNf), 'Custo por unidade de venda': moedaCusto(memoria.unitarioVenda) }).map(([nome, valor]) => <div key={nome}><dt className="text-muted-foreground">{nome}</dt><dd className="font-medium">{valor ?? '—'}</dd></div>)}
    </dl>
    <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b"><th className="p-2">Origem</th><th>Valor</th><th>Composição</th><th>Crédito</th><th>Base</th><th>Percentual</th><th>Regra utilizada</th></tr></thead><tbody>
      {memoria.componentes.map((c, i) => <tr key={i} className="border-b"><td className="p-2">{c.origem}</td><td>{moedaCusto(c.valor)}</td><td>{c.incluido ? 'Incluído' : c.regra?.composicao === 'embutido' ? 'Já embutido' : 'Não adicionado'}</td><td>{moedaCusto(c.credito)}</td><td>{moedaCusto(c.base)}</td><td>{c.percentual == null ? '—' : `${c.percentual}%`}</td><td>{c.regra?.recuperabilidade ?? c.regra?.criterio ?? '—'}{c.regra?.cst && ` · CST/CSOSN ${c.regra.cst}`} {c.regra?.modoCredito === 'pre_definida' ? ' · Padrão ERP' : c.regra?.modoCredito === 'nota' ? ' · XML' : ''} {c.regra?.baseCredito && ` · Base ${c.regra.baseCredito === 'bruto' ? 'valor bruto' : c.regra.baseCredito === 'liquido' ? 'valor líquido' : 'vBC do XML'}`} {c.regra?.descricaoBase}</td></tr>)}
    </tbody></table></div>
    {!!fontesFrete.length && <details><summary className="cursor-pointer">Valores originais do transporte</summary><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th>Chave CT-e</th><th>Frete vinculado</th><th>Base ICMS</th><th>Alíquota XML</th><th>ICMS XML</th></tr></thead><tbody>{fontesFrete.map((f, i) => <tr key={i}><td className="p-2 break-all">{f.chaveNfe ?? '—'}</td><td>{moedaCusto(f.valorFrete)}</td><td>{moedaCusto(f.baseCalculoIcms)}</td><td>{f.aliquotaIcms == null ? 'Tag ausente' : f.aliquotaIcms + '%'}</td><td>{f.valorIcms == null ? 'Tag ausente' : moedaCusto(f.valorIcms)}</td></tr>)}</tbody></table></div></details>}
    {!!memoria.pendencias.length && <ul className="list-inside list-disc text-destructive">{memoria.pendencias.map(p => <li key={p}>{p}</li>)}</ul>}
    {memoria.original && <details><summary className="cursor-pointer">Valores originais do XML</summary><dl className="grid gap-2 p-2 sm:grid-cols-3">{Object.entries(memoria.original).filter(([, v]) => typeof v !== 'object' || v === null).map(([campo, valor]) => <div key={campo}><dt className="text-muted-foreground">{campo}</dt><dd>{valor == null ? 'Tag ausente' : String(valor)}</dd></div>)}</dl>
      {memoria.original.tributos != null && typeof memoria.original.tributos === 'object' && <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th>Tributo</th><th>Grupo XML</th><th>CST/CSOSN</th><th>Valor XML</th><th>Base XML</th><th>Alíquota XML</th></tr></thead><tbody>{Object.entries(memoria.original.tributos).map(([nome, valor]) => { const t = valor as { grupo: string | null; cst: string | null; valor: number | null; base: number | null; aliquota: number | null }; return <tr key={nome}><td className="p-2">{nome.toUpperCase()}</td><td>{t.grupo ?? 'Ausente'}</td><td>{t.cst ?? '—'}</td><td>{t.valor == null ? 'Tag ausente' : moedaCusto(t.valor)}</td><td>{t.base == null ? 'Tag ausente' : moedaCusto(t.base)}</td><td>{t.aliquota == null ? 'Tag ausente' : `${t.aliquota}%`}</td></tr> })}</tbody></table></div>}
    </details>}
  </div>
}
