'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { usePermissao } from '@/hooks/use-permissao'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { extrairSerieNumeroChave } from '@/lib/chave-acesso-nfe'
import {
  calcularDiferencaPercentualPreco,
  calcularMargemDePreco,
  calcularPrecoSugerido,
} from '@/lib/formacao-preco-venda'
import { CardPadrao } from '@/components/ui/card-padrao'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const LIMIAR_VARIACAO = 0.3
const CLASSE_INPUT_GRADE =
  'h-8 w-[6.25rem] px-1.5 py-1 text-right tabular-nums md:text-sm'

type ItemPrecificacaoApi = {
  itemId: string
  nItem: number
  descricao: string | null
  quantidade: number | null
  produtoId: string | null
  produtoNome: string | null
  sku: string | null
  vinculado: boolean
  custoEntrada: number | null
  custoAnterior: number | null
  variacaoPercentual: number | null
  encargosPercentual: number
  margemPercentual: number
  precoSugerido: number | null
  precoAtual: number | null
  diferencaPercentual: number | null
  estoqueDisponivel: number | null
  recusa: string | null
}

type GradePrecificacao = {
  nota: {
    id: string
    chaveNfe: string
    nomeEmitente: string | null
    documentoEmitente: string | null
    dataEmissao: string | null
    valorTotal: number | null
  }
  competencia: string
  parametrizacaoCadastrada: boolean
  encargosPercentual: number
  parametrizacao: {
    jurosMensaisCustoFinanOperac: number | null
    aliquotaCbs: number | null
    aliquotaIbs: number | null
    totalVenda: number
  }
  itens: ItemPrecificacaoApi[]
}

type LinhaGrade = ItemPrecificacaoApi & {
  margemTexto: string
  precoTexto: string
  recusaLocal: string | null
}

function formatarMoeda(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarQtd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
}

