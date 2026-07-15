'use client'

/**
 * Visual do relatório de conferência (KPIs, avisos, divergências de
 * cabeçalho e tabela de itens com foto do produto). Compartilhado entre o
 * modal "Conferir com IA" do ERP e a seção de relatório no portal do
 * fornecedor — não inclui ações de decisão (Aprovar/Solicitar ajuste),
 * que são exclusivas do ERP.
 */
import { BadgeStatus } from '@/components/ui/badge-status'
import { resolverUrlUpload } from '@/lib/resolver-url-upload'

export type DivergenciaCampo = {
  campo: string
  esperado: string
  encontrado: string
  severidade: 'alta' | 'media' | 'baixa'
}

export type LinhaConferencia = {
  status: 'ok' | 'divergente' | 'sem_match_pedido' | 'sobra_arquivo'
  metodoMatch: 'codigo_barras' | 'codigo_original' | 'nome_preco' | 'nenhum'
  confianca: number
  pedido?: {
    produtoId: string
    nome: string
    quantidade: number
    precoUnitario: number
    fotoUrl?: string | null
  }
  arquivo?: { descricao: string; quantidade: number; precoUnitario: number; codigo: string | null }
  divergencias: DivergenciaCampo[]
}

export type RelatorioConferencia = {
  statusGeral: 'ok' | 'divergencias' | 'falha_extracao'
  provider: string
  modelo: string
  resumo: {
    totalItensPedido: number
    totalItensArquivo: number
    ok: number
    divergentes: number
    semMatch: number
    sobrasArquivo: number
  }
  cabecalho: { divergencias: DivergenciaCampo[] }
  linhas: LinhaConferencia[]
  avisos: string[]
}

const ROTULO_STATUS: Record<LinhaConferencia['status'], { texto: string; variante: 'ativo' | 'pendente' | 'reprovado' }> = {
  ok: { texto: 'OK', variante: 'ativo' },
  divergente: { texto: 'Divergente', variante: 'pendente' },
  sem_match_pedido: { texto: 'Sem no arquivo', variante: 'reprovado' },
  sobra_arquivo: { texto: 'Sobra no arquivo', variante: 'reprovado' },
}

const ROTULO_METODO: Record<LinhaConferencia['metodoMatch'], string> = {
  codigo_barras: 'Código de barras',
  codigo_original: 'Código original',
  nome_preco: 'Nome + preço',
  nenhum: '—',
}

export function RelatorioConferenciaVisual({ relatorio }: { relatorio: RelatorioConferencia }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          Provedor: <strong className="text-foreground">{relatorio.provider}</strong> ({relatorio.modelo})
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <ResumoKpi rotulo="Itens no pedido" valor={relatorio.resumo.totalItensPedido} />
        <ResumoKpi rotulo="Itens no arquivo" valor={relatorio.resumo.totalItensArquivo} />
        <ResumoKpi rotulo="OK" valor={relatorio.resumo.ok} tom="ok" />
        <ResumoKpi rotulo="Divergentes" valor={relatorio.resumo.divergentes} tom="alerta" />
        <ResumoKpi
          rotulo="Sem match / sobra"
          valor={relatorio.resumo.semMatch + relatorio.resumo.sobrasArquivo}
          tom="alerta"
        />
      </div>

      {relatorio.avisos.length > 0 && (
        <div className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
          {relatorio.avisos.map((aviso, i) => (
            <p key={i}>{aviso}</p>
          ))}
        </div>
      )}

      {relatorio.cabecalho.divergencias.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium">Divergências do cabeçalho</p>
          <ul className="space-y-1 text-sm">
            {relatorio.cabecalho.divergencias.map((d, i) => (
              <li key={i} className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                <span className="font-medium">{d.campo}</span> — esperado: {d.esperado} · encontrado: {d.encontrado}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Itens</p>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5">Foto</th>
                <th className="px-2 py-1.5">Status</th>
                <th className="px-2 py-1.5">Método</th>
                <th className="px-2 py-1.5">Pedido</th>
                <th className="px-2 py-1.5">Arquivo</th>
                <th className="px-2 py-1.5">Divergências</th>
              </tr>
            </thead>
            <tbody>
              {relatorio.linhas.map((linha, i) => {
                const urlFoto = resolverUrlUpload(linha.pedido?.fotoUrl)
                return (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1.5">
                      {urlFoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={urlFoto} alt="" className="size-8 rounded object-cover" />
                      ) : (
                        <div className="size-8 rounded bg-muted" />
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <BadgeStatus variante={ROTULO_STATUS[linha.status].variante}>
                        {ROTULO_STATUS[linha.status].texto}
                      </BadgeStatus>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">{ROTULO_METODO[linha.metodoMatch]}</td>
                    <td className="px-2 py-1.5">
                      {linha.pedido
                        ? `${linha.pedido.nome} — ${linha.pedido.quantidade} × R$ ${linha.pedido.precoUnitario.toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="px-2 py-1.5">
                      {linha.arquivo
                        ? `${linha.arquivo.descricao} — ${linha.arquivo.quantidade} × R$ ${linha.arquivo.precoUnitario.toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {linha.divergencias.length > 0 ? (
                        <ul className="space-y-0.5">
                          {linha.divergencias.map((d, i) => (
                            <li key={i}>
                              <span className="font-medium text-foreground">{d.campo}</span>: esperado {d.esperado} ·
                              encontrado {d.encontrado}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function ResumoKpi({
  rotulo,
  valor,
  tom = 'neutro',
}: {
  rotulo: string
  valor: number
  tom?: 'neutro' | 'ok' | 'alerta'
}) {
  const cor =
    tom === 'ok'
      ? 'text-primary'
      : tom === 'alerta' && valor > 0
        ? 'text-amber-700'
        : 'text-foreground'

  return (
    <div className="rounded-md border border-border p-2 text-center">
      <p className={`text-lg font-semibold ${cor}`}>{valor}</p>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
    </div>
  )
}
