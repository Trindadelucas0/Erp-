'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
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
  valorAdicionalReais,
} from '@/lib/formacao-preco-venda'
import { CardPadrao } from '@/components/ui/card-padrao'
import { GradeRolavel } from '@/components/ui/grade-rolavel'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const LIMIAR_VARIACAO = 0.3
const CLASSE_INPUT_GRADE =
  'h-8 w-[6.25rem] px-1.5 py-1 text-right tabular-nums md:text-sm'

function CelulaLinha({
  rotulo,
  alinhamento = 'right',
  children,
}: {
  rotulo: string
  alinhamento?: 'left' | 'right'
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'min-w-[7.25rem] shrink-0 px-2 py-1',
        alinhamento === 'right' ? 'text-right' : 'text-left'
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  )
}

type ItemPrecificacaoApi = {
  itemId: string
  nItem: number
  descricao: string | null
  quantidade: number | null
  produtoId: string | null
  produtoNome: string | null
  sku: string | null
  vinculado: boolean
  tipoFrete: string | null
  tipoFreteRotulo: string | null
  custoFreteRateado: number | null
  creditoIcms: number
  creditoPis: number
  creditoCofins: number
  aliquotaIcms: number | null
  aliquotaPis: number | null
  aliquotaCofins: number | null
  custoComercial: number | null
  custoEntrada: number | null
  custoAnterior: number | null
  custoAnteriorData: string | null
  variacaoPercentual: number | null
  encargosPercentual: number
  vrAdicPercentual: number
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
  vrAdicTexto: string
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

function formatarData(iso: string | null | undefined): string {
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
    vrAdicTexto: textoDecimal(item.vrAdicPercentual ?? 0) || '0',
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

  function atualizarVrAdic(itemId: string, texto: string) {
    setMensagem('')
    setLinhas((atuais) =>
      atuais.map((linha) => {
        if (linha.itemId !== itemId) return linha
        const vrAdic = parseDecimal(texto)
        if (vrAdic == null) {
          return { ...linha, vrAdicTexto: texto, recusaLocal: 'Valor adicional inválido.' }
        }
        const margem = parseDecimal(linha.margemTexto) ?? linha.margemPercentual
        const r = calcularPrecoSugerido(
          linha.custoComercial,
          linha.encargosPercentual,
          margem,
          vrAdic
        )
        if (!r.ok) {
          return {
            ...linha,
            vrAdicTexto: texto,
            vrAdicPercentual: vrAdic,
            precoSugerido: null,
            precoTexto: '',
            diferencaPercentual: null,
            recusaLocal: r.motivo,
          }
        }
        return {
          ...linha,
          vrAdicTexto: texto,
          vrAdicPercentual: vrAdic,
          margemPercentual: r.margemPercentual,
          precoSugerido: r.precoSugerido,
          precoTexto: textoDecimal(r.precoSugerido),
          diferencaPercentual: calcularDiferencaPercentualPreco(r.precoSugerido, linha.precoAtual),
          recusaLocal: null,
        }
      })
    )
  }

  function atualizarMargem(itemId: string, texto: string) {
    setMensagem('')
    setLinhas((atuais) =>
      atuais.map((linha) => {
        if (linha.itemId !== itemId) return linha
        const margem = parseDecimal(texto)
        if (margem == null) {
          return { ...linha, margemTexto: texto, recusaLocal: 'Margem inválida.' }
        }
        const vrAdic = parseDecimal(linha.vrAdicTexto) ?? linha.vrAdicPercentual ?? 0
        const r = calcularPrecoSugerido(
          linha.custoComercial,
          linha.encargosPercentual,
          margem,
          vrAdic
        )
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
        const vrAdic = parseDecimal(linha.vrAdicTexto) ?? linha.vrAdicPercentual ?? 0
        const r = calcularMargemDePreco(
          linha.custoComercial,
          linha.encargosPercentual,
          preco,
          vrAdic
        )
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
        </dl>
      </CardPadrao>

      <CardPadrao titulo="Determinante de Vendas">
        <p className="mb-3 text-sm text-muted-foreground">
          Total de encargos = soma de Configurações → Vendas (PIS, COFINS, Imp. renda, Contribuição
          social, Custo fixo e Comissão). CBS, IBS e juros aparecem aqui e não entram no divisor.
        </p>
        {!grade.parametrizacaoCadastrada && (
          <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">
            Não há percentuais gravados para esta empresa. Os encargos estão em 0%.{' '}
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
        <p className="mb-3 text-sm text-muted-foreground">
          Arraste a barra embaixo para ver as colunas — todos os produtos deslizam juntos. Nome e SKU
          ficam fixos à esquerda.
        </p>
        {linhas.length === 0 ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">Nenhum item nesta nota.</p>
        ) : (
          <GradeRolavel>
            <div className="min-w-0 divide-y rounded-md border">
              {linhas.map((linha) => {
                const destaque =
                  linha.variacaoPercentual != null &&
                  Math.abs(linha.variacaoPercentual) >= LIMIAR_VARIACAO
                const editavel = linha.vinculado && podeGravar && !salvando
                const vrAdic = parseDecimal(linha.vrAdicTexto) ?? linha.vrAdicPercentual ?? 0
                return (
                  <div key={linha.itemId} className="flex w-max min-w-full items-stretch">
                    <div className="grade-fixo-esquerda w-52 shrink-0 border-r border-border px-2 py-2">
                      <div className="font-medium leading-snug">
                        {linha.produtoNome || linha.descricao || '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {linha.sku || (linha.vinculado ? '—' : 'Sem produto vinculado')}
                      </div>
                      {linha.recusaLocal && (
                        <p className="mt-1 text-xs text-destructive">{linha.recusaLocal}</p>
                      )}
                    </div>
                    <div className="flex w-max items-start py-1">
                      <CelulaLinha rotulo="Qtd">{formatarQtd(linha.quantidade)}</CelulaLinha>
                      <CelulaLinha rotulo="Tipo frete" alinhamento="left">
                        {linha.tipoFreteRotulo || '—'}
                      </CelulaLinha>
                      <CelulaLinha rotulo="Frete lançado">
                        {formatarMoeda(linha.custoFreteRateado)}
                      </CelulaLinha>
                      <CelulaLinha rotulo="Créd. ICMS">{formatarMoeda(linha.creditoIcms)}</CelulaLinha>
                      <CelulaLinha rotulo="Créd. PIS">{formatarMoeda(linha.creditoPis)}</CelulaLinha>
                      <CelulaLinha rotulo="Créd. COFINS">
                        {formatarMoeda(linha.creditoCofins)}
                      </CelulaLinha>
                      <CelulaLinha rotulo="% ICMS">{formatarPercentual(linha.aliquotaIcms)}</CelulaLinha>
                      <CelulaLinha rotulo="% PIS">{formatarPercentual(linha.aliquotaPis)}</CelulaLinha>
                      <CelulaLinha rotulo="% COFINS">
                        {formatarPercentual(linha.aliquotaCofins)}
                      </CelulaLinha>
                      <CelulaLinha rotulo="Custo comercial">
                        <span className="font-medium">{formatarMoeda(linha.custoComercial)}</span>
                      </CelulaLinha>
                      <CelulaLinha rotulo="Custo da entrada">
                        {formatarMoeda(linha.custoEntrada)}
                      </CelulaLinha>
                      <CelulaLinha rotulo="Custo anterior">
                        <div className="tabular-nums">{formatarMoeda(linha.custoAnterior)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatarData(linha.custoAnteriorData)}
                        </div>
                      </CelulaLinha>
                      <CelulaLinha rotulo="Variação">
                        <span
                          className={cn(
                            'tabular-nums',
                            destaque && 'font-semibold text-amber-700 dark:text-amber-400'
                          )}
                        >
                          {formatarPct(linha.variacaoPercentual)}
                        </span>
                      </CelulaLinha>
                      <CelulaLinha rotulo="Encargos %">
                        {formatarPercentual(linha.encargosPercentual)}
                      </CelulaLinha>
                      <CelulaLinha rotulo="% Vr.adic">
                        <Input
                          aria-label={`% Vr.adic do item ${linha.nItem}`}
                          className={CLASSE_INPUT_GRADE}
                          inputMode="decimal"
                          value={linha.vrAdicTexto}
                          disabled={!editavel}
                          onChange={(e) => atualizarVrAdic(linha.itemId, e.target.value)}
                        />
                      </CelulaLinha>
                      <CelulaLinha rotulo="Vr.adic R$">
                        {formatarMoeda(valorAdicionalReais(linha.custoComercial, vrAdic))}
                      </CelulaLinha>
                      <CelulaLinha rotulo="% Marg">
                        <Input
                          aria-label={`Margem % do item ${linha.nItem}`}
                          className={CLASSE_INPUT_GRADE}
                          inputMode="decimal"
                          value={linha.margemTexto}
                          disabled={!editavel}
                          onChange={(e) => atualizarMargem(linha.itemId, e.target.value)}
                        />
                      </CelulaLinha>
                      <CelulaLinha rotulo="Preço formado">
                        <Input
                          aria-label={`Preço formado do item ${linha.nItem}`}
                          className={CLASSE_INPUT_GRADE}
                          inputMode="decimal"
                          value={linha.precoTexto}
                          disabled={!editavel}
                          onChange={(e) => atualizarPreco(linha.itemId, e.target.value)}
                        />
                      </CelulaLinha>
                      <CelulaLinha rotulo="Preço atual">{formatarMoeda(linha.precoAtual)}</CelulaLinha>
                      <CelulaLinha rotulo="Estoque disp.">
                        {formatarQtd(linha.estoqueDisponivel)}
                      </CelulaLinha>
                    </div>
                  </div>
                )
              })}
            </div>
          </GradeRolavel>
        )}
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
