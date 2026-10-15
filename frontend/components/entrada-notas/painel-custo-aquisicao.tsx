'use client'
import { useEffect, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'
import type { AjustesCusto, DadosFormacaoCusto, DespesaCusto, MemoriaCusto } from '@/lib/custo-aquisicao'
import { moedaCusto } from '@/lib/custo-aquisicao'
import { MemoriaCustoAquisicao } from './memoria-custo-aquisicao'

const novaDespesa = (): DespesaCusto => ({ id: crypto.randomUUID(), descricao: '', valor: 0, compoeCusto: true, nItem: null, criterio: 'valor', origem: 'externa' })
const textosBases = (a: AjustesCusto): Record<number, { peso: string; volume: string }> => Object.fromEntries(a.bases.map(b => [b.nItem, { peso: b.peso == null ? '' : String(b.peso), volume: b.volume == null ? '' : String(b.volume) }]))
export function PainelCustoAquisicao<T extends DadosFormacaoCusto>({ notaId, grade, podeEditar, ocupado, aoAtualizar, aoEditar }: { notaId: string; grade: T; podeEditar: boolean; ocupado: boolean; aoAtualizar: (grade: T) => void; aoEditar?: (editando: boolean) => void }) {
  const [aberto, setAberto] = useState(false)
  const [ajustes, setAjustes] = useState<AjustesCusto>(grade.ajustesCusto)
  const [despesa, setDespesa] = useState<DespesaCusto | null>(null)
  const [valorTexto, setValorTexto] = useState('')
  const [basesTexto, setBasesTexto] = useState(textosBases(grade.ajustesCusto))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [historico, setHistorico] = useState<{ id: string; nItem: number; createdAt: string; usuarioNome: string; dados: MemoriaCusto }[] | null>(null)
  const [simulacao, setSimulacao] = useState<{ itemId: string; nItem: number; memoria: MemoriaCusto }[] | null>(null)
  useEffect(() => { setAjustes(grade.ajustesCusto); setBasesTexto(textosBases(grade.ajustesCusto)); setSimulacao(null) }, [grade.ajustesCusto, grade.revisaoCusto])
  const alterado = JSON.stringify(ajustes) !== JSON.stringify(grade.ajustesCusto) || JSON.stringify(basesTexto) !== JSON.stringify(textosBases(grade.ajustesCusto))
  useEffect(() => { aoEditar?.(alterado || despesa != null || salvando) }, [alterado, despesa, salvando, aoEditar])
  const bloqueado = !podeEditar || salvando || ocupado
  const validos = grade.itens.filter(i => !i.memoria.pendencias.length && i.estadoCusto !== 'confirmado')
  function editar(d: DespesaCusto) { setDespesa({ ...d }); setValorTexto(String(d.valor)); setSimulacao(null) }
  function adicionar() {
    if (!despesa) return
    const valor = Number(valorTexto.replace(',', '.'))
    if (!despesa.descricao.trim() || !Number.isFinite(valor) || valor <= 0) { setErro('Informe descrição e valor positivo.'); return }
    const d = { ...despesa, valor }
    setAjustes(a => ({ ...a, despesas: [...a.despesas.filter(x => x.id !== d.id), d] }))
    setDespesa(null); setErro(''); setSimulacao(null)
  }
  async function executar(acao: 'ajustes' | 'confirmar-custo' | 'memorias' | 'previa') {
    if (salvando || ocupado) return
    if (despesa && acao !== 'memorias') { setErro('Adicione ou cancele a edição da despesa antes de continuar.'); return }
    if (acao === 'confirmar-custo' && alterado) { setErro('Salve os ajustes antes de confirmar custos.'); return }
    let enviar = ajustes
    if (acao === 'ajustes' || acao === 'previa') {
      const bases = Object.entries(basesTexto).map(([nItem, b]) => ({ nItem: Number(nItem), peso: b.peso.trim() ? Number(b.peso.replace(',', '.')) : null, volume: b.volume.trim() ? Number(b.volume.replace(',', '.')) : null }))
      if (bases.some(b => [b.peso, b.volume].some(v => v != null && (!Number.isFinite(v) || v <= 0)))) { setErro('Peso e volume devem ser positivos ou ficar em branco.'); return }
      enviar = { ...ajustes, bases }
    }
    setSalvando(true); setErro(''); setMensagem('')
    try {
      const url = `/entrada-notas/${notaId}/precificacao`
      if (acao === 'memorias') {
        const { data } = await clienteHttp.get<{ memorias: NonNullable<typeof historico> }>(`${url}/memorias`)
        setHistorico(data.memorias)
      } else if (acao === 'previa') {
        const { data } = await clienteHttp.post<{ itens: NonNullable<typeof simulacao> }>(`${url}/ajustes/previa`, { revisao: grade.revisaoCusto, ajustes: enviar })
        setSimulacao(data.itens)
      } else {
        const { data } = acao === 'ajustes'
          ? await clienteHttp.put<T>(`${url}/ajustes`, { revisao: grade.revisaoCusto, ajustes: enviar })
          : await clienteHttp.post<T>(`${url}/confirmar-custo`, { revisao: grade.revisaoCusto, itemIds: validos.map(i => i.itemId) })
        aoAtualizar(data); setMensagem(acao === 'ajustes' ? 'Ajustes salvos. Confira e confirme os custos válidos.' : 'Custos confirmados. Os preços já podem ser gravados.')
      }
    } catch (e) { setErro(extrairMensagemApi(e, 'Não foi possível concluir a ação.')) }
    finally { setSalvando(false) }
  }
  return <CardPadrao titulo="Formação de custo" descricao="Confira despesas e créditos antes de confirmar o custo. O estoque e os preços já gravados permanecem preservados.">
    <div className="flex flex-wrap items-center gap-2 text-sm"><span>{grade.itens.filter(i => i.estadoCusto === 'confirmado').length} confirmados · {grade.itens.filter(i => i.estadoCusto === 'pendente').length} pendentes</span>
      <Button type="button" variant="outline" onClick={() => setAberto(a => !a)}>Despesas e rateio</Button>
      <Button type="button" disabled={bloqueado || !validos.length} onClick={() => void executar('confirmar-custo')}>Confirmar custos válidos</Button>
      <Button type="button" variant="outline" disabled={salvando || ocupado} onClick={() => void executar('memorias')}>Histórico de memórias</Button>
    </div>
    {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
    {mensagem && <p role="status" className="mt-3 text-sm text-emerald-700">{mensagem}</p>}
    {!!grade.pendenciasCusto.length && <ul className="mt-3 list-inside list-disc text-sm text-destructive">{grade.pendenciasCusto.map(p => <li key={p}>{p}</li>)}</ul>}
    {aberto && <fieldset disabled={bloqueado} className="mt-4 space-y-4 rounded-md border p-4">
      <legend className="px-2 text-sm font-medium">Despesas e rateio</legend>
      <SelectPadrao rotulo="Conferência de frete NF-e e CT-e" valor={ajustes.decisaoFrete ?? ''} aoMudar={v => { setAjustes(a => ({ ...a, decisaoFrete: (v || null) as AjustesCusto['decisaoFrete'] })); setSimulacao(null) }} opcoes={[{ value: '', label: 'Ainda não conferido' }, { value: 'distintos', label: 'São despesas distintas: somar ambos' }, { value: 'nfe', label: 'Mesmo frete: usar somente NF-e' }, { value: 'cte', label: 'Mesmo frete: usar somente CT-e' }]} disabled={bloqueado} />
      {grade.residuaisCusto.map(r => <div key={r.origem} className="flex flex-wrap items-center gap-2 text-sm"><span>Diferença não distribuída: {r.origem.replace('residual_', '')} · {moedaCusto(r.valor)}</span><Button type="button" variant="outline" onClick={() => editar(ajustes.despesas.find(d => d.origem === r.origem) ?? { ...novaDespesa(), descricao: `Diferença ${r.origem.replace('residual_', '')} da NF-e`, valor: r.valor, origem: r.origem })}>Conferir e ratear</Button></div>)}
      {!ajustes.despesas.length && <p className="text-sm text-muted-foreground">Nenhuma despesa adicional.</p>}
      {ajustes.despesas.map(d => <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm"><span>{d.descricao} · {moedaCusto(d.valor)} · {d.nItem == null ? `Rateio por ${d.criterio}` : `Item ${d.nItem}`} · {d.compoeCusto ? 'Compõe custo' : 'Excluída'}</span><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => editar(d)}>Editar</Button><Button type="button" variant="outline" onClick={() => { setAjustes(a => ({ ...a, despesas: a.despesas.filter(x => x.id !== d.id) })); setSimulacao(null) }}>Excluir</Button></div></div>)}
      <Button type="button" variant="outline" onClick={() => editar(novaDespesa())}>Nova despesa</Button>
      <details><summary className="cursor-pointer text-sm font-medium">Despesas do XML que compõem o custo</summary><div className="mt-3 space-y-2">{grade.itens.flatMap(i => (['seguro', 'outras'] as const).filter(campo => Number(i.memoria.original?.[campo] ?? 0) > 0).map(campo => <label key={`${i.itemId}-${campo}`} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!ajustes.exclusoesXml?.some(e => e.nItem === i.nItem && e.campo === campo)} onChange={e => { const incluir = e.target.checked; setAjustes(a => ({ ...a, exclusoesXml: [...(a.exclusoesXml ?? []).filter(x => x.nItem !== i.nItem || x.campo !== campo), ...(incluir ? [] : [{ nItem: i.nItem, campo }])] })); setSimulacao(null) }} />Item {i.nItem} · {campo === 'seguro' ? 'Seguro' : 'Outras despesas'} · {moedaCusto(Number(i.memoria.original?.[campo]))} compõe custo</label>))}</div></details>
      {despesa && <div className="grid gap-3 rounded border p-3 sm:grid-cols-2">
        <InputPadrao rotulo="Descrição" value={despesa.descricao} onChange={e => setDespesa({ ...despesa, descricao: e.target.value })} />
        <InputPadrao rotulo="Valor (R$)" inputMode="decimal" value={valorTexto} onChange={e => setValorTexto(e.target.value)} disabled={despesa.origem !== 'externa'} />
        <SelectPadrao rotulo="Destino" valor={despesa.nItem == null ? 'nota' : String(despesa.nItem)} aoMudar={v => setDespesa({ ...despesa, nItem: v === 'nota' ? null : Number(v) })} opcoes={[{ value: 'nota', label: 'Ratear entre todos os itens' }, ...grade.itens.map(i => ({ value: String(i.nItem), label: `Item ${i.nItem} · ${i.descricao ?? ''}` }))]} />
        <SelectPadrao rotulo="Critério de rateio" valor={despesa.criterio} aoMudar={v => setDespesa({ ...despesa, criterio: v as DespesaCusto['criterio'] })} opcoes={['valor', 'quantidade', 'peso', 'volume'].map(value => ({ value, label: value === 'valor' ? 'Valor líquido dos produtos' : value }))} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={despesa.compoeCusto} onChange={e => setDespesa({ ...despesa, compoeCusto: e.target.checked })} />Compõe o custo de aquisição</label>
        <div className="flex gap-2"><Button type="button" onClick={adicionar}>Adicionar à lista</Button><Button type="button" variant="outline" onClick={() => setDespesa(null)}>Cancelar edição</Button></div>
      </div>}
      <details><summary className="cursor-pointer text-sm font-medium">Peso e volume totais por item</summary><div className="mt-3 space-y-2">{grade.itens.map(i => {
        const b = basesTexto[i.nItem] ?? { peso: '', volume: '' }
        return <div key={i.itemId} className="grid gap-2 sm:grid-cols-3"><span className="text-sm">Item {i.nItem} · {i.descricao}</span>{(['peso', 'volume'] as const).map(campo => <InputPadrao key={campo} rotulo={`${campo === 'peso' ? 'Peso total (kg)' : 'Volume total (m³)'} do item ${i.nItem}`} inputMode="decimal" value={b[campo]} onChange={e => { const texto = e.target.value; setBasesTexto(a => ({ ...a, [i.nItem]: { ...b, [campo]: texto } })); setSimulacao(null) }} />)}</div>
      })}</div></details>
      <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => void executar('previa')}>Simular rateio</Button><Button type="button" onClick={() => void executar('ajustes')}>Salvar ajustes</Button><Button type="button" variant="outline" onClick={() => { setAjustes(grade.ajustesCusto); setBasesTexto(textosBases(grade.ajustesCusto)); setDespesa(null); setSimulacao(null) }}>Descartar edição</Button></div>
      {simulacao?.map(i => <details key={i.itemId}><summary className="cursor-pointer text-sm">Prévia item {i.nItem} · {moedaCusto(i.memoria.total)}</summary><MemoriaCustoAquisicao memoria={i.memoria} /></details>)}
    </fieldset>}
    {historico && <div className="mt-4 space-y-3"><h3 className="text-sm font-medium">Memórias confirmadas</h3>{!historico.length && <p className="text-sm text-muted-foreground">Nenhuma confirmação registrada.</p>}{historico.map(m => <details key={m.id} className="rounded border p-3"><summary className="cursor-pointer text-sm">Item {m.nItem} · {new Date(m.createdAt).toLocaleString('pt-BR')} · {m.usuarioNome}</summary><MemoriaCustoAquisicao memoria={m.dados} /></details>)}</div>}
  </CardPadrao>
}
