'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileUp, Link2, Loader2, Plus, Search, Unlink } from 'lucide-react'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Input } from '@/components/ui/input'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { usePermissao } from '@/hooks/use-permissao'
import {
  dataHojeIso,
  dataInicioMesIso,
  formatarDataBr,
  ROTULOS_STATUS,
  type ConsultaConciliacaoResposta,
  type LinhaExtrato,
  type MovimentoSistema,
} from '@/lib/conciliacao-bancaria'
import { formatarMoedaBr } from '@/lib/contas-a-pagar'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { clienteHttp } from '@/services/api'

type Conta = { id: string; nome: string; tipo: string; ativo: boolean }
type Plano = { id: string; nome: string; codigo?: string; tipo?: string }

const VAZIO: ConsultaConciliacaoResposta = {
  totais: {
    totalExtrato: 0,
    conciliado: 0,
    pendente: 0,
    naoIdentificado: 0,
    quantidadeExtrato: 0,
    quantidadeConciliada: 0,
    quantidadePendente: 0,
    quantidadeNaoIdentificada: 0,
  },
  extrato: { linhas: [], pagina: 1, total: 0 },
  sistema: { linhas: [], pagina: 1, total: 0 },
  sugestoes: [],
}

function classeStatus(status: string) {
  if (status === 'conciliado') return 'bg-emerald-100 text-emerald-700'
  if (status === 'pendente') return 'bg-amber-100 text-amber-700'
  return 'bg-rose-100 text-rose-700'
}

function ArquivoParaBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result).split(',')[1] ?? '')
    leitor.onerror = reject
    leitor.readAsDataURL(arquivo)
  })
}

function LinhaCheckbox({
  marcada,
  aoMudar,
  children,
}: {
  marcada: boolean
  aoMudar: () => void
  children: React.ReactNode
}) {
  return (
    <tr className={marcada ? 'bg-primary/5' : undefined}>
      <td className="px-3 py-2">
        <input type="checkbox" checked={marcada} onChange={aoMudar} aria-label="Selecionar linha" />
      </td>
      {children}
    </tr>
  )
}

