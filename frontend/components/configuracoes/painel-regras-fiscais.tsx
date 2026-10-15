'use client'

import { useEffect, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { InputPadrao } from '@/components/ui/input-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { CampoLookupCatalogo, type ItemCatalogo } from '@/components/compartilhado/campo-lookup-catalogo'

type Grupo = 'mercadoria' | 'transporte'
type Modo = 'nota' | 'pre_definida'
type Regra = { modo: Modo; aliquota: number | null }
type Formulario = Record<Grupo, { modo: Modo; aliquota: string }>
type RegraOperacao = { cfopEntradaId: string; cfopCodigo?: string; cfopNome?: string; tributo: string; cst: string; recuperabilidade: string; composicao: string }
const novaOperacao = (): RegraOperacao => ({ cfopEntradaId: '', tributo: 'icms', cst: '', recuperabilidade: 'revisao', composicao: 'embutido' })
const GRUPOS: Array<{ id: Grupo; rotulo: string }> = [
  { id: 'mercadoria', rotulo: 'Crédito de ICMS da mercadoria' },
  { id: 'transporte', rotulo: 'Crédito de ICMS do conhecimento de transporte' },
]

export function PainelRegrasFiscais() {
  const [form, setForm] = useState<Formulario>({ mercadoria: { modo: 'nota', aliquota: '' }, transporte: { modo: 'nota', aliquota: '' } })
  const [carregando, setCarregando] = useState(true)
  const [carregado, setCarregado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const [baseIcms, setBaseIcms] = useState('bruto')
  const [operacoes, setOperacoes] = useState<RegraOperacao[]>([])
  const [edicao, setEdicao] = useState<RegraOperacao | null>(null)
  const [indiceEdicao, setIndiceEdicao] = useState<number | null>(null)
  const [cfop, setCfop] = useState<ItemCatalogo | null>(null)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setCarregado(false)
    setErro('')
    clienteHttp.get<{ regras: Record<Grupo, Regra> & { baseIcms?: string; operacoes?: RegraOperacao[] } }>('/configuracoes/regras-fiscais').then(({ data }) => {
      if (!ativo) return
      setForm({
        mercadoria: { modo: data.regras.mercadoria.modo, aliquota: data.regras.mercadoria.aliquota?.toString() ?? '' },
        transporte: { modo: data.regras.transporte.modo, aliquota: data.regras.transporte.aliquota?.toString() ?? '' },
      })
      setCarregado(true)
      setBaseIcms(data.regras.baseIcms ?? 'bruto')
      setOperacoes(data.regras.operacoes ?? [])
    }).catch((e) => {
      if (ativo) setErro(extrairMensagemApi(e, 'Não foi possível carregar as regras fiscais.'))
    }).finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [tentativa])

  async function gravar(event: React.FormEvent) {
    event.preventDefault()
    if (salvando || !carregado) return
    if (edicao) { setErro('Adicione ou cancele a edição da regra antes de salvar.'); return }
    setErro('')
    setMensagem('')
    const regras = {} as Record<Grupo, Regra>
    for (const { id, rotulo } of GRUPOS) {
      const texto = form[id].aliquota.trim().replace(',', '.')
      const aliquota = texto === '' ? null : Number(texto)
      if (form[id].modo === 'pre_definida' && (aliquota == null || !Number.isFinite(aliquota) || aliquota < 0 || aliquota > 100)) {
        setErro(`${rotulo}: informe uma alíquota entre 0 e 100.`)
        return
      }
      regras[id] = { modo: form[id].modo, aliquota: form[id].modo === 'nota' ? null : aliquota }
    }
    setSalvando(true)
    try {
      await clienteHttp.put('/configuracoes/regras-fiscais', { ...regras, baseIcms, operacoes })
      setMensagem('Regras fiscais salvas')
    } catch (e) { setErro(extrairMensagemApi(e, 'Não foi possível salvar as regras fiscais.')) }
    finally { setSalvando(false) }
  }

  function editarOperacao(regra: RegraOperacao, indice: number | null) {
    setEdicao({ ...regra }); setIndiceEdicao(indice)
    setCfop(regra.cfopEntradaId ? { id: regra.cfopEntradaId, codigo: regra.cfopCodigo ?? '', descricao: regra.cfopNome ?? '' } : null)
  }
  function adicionarOperacao() {
    if (!edicao?.cfopEntradaId || !/^(\d{2,3}|sem_cst)$/.test(edicao.cst)) { setErro('Selecione CFOP de entrada e informe CST/CSOSN; para II use sem_cst.'); return }
    if (operacoes.some((r, i) => i !== indiceEdicao && r.cfopEntradaId === edicao.cfopEntradaId && r.tributo === edicao.tributo && r.cst === edicao.cst)) { setErro('Já existe regra para esta combinação. Use Editar.'); return }
    setOperacoes(atual => indiceEdicao == null ? [...atual, edicao] : atual.map((r, i) => i === indiceEdicao ? edicao : r))
    setEdicao(null); setIndiceEdicao(null); setErro(''); setMensagem('')
  }

  return (
    <CardPadrao titulo="Regras Fiscais" descricao="Empresa ativa: créditos usados na próxima precificação, inclusive de notas antigas. Alterar estas regras não recalcula os preços já gravados.">
      <form onSubmit={gravar} className="space-y-6">
        {carregando && <p role="status" className="text-sm text-muted-foreground">Carregando regras fiscais...</p>}
        {erro && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{erro}</p>}
        {mensagem && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{mensagem}</p>}
        {!carregando && !carregado && <BotaoPrimario type="button" onClick={() => setTentativa((n) => n + 1)}>Tentar novamente</BotaoPrimario>}
        {GRUPOS.map(({ id, rotulo }) => (
          <fieldset key={id} disabled={carregando || salvando || !carregado} className="space-y-3 rounded-lg border p-4">
            <legend className="px-2 text-sm font-medium">{rotulo}</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name={`modo-${id}`} value="nota" checked={form[id].modo === 'nota'}
                onChange={() => { setMensagem(''); setForm((f) => ({ ...f, [id]: { ...f[id], modo: 'nota' } })) }} />
              Puxar da nota de entrada
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name={`modo-${id}`} value="pre_definida" checked={form[id].modo === 'pre_definida'}
                  onChange={() => { setMensagem(''); setForm((f) => ({ ...f, [id]: { ...f[id], modo: 'pre_definida' } })) }} />
                Alíquota pré-definida
              </label>
              <div className="w-full sm:w-40">
                <InputPadrao id={`aliquota-${id}`} rotulo="Alíquota (%)" inputMode="decimal" value={form[id].aliquota}
                  disabled={form[id].modo !== 'pre_definida'} obrigatorio={form[id].modo === 'pre_definida'}
                  onChange={(e) => { setMensagem(''); setForm((f) => ({ ...f, [id]: { ...f[id], aliquota: e.target.value } })) }} />
              </div>
            </div>
          </fieldset>
        ))}
        <fieldset disabled={carregando || salvando || !carregado} className="space-y-4 rounded-lg border p-4">
          <legend className="px-2 text-sm font-medium">Aplicabilidade dos créditos e composição do custo</legend>
          <SelectPadrao rotulo="Base do ICMS pré-definido" valor={baseIcms} aoMudar={setBaseIcms} disabled={carregando || salvando || !carregado} opcoes={[{ value: 'bruto', label: 'Valor bruto (vProd)' }, { value: 'liquido', label: 'Valor líquido (vProd − vDesc)' }, { value: 'vbc', label: 'Base ICMS do XML (vBC)' }]} />
          <p className="text-sm text-muted-foreground">Créditos só são utilizados quando aplicáveis à empresa, CFOP de entrada e CST/CSOSN. Uma regra ausente deixa o item pendente. Para II, informe sem_cst.</p>
          {!operacoes.length && <p className="text-sm">Nenhuma regra por operação cadastrada.</p>}
          {operacoes.map((r, i) => <div key={`${r.cfopEntradaId}-${r.tributo}-${r.cst}`} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm"><span>{r.cfopCodigo ?? r.cfopEntradaId} · {r.cfopNome} · {r.tributo.toUpperCase()} · CST/CSOSN {r.cst} · {r.recuperabilidade.replaceAll('_', ' ')} · {r.composicao}</span><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => editarOperacao(r, i)}>Editar</Button><Button type="button" variant="outline" onClick={() => { setOperacoes(o => o.filter((_, n) => n !== i)); setEdicao(null) }}>Excluir</Button></div></div>)}
          <Button type="button" variant="outline" onClick={() => editarOperacao(novaOperacao(), null)}>Nova regra</Button>
          {edicao && <div className="grid gap-3 rounded border p-3 sm:grid-cols-2">
            <CampoLookupCatalogo rotulo="CFOP de entrada" endpoint="/cfops" queryParams="tipo=entrada" valor={cfop} aoSelecionar={c => { setCfop(c); setEdicao({ ...edicao, cfopEntradaId: c?.id ?? '', cfopCodigo: c?.codigo, cfopNome: c?.descricao }) }} />
            <SelectPadrao rotulo="Tributo" valor={edicao.tributo} aoMudar={v => setEdicao({ ...edicao, tributo: v, cst: v === 'ii' ? 'sem_cst' : edicao.cst, composicao: ['icms', 'pis', 'cofins', 'icms_frete'].includes(v) ? 'embutido' : 'adicional' })} opcoes={['icms', 'icms_st', 'fcp_st', 'ipi', 'ii', 'pis', 'cofins', 'icms_frete'].map(v => ({ value: v, label: v.toUpperCase().replaceAll('_', ' ') }))} />
            <InputPadrao rotulo="CST / CSOSN" value={edicao.cst} onChange={e => setEdicao({ ...edicao, cst: e.target.value.trim() })} />
            <SelectPadrao rotulo="Recuperabilidade" valor={edicao.recuperabilidade} aoMudar={v => setEdicao({ ...edicao, recuperabilidade: v })} opcoes={[{ value: 'aplicavel', label: 'Crédito aplicável' }, { value: 'nao_aplicavel', label: 'Crédito não aplicável' }, { value: 'revisao', label: 'Exige revisão fiscal' }]} />
            <SelectPadrao rotulo="Composição do tributo" valor={edicao.composicao} aoMudar={v => setEdicao({ ...edicao, composicao: v })} disabled={['icms', 'pis', 'cofins', 'icms_frete'].includes(edicao.tributo)} opcoes={[{ value: 'embutido', label: 'Já embutido no valor comercial' }, { value: 'adicional', label: 'Parcela adicional ao valor comercial' }]} />
            <div className="flex items-end gap-2"><Button type="button" onClick={adicionarOperacao}>Adicionar à lista</Button><Button type="button" variant="outline" onClick={() => setEdicao(null)}>Cancelar edição</Button></div>
          </div>}
        </fieldset>
        <BotaoPrimario type="submit" disabled={carregando || salvando || !carregado}>{salvando ? 'Salvando...' : 'Salvar'}</BotaoPrimario>
      </form>
    </CardPadrao>
  )
}