function formatarPct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '—'
  const sinal = pct > 0 ? '+' : ''
  return `${sinal}${(pct * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function formatarPercentual(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

function parseDecimal(texto: string): number | null {
  const t = texto.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function textoDecimal(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return String(n)
}

function linhaDeApi(item: ItemPrecificacaoApi): LinhaGrade {
  return {
    ...item,
    margemTexto: textoDecimal(item.margemPercentual),
    precoTexto: textoDecimal(item.precoSugerido),
    recusaLocal: item.recusa,
  }
}

function ConteudoPrecificacao() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : ''
  const podeGravar = usePermissao('produtos:edit')
  const [grade, setGrade] = useState<GradePrecificacao | null>(null)
  const [linhas, setLinhas] = useState<LinhaGrade[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  const carregar = useCallback(async () => {
    if (!id) return
    setCarregando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.get<GradePrecificacao>(
        `/entrada-notas/${id}/precificacao`
      )
      setGrade(data)
      setLinhas((data.itens ?? []).map(linhaDeApi))
    } catch (e) {
      setGrade(null)
      setLinhas([])
      setErro(extrairMensagemApi(e, 'Não foi possível abrir a precificação desta nota.'))
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  function atualizarMargem(itemId: string, texto: string) {
    setMensagem('')
    setLinhas((atuais) =>
      atuais.map((linha) => {
        if (linha.itemId !== itemId) return linha
        const margem = parseDecimal(texto)
        if (margem == null) {
          return { ...linha, margemTexto: texto, recusaLocal: 'Margem inválida.' }
        }
        const r = calcularPrecoSugerido(linha.custoEntrada, linha.encargosPercentual, margem)
        if (!r.ok) {
          return {
            ...linha,
            margemTexto: texto,
            precoSugerido: null,
            precoTexto: '',
            diferencaPercentual: null,
            recusaLocal: r.motivo,
          }
        }
        return {
          ...linha,
          margemTexto: texto,
          margemPercentual: r.margemPercentual,
          precoSugerido: r.precoSugerido,
          precoTexto: textoDecimal(r.precoSugerido),
          diferencaPercentual: calcularDiferencaPercentualPreco(r.precoSugerido, linha.precoAtual),
          recusaLocal: null,
        }
      })
    )
  }

  function atualizarPreco(itemId: string, texto: string) {
    setMensagem('')
    setLinhas((atuais) =>
      atuais.map((linha) => {
        if (linha.itemId !== itemId) return linha
        const preco = parseDecimal(texto)
        if (preco == null) {
          return { ...linha, precoTexto: texto, recusaLocal: 'Preço inválido.' }
        }
        const r = calcularMargemDePreco(linha.custoEntrada, linha.encargosPercentual, preco)
        if (!r.ok) {
          return {
            ...linha,
            precoTexto: texto,
            precoSugerido: null,
            diferencaPercentual: null,
            recusaLocal: r.motivo,
          }
        }
        return {
          ...linha,
          precoTexto: texto,
          precoSugerido: r.precoSugerido,
          margemPercentual: r.margemPercentual,
          margemTexto: textoDecimal(r.margemPercentual),
          diferencaPercentual: calcularDiferencaPercentualPreco(r.precoSugerido, linha.precoAtual),
          recusaLocal: null,
        }
      })
    )
  }

  const paraGravar = useMemo(
    () =>
      linhas.filter(
        (l) =>
          l.vinculado &&
          l.produtoId &&
          l.precoSugerido != null &&
          l.precoSugerido > 0 &&
          !l.recusaLocal
      ),
    [linhas]
  )

  async function gravar() {
    if (!id || !podeGravar) return
    if (paraGravar.length === 0) {
      setErro('Nenhum item com produto vinculado e preço válido para gravar.')
      return
    }
    setSalvando(true)
    setErro('')
    setMensagem('')
    try {
      const { data } = await clienteHttp.put<GradePrecificacao>(
        `/entrada-notas/${id}/precificacao`,
        {
          itens: paraGravar.map((l) => ({
            produtoId: l.produtoId,
            precoVenda: l.precoSugerido,
            margemPercentual: l.margemPercentual,
          })),
        }
      )
      setGrade(data)
      setLinhas((data.itens ?? []).map(linhaDeApi))
      setMensagem('Preço de venda gravado no cadastro do produto.')
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível gravar os preços.'))
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Carregando precificação…</p>
  }

  if (!grade) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{erro || 'Nota não encontrada.'}</p>
        <Button asChild variant="outline">
          <Link href="/auditoria-entradas">Voltar</Link>
        </Button>
      </div>
    )
  }

  const { serie, numero } = extrairSerieNumeroChave(grade.nota.chaveNfe)
  const encargosDetalhe = grade.parametrizacao

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TituloPagina>Precificação</TituloPagina>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/auditoria-entradas/${id}`}>Dossiê da nota</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/auditoria-entradas">Voltar à lista</Link>
          </Button>
        </div>
      </div>

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
      {mensagem && (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
          {mensagem}
        </p>
      )}

      <CardPadrao titulo="Nota">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Fornecedor</dt>
            <dd className="font-medium">{grade.nota.nomeEmitente || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Nº / série</dt>
            <dd className="font-medium tabular-nums">
              {numero ?? '—'}
              {serie ? ` / ${serie}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Emissão</dt>
            <dd className="font-medium">{formatarData(grade.nota.dataEmissao)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Competência</dt>
            <dd className="font-medium tabular-nums">{grade.competencia}</dd>
          </div>
        </dl>
      </CardPadrao>

      <CardPadrao titulo="Encargos da competência">
        <p className="mb-3 text-sm text-muted-foreground">
          Total de encargos = soma de Configurações → Vendas (PIS, COFINS, Imp. renda, Contribuição
          social, Custo fixo e Comissão). CBS, IBS e juros aparecem aqui e não entram no divisor.
        </p>
        {!grade.parametrizacaoCadastrada && (
          <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">
            Não há percentuais gravados para {grade.competencia}. Os encargos estão em 0%.{' '}
            <Link href="/configuracoes?aba=vendas" className="text-primary underline">
              Abrir Configurações → Vendas
            </Link>
          </p>
        )}
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Encargos (Total Venda)</dt>
            <dd className="font-medium tabular-nums">
              {formatarPercentual(grade.encargosPercentual)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Juros mensais</dt>
            <dd className="tabular-nums">{formatarPercentual(encargosDetalhe.jurosMensaisCustoFinanOperac)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">CBS</dt>
            <dd className="tabular-nums">{formatarPercentual(encargosDetalhe.aliquotaCbs)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">IBS</dt>
            <dd className="tabular-nums">{formatarPercentual(encargosDetalhe.aliquotaIbs)}</dd>
          </div>
        </dl>
      </CardPadrao>

      <CardPadrao titulo="Grade da nota">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-2 py-2 font-medium">Produto / SKU</th>
                <th className="px-2 py-2 font-medium text-right">Qtd</th>
                <th className="px-2 py-2 font-medium text-right">Custo da entrada</th>
                <th className="px-2 py-2 font-medium text-right">Custo anterior</th>
                <th className="px-2 py-2 font-medium text-right">Variação</th>
                <th className="px-2 py-2 font-medium text-right">Encargos %</th>
                <th className="px-2 py-2 font-medium text-right">Margem %</th>
                <th className="px-2 py-2 font-medium text-right">Preço sugerido</th>
                <th className="px-2 py-2 font-medium text-right">Preço atual</th>
                <th className="px-2 py-2 font-medium text-right">% diferença</th>
                <th className="px-2 py-2 font-medium text-right">Estoque disp.</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-2 py-6 text-muted-foreground">
                    Nenhum item nesta nota.
                  </td>
                </tr>
              ) : (
                linhas.map((linha) => {
                  const destaque =
                    linha.variacaoPercentual != null &&
                    Math.abs(linha.variacaoPercentual) >= LIMIAR_VARIACAO
                  const editavel = linha.vinculado && podeGravar && !salvando
                  return (
                    <tr key={linha.itemId} className="border-b align-top">
                      <td className="px-2 py-2">
                        <div className="font-medium">
                          {linha.produtoNome || linha.descricao || '—'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {linha.sku || (linha.vinculado ? '—' : 'Sem produto vinculado')}
                        </div>
                        {linha.recusaLocal && (
                          <p className="mt-1 text-xs text-destructive">{linha.recusaLocal}</p>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatarQtd(linha.quantidade)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatarMoeda(linha.custoEntrada)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatarMoeda(linha.custoAnterior)}
                      </td>
                      <td
                        className={cn(
                          'px-2 py-2 text-right tabular-nums',
                          destaque && 'font-semibold text-amber-700 dark:text-amber-400'
                        )}
                      >
                        {formatarPct(linha.variacaoPercentual)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatarPercentual(linha.encargosPercentual)}
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          aria-label={`Margem % do item ${linha.nItem}`}
                          className={CLASSE_INPUT_GRADE}
                          inputMode="decimal"
                          value={linha.margemTexto}
                          disabled={!editavel}
                          onChange={(e) => atualizarMargem(linha.itemId, e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          aria-label={`Preço sugerido do item ${linha.nItem}`}
                          className={CLASSE_INPUT_GRADE}
                          inputMode="decimal"
                          value={linha.precoTexto}
                          disabled={!editavel}
                          onChange={(e) => atualizarPreco(linha.itemId, e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatarMoeda(linha.precoAtual)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatarPct(linha.diferencaPercentual)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatarQtd(linha.estoqueDisponivel)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <BotaoPrimario
            type="button"
            onClick={() => void gravar()}
            disabled={!podeGravar || salvando || paraGravar.length === 0}
          >
            {salvando ? 'Gravando…' : 'Gravar'}
          </BotaoPrimario>
          {!podeGravar && (
            <p className="text-sm text-muted-foreground">
              É preciso a permissão de editar produtos para gravar o preço de venda.
            </p>
          )}
        </div>
      </CardPadrao>
    </div>
  )
}

export default function PaginaPrecificacaoEntrada() {
  return (
    <ProtegerRota chaveDaPagina="auditoria-entradas">
      <ConteudoPrecificacao />
    </ProtegerRota>
  )
}