export function TelaConciliacaoBancaria() {
  const podeEditar = usePermissao('financeiro:edit')
  const arquivoRef = useRef<HTMLInputElement>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [planos, setPlanos] = useState<Plano[]>([])
  const [contaEmpresaId, setContaEmpresaId] = useState('')
  const [dataDe, setDataDe] = useState(dataInicioMesIso())
  const [dataAte, setDataAte] = useState(dataHojeIso())
  const [tipo, setTipo] = useState('')
  const [status, setStatus] = useState('')
  const [extratoId, setExtratoId] = useState('')
  const [resultado, setResultado] = useState(VAZIO)
  const [linhasSelecionadas, setLinhasSelecionadas] = useState<string[]>([])
  const [baixasSelecionadas, setBaixasSelecionadas] = useState<string[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [importando, setImportando] = useState(false)
  const [modalLancamento, setModalLancamento] = useState(false)
  const [salvandoLancamento, setSalvandoLancamento] = useState(false)
  const [form, setForm] = useState({
    direcao: 'saida',
    planoFinanceiroId: '',
    data: dataHojeIso(),
    valor: '',
    historico: '',
    documento: '',
  })

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search)
    setExtratoId(parametros.get('extratoId') ?? '')
    setContaEmpresaId(parametros.get('contaEmpresaId') ?? '')
    Promise.all([
      clienteHttp.get<{ contas: Conta[] }>('/contas', { params: { somenteAtivos: true } }),
      clienteHttp.get('/planos-financeiros'),
    ])
      .then(([resContas, resPlanos]) => {
        setContas(resContas.data.contas.filter((conta) => conta.tipo === 'bancaria'))
        const lista = resPlanos.data.planos ?? resPlanos.data ?? []
        setPlanos(Array.isArray(lista) ? lista : [])
      })
      .catch((e) => setErro(extrairMensagemApi(e, 'Não foi possível carregar os catálogos.')))
  }, [])

  const buscar = useCallback(async () => {
    if (!contaEmpresaId || !dataDe || !dataAte) {
      setErro('Selecione a conta bancária e o período.')
      return
    }
    setCarregando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.get<ConsultaConciliacaoResposta>('/conciliacao-bancaria', {
        params: {
          contaEmpresaId,
          dataDe,
          dataAte,
          ...(tipo ? { tipo } : {}),
          ...(status ? { status } : {}),
          ...(extratoId ? { extratoId } : {}),
        },
      })
      setResultado(data)
      setLinhasSelecionadas([])
      setBaixasSelecionadas([])
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível consultar a conciliação.'))
    } finally {
      setCarregando(false)
    }
  }, [contaEmpresaId, dataAte, dataDe, extratoId, status, tipo])

  useEffect(() => {
    if (extratoId && contaEmpresaId) void buscar()
  }, [buscar, contaEmpresaId, extratoId])

  const linhasMarcadas = useMemo(
    () => resultado.extrato.linhas.filter((linha) => linhasSelecionadas.includes(linha.id)),
    [linhasSelecionadas, resultado.extrato.linhas]
  )
  const baixasMarcadas = useMemo(
    () => resultado.sistema.linhas.filter((linha) => baixasSelecionadas.includes(linha.id)),
    [baixasSelecionadas, resultado.sistema.linhas]
  )
  const somaExtrato = linhasMarcadas.reduce((total, linha) => total + linha.valor, 0)
  const somaSistema = baixasMarcadas.reduce((total, linha) => total + linha.valor, 0)
  const somasFecham =
    linhasMarcadas.length > 0 &&
    baixasMarcadas.length > 0 &&
    Math.round(somaExtrato * 100) === Math.round(somaSistema * 100)

  function alternar(lista: string[], id: string, definir: (valor: string[]) => void) {
    definir(lista.includes(id) ? lista.filter((item) => item !== id) : [...lista, id])
  }

  async function importar(arquivo?: File) {
    if (!arquivo || !contaEmpresaId) {
      if (!contaEmpresaId) setErro('Selecione a conta bancária antes de importar.')
      return
    }
    setImportando(true)
    setErro('')
    try {
      const base64Arquivo = await ArquivoParaBase64(arquivo)
      const { data } = await clienteHttp.post('/conciliacao-bancaria/extratos', {
        contaEmpresaId,
        nomeArquivo: arquivo.name,
        mimeType: arquivo.type || (arquivo.name.toLowerCase().endsWith('.ofx') ? 'application/x-ofx' : ''),
        base64Arquivo,
      })
      setMensagem(
        `${data.importadas} linhas importadas, ${data.duplicadas} duplicadas ignoradas.`
      )
      await buscar()
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível importar o extrato.'))
    } finally {
      setImportando(false)
      if (arquivoRef.current) arquivoRef.current.value = ''
    }
  }

  async function baixarModelo() {
    try {
      const { data } = await clienteHttp.get('/conciliacao-bancaria/extratos/modelo.csv', {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'modelo-extrato.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível baixar o modelo.'))
    }
  }

  async function concluir() {
    if (!somasFecham) return
    setCarregando(true)
    setErro('')
    try {
      await clienteHttp.post('/conciliacao-bancaria/conciliacoes', {
        contaEmpresaId,
        linhaIds: linhasSelecionadas,
        baixas: baixasMarcadas.map((baixa) => ({ origem: baixa.origem, baixaId: baixa.id })),
      })
      setMensagem('Conciliação concluída.')
      await buscar()
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível concluir a conciliação.'))
    } finally {
      setCarregando(false)
    }
  }

  async function desvincular() {
    const ids = new Set([
      ...linhasMarcadas.map((linha) => linha.conciliacaoId),
      ...baixasMarcadas.map((linha) => linha.conciliacaoId),
    ].filter(Boolean))
    if (ids.size !== 1) {
      setErro('Selecione linhas do mesmo vínculo conciliado para desvincular.')
      return
    }
    setCarregando(true)
    try {
      await clienteHttp.post(`/conciliacao-bancaria/conciliacoes/${[...ids][0]}/desvincular`)
      setMensagem('Vínculo desfeito; os lançamentos foram mantidos.')
      await buscar()
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível desvincular.'))
    } finally {
      setCarregando(false)
    }
  }

  function abrirLancamento(linha?: LinhaExtrato) {
    setForm({
      direcao: linha && linha.valor > 0 ? 'entrada' : 'saida',
      planoFinanceiroId: '',
      data: linha?.data.slice(0, 10) ?? dataHojeIso(),
      valor: linha ? String(Math.abs(linha.valor)) : '',
      historico: linha?.historico ?? '',
      documento: linha?.documento ?? '',
    })
    setModalLancamento(true)
  }

  async function salvarLancamento() {
    setSalvandoLancamento(true)
    setErro('')
    try {
      await clienteHttp.post('/conciliacao-bancaria/lancamentos', {
        ...form,
        contaEmpresaId,
        valor: Number(form.valor.replace(',', '.')),
        documento: form.documento || null,
      })
      setModalLancamento(false)
      setMensagem('Título e baixa criados; selecione-os para concluir a conciliação.')
      await buscar()
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível criar o lançamento.'))
    } finally {
      setSalvandoLancamento(false)
    }
  }

  const cards = [
    ['Total no extrato', resultado.totais.totalExtrato, resultado.totais.quantidadeExtrato],
    ['Conciliados', resultado.totais.conciliado, resultado.totais.quantidadeConciliada],
    ['Pendentes', resultado.totais.pendente, resultado.totais.quantidadePendente],
    ['Não identificados', resultado.totais.naoIdentificado, resultado.totais.quantidadeNaoIdentificada],
  ] as const

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Conciliação bancária</h1>
        <p className="text-sm text-muted-foreground">
          Visualize o extrato bancário e concilie com as baixas do sistema.
        </p>
      </div>

      {erro && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{erro}</div>}
      {mensagem && <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">{mensagem}</div>}

      <CardPadrao permitirOverflow>
        <div className="grid gap-3 md:grid-cols-5">
          <SelectPadrao rotulo="Conta bancária" valor={contaEmpresaId} aoMudar={setContaEmpresaId} opcoes={contas.map((conta) => ({ value: conta.id, label: conta.nome }))} />
          <label className="space-y-1 text-sm">Data inicial<Input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} /></label>
          <label className="space-y-1 text-sm">Data final<Input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} /></label>
          <SelectPadrao rotulo="Tipo de lançamento" valor={tipo} aoMudar={setTipo} opcoes={[{ value: '', label: 'Todos' }, { value: 'credito', label: 'Crédito' }, { value: 'debito', label: 'Débito' }]} />
          <SelectPadrao rotulo="Status da conciliação" valor={status} aoMudar={setStatus} opcoes={[{ value: '', label: 'Todos' }, { value: 'conciliado', label: 'Conciliado' }, { value: 'pendente', label: 'Pendente' }, { value: 'nao_identificado', label: 'Não identificado' }, { value: 'nao_encontrado', label: 'Não encontrado' }]} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setTipo(''); setStatus(''); setResultado(VAZIO) }}>Limpar</Button>
          <BotaoPrimario onClick={buscar} disabled={carregando}><Search className="mr-2 size-4" />Buscar</BotaoPrimario>
        </div>
      </CardPadrao>

      <div className="grid gap-3 md:grid-cols-4">
        {cards.map(([rotulo, valor, quantidade]) => (
          <CardPadrao key={rotulo} compacto>
            <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
            <p className="mt-1 text-xl font-semibold">{formatarMoedaBr(valor)}</p>
            <p className="text-xs text-muted-foreground">{quantidade} lançamentos</p>
          </CardPadrao>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CardPadrao titulo="Extrato bancário" descricao="Movimentações importadas do banco" acoes={podeEditar ? <><Button variant="ghost" onClick={baixarModelo}>Baixar modelo</Button><input ref={arquivoRef} className="hidden" type="file" accept=".ofx,.csv,.xlsx" onChange={(e) => importar(e.target.files?.[0])} /><Button variant="outline" onClick={() => arquivoRef.current?.click()} disabled={importando}>{importando ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileUp className="mr-2 size-4" />}Importar extrato</Button></> : undefined}>
          <TabelaExtrato linhas={resultado.extrato.linhas} marcadas={linhasSelecionadas} aoAlternar={(id) => alternar(linhasSelecionadas, id, setLinhasSelecionadas)} carregando={carregando} />
        </CardPadrao>
        <CardPadrao titulo="Movimentações do sistema" descricao="Baixas de contas a pagar e receber" acoes={podeEditar ? <Button variant="outline" onClick={() => abrirLancamento(linhasMarcadas.length === 1 ? linhasMarcadas[0] : undefined)} disabled={!contaEmpresaId}><Plus className="mr-2 size-4" />Novo lançamento</Button> : undefined}>
          <TabelaSistema linhas={resultado.sistema.linhas} marcadas={baixasSelecionadas} aoAlternar={(id) => alternar(baixasSelecionadas, id, setBaixasSelecionadas)} carregando={carregando} />
        </CardPadrao>
      </div>

      <CardPadrao titulo="Conciliação automática / manual">
        <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr_auto]">
          <div><p className="text-sm font-medium">Extrato: {linhasMarcadas.length} linhas</p><p className="text-lg font-semibold">{formatarMoedaBr(somaExtrato)}</p></div>
          <Link2 className="size-5 text-muted-foreground" />
          <div><p className="text-sm font-medium">Sistema: {baixasMarcadas.length} baixas</p><p className="text-lg font-semibold">{formatarMoedaBr(somaSistema)}</p>{linhasMarcadas.length > 0 && baixasMarcadas.length > 0 && !somasFecham && <p className="text-xs text-destructive">Valor divergente</p>}</div>
          {podeEditar && <div className="flex flex-col gap-2"><BotaoPrimario onClick={concluir} disabled={!somasFecham || carregando}>Concluir conciliação</BotaoPrimario><Button variant="outline" onClick={desvincular} disabled={carregando}><Unlink className="mr-2 size-4" />Desvincular</Button></div>}
        </div>
      </CardPadrao>

      {modalLancamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <CardPadrao className="w-full max-w-xl" titulo="Novo lançamento" descricao="Cria o título e a baixa na conta selecionada." permitirOverflow>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectPadrao rotulo="Tipo" valor={form.direcao} aoMudar={(valor) => setForm((f) => ({ ...f, direcao: valor }))} opcoes={[{ value: 'saida', label: 'Saída — Conta a Pagar' }, { value: 'entrada', label: 'Entrada — Conta a Receber' }]} />
              <SelectPadrao rotulo="Plano financeiro" valor={form.planoFinanceiroId} aoMudar={(valor) => setForm((f) => ({ ...f, planoFinanceiroId: valor }))} opcoes={planos.map((plano) => ({ value: plano.id, label: `${plano.codigo ? `${plano.codigo} · ` : ''}${plano.nome}` }))} />
              <label className="space-y-1 text-sm">Data<Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} /></label>
              <label className="space-y-1 text-sm">Valor<Input value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} /></label>
              <label className="space-y-1 text-sm">Documento<Input value={form.documento} onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))} /></label>
              <label className="space-y-1 text-sm">Histórico<Input value={form.historico} onChange={(e) => setForm((f) => ({ ...f, historico: e.target.value }))} /></label>
            </div>
            <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setModalLancamento(false)}>Cancelar</Button><BotaoPrimario onClick={salvarLancamento} disabled={salvandoLancamento || !form.planoFinanceiroId || !form.valor || !form.historico}>Salvar e baixar</BotaoPrimario></div>
          </CardPadrao>
        </div>
      )}
    </div>
  )
}

