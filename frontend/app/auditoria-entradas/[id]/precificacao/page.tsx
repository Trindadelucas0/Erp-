'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { usePermissao } from '@/hooks/use-permissao'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { extrairSerieNumeroChave } from '@/lib/chave-acesso-nfe'
import { calcularAquisicao, margemPorPreco, percentualDe, precoPorMargem, type AjustesPrecificacao, type BasePrecificacao } from '@/lib/calculo-precificacao'
import { CardPadrao } from '@/components/ui/card-padrao'
import { GradeRolavel } from '@/components/ui/grade-rolavel'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectPadrao } from '@/components/ui/select-padrao'

type Item = {
  itemId: string; nItem: number; produtoId: string | null; produtoNome: string | null; descricao: string | null; sku: string | null; vinculado: boolean
  base: BasePrecificacao; revisao: number; origem: string; precoAtual: number | null; precoAtacadoAtual: number | null; estoqueDisponivel: number | null
  parametros: { ajustes: AjustesPrecificacao; margemPercentual: number; margemAtacado: number | null }
}
type Grade = {
  nota: { chaveNfe: string; nomeEmitente: string | null; dataEmissao: string | null }
  encargosPercentual: number; parametrizacaoCadastrada: boolean; regrasFiscais: unknown
  parametrizacao: { jurosMensaisCustoFinanOperac?: number | null; aliquotaCbs?: number | null; aliquotaIbs?: number | null }
  itens: Item[]
}
type Linha = Item & { ajustes: AjustesPrecificacao; margem: string; preco: string; margemAtacado: string; precoAtacado: string; textos: Record<string, string>; erroServidor: string | null }
type CampoNumerico = Exclude<keyof AjustesPrecificacao, 'tipoFrete' | 'tipoSt' | 'transporteSimples'>
const numero = (texto: string) => texto.trim() && Number.isFinite(Number(texto.replace(',', '.'))) ? Number(texto.replace(',', '.')) : null
const texto = (valor: number | null | undefined) => valor == null ? '' : String(valor)
const moeda = (valor: number | null | undefined) => valor == null ? '—' : valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const percentual = (valor: number | null) => valor == null ? '—' : `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const camposNumericos: { campo: CampoNumerico; rotulo: string }[] = [
  { campo: 'precoTabela', rotulo: 'Preço tabela' }, { campo: 'descontoPercentual', rotulo: '% Desc.' },
  { campo: 'descontoDestaquePercentual', rotulo: '% Desc. destaque' }, { campo: 'ipiPercentual', rotulo: '% Custo IPI' },
  { campo: 'outrasPercentual', rotulo: '% Outras despesas' }, { campo: 'fretePercentual', rotulo: '% Frete' },
  { campo: 'freteValor', rotulo: 'Valor frete' }, { campo: 'stPercentual', rotulo: '% ST' },
  { campo: 'creditoIcmsPercentual', rotulo: 'Créd. % ICMS' }, { campo: 'creditoIcmsFretePercentual', rotulo: 'Créd. % ICMS frete' },
  { campo: 'pisCofinsPercentual', rotulo: '% PIS/COFINS' }, { campo: 'adicionalPercentual', rotulo: '% Custo adicional' },
  { campo: 'adicionalValor', rotulo: 'Valor adicional' },
]

function iniciar(item: Item, encargos: number): Linha {
  const ajustes = item.parametros.ajustes
  const custo = calcularAquisicao(item.base, ajustes).custo
  return { ...item, ajustes, margem: texto(item.parametros.margemPercentual), preco: texto(precoPorMargem(custo, encargos, item.parametros.margemPercentual)),
    margemAtacado: texto(item.parametros.margemAtacado), precoAtacado: texto(item.parametros.margemAtacado == null ? null : precoPorMargem(custo, encargos, item.parametros.margemAtacado)), textos: {}, erroServidor: null }
}

function erroDaLinha(linha: Linha, encargos: number) {
  if (!linha.vinculado) return 'Sem produto vinculado.'
  if (Object.values(linha.textos).some(t => numero(t) == null)) return 'Preencha os adicionais com números válidos.'
  const custo = calcularAquisicao(linha.base, linha.ajustes)
  if (custo.erro) return custo.erro
  if (numero(linha.preco) == null || numero(linha.preco)! <= 0 || numero(linha.margem) == null || precoPorMargem(custo.custo, encargos, numero(linha.margem)!) == null) return 'Informe preço e margem válidos; a carga deve ser menor que 100%.'
  if (linha.margemAtacado !== '' || linha.precoAtacado !== '') {
    if (numero(linha.precoAtacado) == null || numero(linha.precoAtacado)! <= 0 || numero(linha.margemAtacado) == null || precoPorMargem(custo.custo, encargos, numero(linha.margemAtacado)!) == null) return 'Informe preço e margem de atacado válidos; a carga deve ser menor que 100%.'
  }
  return linha.erroServidor
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <div className="min-w-0 p-2 md:w-32 md:shrink-0 md:border-r"><div className="mb-1 text-xs font-medium text-muted-foreground">{rotulo}</div><div className="text-sm tabular-nums">{children}</div></div>
}

function valorDoCampo(l: Linha, campo: CampoNumerico): number | null {
  const b = l.base, a = l.ajustes, r = calcularAquisicao(b, a)
  if (a[campo] != null) return a[campo]!
  const base = r.mercadoria
  switch (campo) {
    case 'precoTabela': return b.precoTabela
    case 'descontoPercentual': return percentualDe(b.desconto, a.precoTabela ?? b.precoTabela ?? 0)
    case 'descontoDestaquePercentual': return 0
    case 'ipiPercentual': return percentualDe(b.ipi, base)
    case 'outrasPercentual': return percentualDe(b.outras, base)
    case 'fretePercentual': return percentualDe(r.frete, base)
    case 'freteValor': return r.frete
    case 'stPercentual': return percentualDe(r.st, base)
    case 'creditoIcmsPercentual': return percentualDe(b.creditoIcms, base)
    case 'creditoIcmsFretePercentual': return percentualDe(r.creditoFrete, r.frete)
    case 'pisCofinsPercentual': return percentualDe(b.creditoPisCofins, base)
    case 'adicionalPercentual': return percentualDe(r.adicional, r.subtotal)
    case 'adicionalValor': return r.adicional
  }
}

function ConteudoPrecificacao() {
  const { id: parametroId } = useParams()
  const id = typeof parametroId === 'string' ? parametroId : ''
  const podeGravar = usePermissao('produtos:edit')
  const [grade, setGrade] = useState<Grade | null>(null)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [selecao, setSelecao] = useState<Record<string, string>>({})
  const versoes = useRef<Record<string, number>>({})
  const encargos = grade?.encargosPercentual ?? 0
  const receber = useCallback((dados: Grade) => { setGrade(dados); setLinhas(dados.itens.map(item => iniciar(item, dados.encargosPercentual))) }, [])
  const carregar = useCallback(async () => {
    setCarregando(true)
    try { const { data } = await clienteHttp.get<Grade>(`/entrada-notas/${id}/precificacao`); receber(data); setErro('') }
    catch (e) { setErro(extrairMensagemApi(e, 'Não foi possível abrir a precificação.')) }
    finally { setCarregando(false) }
  }, [id, receber])
  useEffect(() => { if (id) void carregar() }, [id, carregar])

  function alterar(itemId: string, atualizar: (linha: Linha) => Linha) {
    versoes.current[itemId] = (versoes.current[itemId] ?? 0) + 1
    setMensagem('')
    setLinhas(atuais => atuais.map(l => l.itemId === itemId ? { ...atualizar(l), erroServidor: null } : l))
  }
  function recalcular(l: Linha): Linha {
    const custo = calcularAquisicao(l.base, l.ajustes).custo
    return { ...l, preco: texto(numero(l.margem) == null ? null : precoPorMargem(custo, encargos, numero(l.margem)!)), precoAtacado: texto(numero(l.margemAtacado) == null ? null : precoPorMargem(custo, encargos, numero(l.margemAtacado)!)) }
  }
  function editarAdicional(itemId: string, campo: CampoNumerico, valor: string) {
    alterar(itemId, l => {
      const ajustes = { ...l.ajustes }, textos = { ...l.textos, [campo]: valor }
      const pares: Partial<Record<CampoNumerico, CampoNumerico>> = { freteValor: 'fretePercentual', fretePercentual: 'freteValor', adicionalValor: 'adicionalPercentual', adicionalPercentual: 'adicionalValor' }
      const par = pares[campo]
      if (par) { delete ajustes[par]; delete textos[par] }
      const n = numero(valor)
      if (n != null) ajustes[campo] = n
      return recalcular({ ...l, ajustes, textos })
    })
  }
  function editarPrecoMargem(itemId: string, campo: 'margem' | 'preco' | 'margemAtacado' | 'precoAtacado', valor: string) {
    alterar(itemId, l => {
      const custo = calcularAquisicao(l.base, l.ajustes).custo, n = numero(valor)
      if (campo === 'margem') return { ...l, margem: valor, preco: texto(n == null ? null : precoPorMargem(custo, encargos, n)) }
      if (campo === 'margemAtacado') return { ...l, margemAtacado: valor, precoAtacado: texto(n == null ? null : precoPorMargem(custo, encargos, n)) }
      if (campo === 'preco') return { ...l, preco: valor, margem: texto(margemPorPreco(custo, encargos, n)) }
      return { ...l, precoAtacado: valor, margemAtacado: texto(margemPorPreco(custo, encargos, n)) }
    })
  }
  async function simular(l: Linha) {
    if (erroDaLinha(l, encargos) || !podeGravar || salvando) return
    const versao = versoes.current[l.itemId] ?? 0
    try {
      const { data } = await clienteHttp.post<{ erro: string | null; origem: string }>(`/entrada-notas/${id}/precificacao/simular`, { itemId: l.itemId, ajustes: l.ajustes, margemPercentual: numero(l.margem), margemAtacado: numero(l.margemAtacado) })
      if (versao === (versoes.current[l.itemId] ?? 0)) setLinhas(atuais => atuais.map(x => x.itemId === l.itemId ? { ...x, erroServidor: data.origem !== l.origem ? 'Os dados mudaram. Recarregue a tela antes de gravar.' : data.erro } : x))
    } catch (e) {
      if (versao === (versoes.current[l.itemId] ?? 0)) setLinhas(atuais => atuais.map(x => x.itemId === l.itemId ? { ...x, erroServidor: extrairMensagemApi(e, 'Não foi possível validar a simulação.') } : x))
    }
  }
  const repetido = (l: Linha) => linhas.filter(x => x.produtoId === l.produtoId).length > 1
  const validas = linhas.filter(l => l.produtoId && !erroDaLinha(l, encargos) && (!repetido(l) || selecao[l.produtoId] === l.itemId))
  async function gravar() {
    if (!podeGravar || salvando || !validas.length) return
    setSalvando(true); setErro(''); setMensagem('')
    for (const l of linhas) versoes.current[l.itemId] = (versoes.current[l.itemId] ?? 0) + 1
    try {
      const { data } = await clienteHttp.put<Grade>(`/entrada-notas/${id}/precificacao`, { regrasFiscais: grade?.regrasFiscais, itens: validas.map(l => ({
        itemId: l.itemId, produtoId: l.produtoId, ajustes: l.ajustes, revisao: l.revisao, origem: l.origem,
        precoVenda: numero(l.preco), margemPercentual: numero(l.margem), margemAtacado: numero(l.margemAtacado),
        ...(numero(l.precoAtacado) != null ? { precoAtacado: numero(l.precoAtacado) } : {}),
      })) })
      const gravados = new Set(validas.map(l => l.itemId))
      setGrade(data)
      setLinhas(atuais => data.itens.map(i => gravados.has(i.itemId) ? iniciar(i, data.encargosPercentual) : atuais.find(l => l.itemId === i.itemId) ?? iniciar(i, data.encargosPercentual)))
      setMensagem(`${validas.length} produto(s) com preços gravados. As demais linhas foram preservadas.`)
    } catch (e) { setErro(extrairMensagemApi(e, 'Não foi possível gravar os preços.')) }
    finally { setSalvando(false) }
  }

  if (carregando) return <p className="text-sm text-muted-foreground">Carregando precificação…</p>
  if (!grade) return <div role="alert">{erro}<Button onClick={() => void carregar()}>Tentar novamente</Button></div>
  const { numero: numeroNota, serie } = extrairSerieNumeroChave(grade.nota.chaveNfe)
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><TituloPagina>Precificação</TituloPagina><div className="flex gap-2"><Button asChild variant="outline"><Link href={`/auditoria-entradas/${id}`}>Dossiê da nota</Link></Button><Button asChild variant="outline"><Link href="/auditoria-entradas">Voltar à lista</Link></Button></div></div>
    {erro && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{erro}</p>}
    {mensagem && <p role="status" className="rounded-md border border-emerald-500/30 p-3 text-sm">{mensagem}</p>}
    <CardPadrao titulo="Nota"><div className="flex flex-wrap gap-6 text-sm"><span><span className="text-muted-foreground">Fornecedor: </span>{grade.nota.nomeEmitente || '—'}</span><span><span className="text-muted-foreground">Nº / série: </span>{numeroNota || '—'} / {serie || '—'}</span><span><span className="text-muted-foreground">Emissão: </span>{grade.nota.dataEmissao ? new Date(grade.nota.dataEmissao).toLocaleDateString('pt-BR') : '—'}</span></div></CardPadrao>
    {!grade.parametrizacaoCadastrada && <p className="rounded-md border border-amber-400 p-3 text-sm">Não há percentuais gravados para esta empresa. O custo de venda está em 0%. <Link className="underline" href="/configuracoes?aba=vendas">Abrir Configurações → Vendas</Link></p>}
    <CardPadrao titulo={`Produtos · ${linhas.length} produto(s)`}>
      <p className="mb-3 text-xs text-muted-foreground">Ajuste margem ou preço. Abra Campos adicionais para conferir e ajustar a composição do custo. Os preços atuais são apenas para comparação.</p>
      {!linhas.length ? <p>Nenhum item nesta nota.</p> : <GradeRolavel><div className="min-w-full divide-y rounded-md border md:w-max">
        {linhas.map(l => {
          const aquisicao = calcularAquisicao(l.base, l.ajustes), erroLinha = erroDaLinha(l, encargos)
          const editavel = podeGravar && l.vinculado && !salvando
          const entrada = (campo: 'margem' | 'preco' | 'margemAtacado' | 'precoAtacado', rotulo: string, aria: string) => <Campo rotulo={rotulo}><Input aria-label={`${aria} do item ${l.nItem}`} inputMode="decimal" className="h-11 text-right md:h-8" value={l[campo]} disabled={!editavel} onChange={e => editarPrecoMargem(l.itemId, campo, e.target.value)} onBlur={() => void simular(l)} /></Campo>
          return <section key={l.itemId} aria-label={`Produto ${l.nItem}`} className="md:w-max md:min-w-full">
            <div className="grid grid-cols-2 md:flex md:items-stretch">
              <div className="col-span-2 border-b bg-background p-2 md:sticky md:left-0 md:z-10 md:w-72 md:shrink-0 md:border-b-0 md:border-r"><div className="flex gap-3"><div className="w-16 shrink-0"><div className="text-xs text-muted-foreground">Produto</div><div className="mt-1 text-sm">{l.sku || '—'}</div></div><div><div className="text-xs text-muted-foreground">Nome</div><div className="mt-1 text-sm font-medium">{l.produtoNome || l.descricao || '—'}</div></div></div>
                {repetido(l) && l.produtoId && <label className="mt-2 flex items-center gap-2 text-xs"><input type="radio" name={`produto-${l.produtoId}`} checked={selecao[l.produtoId] === l.itemId} disabled={!editavel} onChange={() => setSelecao(s => ({ ...s, [l.produtoId!]: l.itemId }))} />Usar esta linha para o preço</label>}
              </div>
              <Campo rotulo="Custo de aquisição"><span className="font-semibold text-primary">{moeda(aquisicao.custo)}</span></Campo>
              {entrada('margem', '% Margem', 'Margem %')}{entrada('preco', 'Preço de venda', 'Preço de venda')}
              <Campo rotulo="Preço de venda atual">{moeda(l.precoAtual)}</Campo>
              {entrada('margemAtacado', '% Margem atacado', 'Margem atacado %')}{entrada('precoAtacado', 'Preço atacado', 'Preço atacado')}
              <Campo rotulo="Preço atacado atual">{moeda(l.precoAtacadoAtual)}</Campo>
              <Campo rotulo="% Margem atual">{percentual(margemPorPreco(aquisicao.custo, encargos, l.precoAtual))}</Campo>
              <Campo rotulo="% Margem atacado atual">{percentual(margemPorPreco(aquisicao.custo, encargos, l.precoAtacadoAtual))}</Campo>
              <Campo rotulo="Estoque disponível">{l.estoqueDisponivel == null ? '—' : l.estoqueDisponivel.toLocaleString('pt-BR')}</Campo>
            </div>
            {erroLinha && <p role="alert" className="px-3 py-1 text-xs text-destructive">{erroLinha}</p>}
            <details className="group border-t border-amber-300/60 bg-amber-50/70 dark:bg-amber-950/20">
              <summary className="min-h-11 cursor-pointer list-none px-3 py-3 text-xs md:min-h-0 md:py-2 font-semibold text-amber-900 dark:text-amber-200"><span className="inline-block w-5 group-open:hidden" aria-hidden="true">+</span><span className="hidden w-5 group-open:inline-block" aria-hidden="true">−</span>Campos adicionais <span className="ml-2 font-normal">Abrir / recolher</span></summary>
              <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:max-w-[100rem] md:grid-cols-8">
                {camposNumericos.map(({ campo, rotulo }) => <label key={campo} className="min-w-0 text-xs font-medium">{rotulo}<Input aria-label={`${rotulo} do item ${l.nItem}`} inputMode="decimal" className="mt-1 h-11 bg-background text-right md:h-8" value={l.textos[campo] ?? texto(valorDoCampo(l, campo) == null ? null : Math.round(valorDoCampo(l, campo)! * 1e6) / 1e6)} disabled={!editavel || (campo === 'stPercentual' && (l.ajustes.tipoSt ?? (l.base.st > 0 ? 'nota' : 'sem')) !== 'adicional')} onChange={e => editarAdicional(l.itemId, campo, e.target.value)} onBlur={() => void simular(l)} /></label>)}
                <SelectPadrao id={`frete-${l.itemId}`} rotulo="Tipo frete" obrigatorio compacto className="h-11 md:h-8" valor={l.ajustes.tipoFrete ?? l.base.tipoFrete} disabled={!editavel} opcoes={[{ value: '0', label: 'Remetente' }, { value: '1', label: 'Destinatário' }, { value: '2', label: 'Terceiros' }, { value: '3', label: 'Próprio remetente' }, { value: '4', label: 'Próprio destinatário' }, { value: '9', label: 'Sem frete' }]} aoMudar={valor => alterar(l.itemId, x => recalcular({ ...x, ajustes: { ...x.ajustes, tipoFrete: valor } }))} />
                <SelectPadrao id={`simples-${l.itemId}`} rotulo="Transp. no Simples" compacto className="h-11 md:h-8" valor={(l.ajustes.transporteSimples === undefined ? l.base.transporteSimples : l.ajustes.transporteSimples) == null ? '' : (l.ajustes.transporteSimples ?? l.base.transporteSimples) ? 'sim' : 'nao'} disabled={!editavel} opcoes={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]} aoMudar={valor => alterar(l.itemId, x => recalcular({ ...x, ajustes: { ...x.ajustes, transporteSimples: valor === '' ? null : valor === 'sim' } }))} />
                <SelectPadrao id={`st-${l.itemId}`} rotulo="Tipo ST" obrigatorio compacto className="h-11 md:h-8" valor={l.ajustes.tipoSt ?? (l.base.st > 0 ? 'nota' : 'sem')} disabled={!editavel} opcoes={[{ value: 'sem', label: 'Sem ST' }, { value: 'nota', label: 'ST na nota' }, { value: 'adicional', label: 'ST adicional' }]} aoMudar={valor => alterar(l.itemId, x => recalcular({ ...x, ajustes: { ...x.ajustes, tipoSt: valor as AjustesPrecificacao['tipoSt'] } }))} />
                <div className="text-xs"><span className="font-medium">% Custo de venda</span><p className="mt-2 tabular-nums">{percentual(encargos)}</p><Link className="underline" href="/configuracoes?aba=vendas">Configurações → Vendas</Link></div>
              </div>
              <p className="px-3 pb-3 text-xs text-muted-foreground">Ajustes comerciais desta linha. Não alteram os dados da nota nem o estoque. Percentual e valor de frete/adicional representam o mesmo componente. ST adicional é ajuste comercial, sem apuração de imposto.</p>
            </details>
          </section>
        })}
      </div></GradeRolavel>}
      <div className="mt-4 flex flex-wrap items-center gap-3"><BotaoPrimario onClick={() => void gravar()} disabled={!podeGravar || salvando || !validas.length}>{salvando ? 'Gravando…' : 'Gravar preços válidos'}</BotaoPrimario><span className="text-xs text-muted-foreground">{validas.length} de {linhas.length} linha(s) apta(s) para gravar.</span>{!podeGravar && <p className="text-xs">É preciso a permissão de editar produtos para gravar os preços.</p>}</div>
    </CardPadrao>
    <details className="rounded-md border px-3 py-2 text-xs"><summary className="cursor-pointer">Determinante de Vendas</summary><p className="mt-2">Custo de venda: {percentual(encargos)}. Juros mensais: {percentual(grade.parametrizacao.jurosMensaisCustoFinanOperac ?? null)}. CBS: {percentual(grade.parametrizacao.aliquotaCbs ?? null)}. IBS: {percentual(grade.parametrizacao.aliquotaIbs ?? null)}. Juros, CBS e IBS permanecem fora do cálculo.</p></details>
  </div>
}

export default function PaginaPrecificacaoEntrada() {
  return <ProtegerRota chaveDaPagina="auditoria-entradas"><ConteudoPrecificacao /></ProtegerRota>
}