function TabelaExtrato({ linhas, marcadas, aoAlternar, carregando }: { linhas: LinhaExtrato[]; marcadas: string[]; aoAlternar: (id: string) => void; carregando: boolean }) {
  if (carregando) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
  if (!linhas.length) return <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma movimentação no período.</p>
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="px-3 py-2" /><th>Data</th><th>Histórico</th><th className="text-right">Valor</th><th className="px-3">Status</th></tr></thead><tbody>{linhas.map((linha) => <LinhaCheckbox key={linha.id} marcada={marcadas.includes(linha.id)} aoMudar={() => aoAlternar(linha.id)}><td>{formatarDataBr(linha.data)}</td><td><p className="font-medium">{linha.historico}</p><p className="text-xs text-muted-foreground">{linha.documento}</p></td><td className={`text-right font-medium ${linha.valor < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatarMoedaBr(linha.valor)}</td><td className="px-3"><span className={`rounded px-2 py-1 text-xs ${classeStatus(linha.status)}`}>{ROTULOS_STATUS[linha.status]}</span></td></LinhaCheckbox>)}</tbody></table></div>
}

function TabelaSistema({ linhas, marcadas, aoAlternar, carregando }: { linhas: MovimentoSistema[]; marcadas: string[]; aoAlternar: (id: string) => void; carregando: boolean }) {
  if (carregando) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
  if (!linhas.length) return <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma baixa nesta conta no período.</p>
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="px-3 py-2" /><th>Data</th><th>Descrição</th><th className="text-right">Valor</th><th className="px-3">Status</th></tr></thead><tbody>{linhas.map((linha) => <LinhaCheckbox key={linha.id} marcada={marcadas.includes(linha.id)} aoMudar={() => aoAlternar(linha.id)}><td>{formatarDataBr(linha.data)}</td><td><p className="font-medium">{linha.descricao}</p><p className="text-xs text-muted-foreground">{linha.documento}</p></td><td className={`text-right font-medium ${linha.valor < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatarMoedaBr(linha.valor)}</td><td className="px-3"><span className={`rounded px-2 py-1 text-xs ${classeStatus(linha.status)}`}>{ROTULOS_STATUS[linha.status]}</span></td></LinhaCheckbox>)}</tbody></table></div>
}
