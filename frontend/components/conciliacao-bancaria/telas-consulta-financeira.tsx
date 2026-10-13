'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Input } from '@/components/ui/input'
import { SelectPadrao } from '@/components/ui/select-padrao'
import {
  dataHojeIso,
  dataInicioMesIso,
  formatarDataBr,
  type TotaisConciliacao,
} from '@/lib/conciliacao-bancaria'
import { formatarMoedaBr } from '@/lib/contas-a-pagar'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { clienteHttp } from '@/services/api'

type Conta = { id: string; nome: string; tipo: string }
type Filtros = { contaEmpresaId: string; dataDe: string; dataAte: string }
type DiaFluxo = { data: string; entradas: number; saidas: number; saldo: number; saldoAcumulado: number }
type Movimento = {
  id: string
  data: string
  contaNome: string
  origem: 'pagar' | 'receber'
  documento: string | null
  descricao: string
  pessoa: string | null
  valor: number
  conciliada: boolean
}
type Extrato = {
  id: string
  contaEmpresaId: string
  conta: string
  arquivo: string
  origem: string
  periodoDe: string | null
  periodoAte: string | null
  linhas: number
  usuario: string
  importadoEm: string
}

function Cabecalho({ titulo, descricao }: { titulo: string; descricao: string }) {
  return <div><h1 className="text-2xl font-semibold">{titulo}</h1><p className="text-sm text-muted-foreground">{descricao}</p></div>
}

function useContas() {
  const [contas, setContas] = useState<Conta[]>([])
  useEffect(() => {
    clienteHttp.get<{ contas: Conta[] }>('/contas', { params: { somenteAtivos: true } })
      .then(({ data }) => setContas(data.contas.filter((conta) => conta.tipo === 'bancaria')))
      .catch(() => setContas([]))
  }, [])
  return contas
}

function FiltrosPeriodo({
  filtros,
  definir,
  contas,
  buscar,
  permitirTodas = true,
}: {
  filtros: Filtros
  definir: (filtros: Filtros) => void
  contas: Conta[]
  buscar: () => void
  permitirTodas?: boolean
}) {
  return (
    <CardPadrao permitirOverflow>
      <div className="grid gap-3 md:grid-cols-4">
        <SelectPadrao
          rotulo="Conta bancária"
          valor={filtros.contaEmpresaId}
          aoMudar={(valor) => definir({ ...filtros, contaEmpresaId: valor })}
          opcoes={[
            ...(permitirTodas ? [{ value: '', label: 'Todas as contas' }] : []),
            ...contas.map((conta) => ({ value: conta.id, label: conta.nome })),
          ]}
        />
        <label className="space-y-1 text-sm">Data inicial<Input type="date" value={filtros.dataDe} onChange={(e) => definir({ ...filtros, dataDe: e.target.value })} /></label>
        <label className="space-y-1 text-sm">Data final<Input type="date" value={filtros.dataAte} onChange={(e) => definir({ ...filtros, dataAte: e.target.value })} /></label>
        <div className="flex items-end"><BotaoPrimario className="w-full" onClick={buscar}><Search className="mr-2 size-4" />Buscar</BotaoPrimario></div>
      </div>
    </CardPadrao>
  )
}

const filtrosIniciais = (): Filtros => ({
  contaEmpresaId: '',
  dataDe: dataInicioMesIso(),
  dataAte: dataHojeIso(),
})

export function TelaFluxoDeCaixa() {
  const contas = useContas()
  const [filtros, setFiltros] = useState(filtrosIniciais)
  const [dias, setDias] = useState<DiaFluxo[]>([])
  const [erro, setErro] = useState('')
  const buscar = useCallback(async () => {
    setErro('')
    try {
      const { data } = await clienteHttp.get<{ dias: DiaFluxo[] }>('/fluxo-de-caixa', {
        params: { ...filtros, ...(filtros.contaEmpresaId ? {} : { contaEmpresaId: undefined }) },
      })
      setDias(data.dias)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível carregar o fluxo de caixa.'))
    }
  }, [filtros])
  useEffect(() => { void buscar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="space-y-4"><Cabecalho titulo="Fluxo de caixa" descricao="Movimentações realizadas pelas baixas financeiras." /><FiltrosPeriodo filtros={filtros} definir={setFiltros} contas={contas} buscar={buscar} />{erro && <p className="text-sm text-destructive">{erro}</p>}<CardPadrao titulo="Realizado por dia"><Tabela cabecalhos={['Data', 'Entradas', 'Saídas', 'Saldo do dia', 'Saldo acumulado']}>{dias.map((dia) => <tr key={dia.data} className="border-b"><td>{formatarDataBr(dia.data)}</td><td className="text-emerald-600">{formatarMoedaBr(dia.entradas)}</td><td className="text-rose-600">{formatarMoedaBr(dia.saidas)}</td><td>{formatarMoedaBr(dia.saldo)}</td><td className="font-medium">{formatarMoedaBr(dia.saldoAcumulado)}</td></tr>)}</Tabela>{!dias.length && <Vazio texto="Nenhuma baixa no período." />}</CardPadrao></div>
}

export function TelaMovimentacoesFinanceiras() {
  const contas = useContas()
  const [filtros, setFiltros] = useState(filtrosIniciais)
  const [q, setQ] = useState('')
  const [conciliada, setConciliada] = useState('')
  const [linhas, setLinhas] = useState<Movimento[]>([])
  const [erro, setErro] = useState('')
  const buscar = useCallback(async () => {
    try {
      const { data } = await clienteHttp.get<{ movimentacoes: Movimento[] }>('/movimentacoes-financeiras', { params: { ...filtros, ...(filtros.contaEmpresaId ? {} : { contaEmpresaId: undefined }), ...(q ? { q } : {}), ...(conciliada ? { conciliada } : {}) } })
      setLinhas(data.movimentacoes); setErro('')
    } catch (e) { setErro(extrairMensagemApi(e, 'Não foi possível carregar as movimentações.')) }
  }, [conciliada, filtros, q])
  useEffect(() => { void buscar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="space-y-4"><Cabecalho titulo="Movimentações" descricao="Baixas de Contas a Pagar e Contas a Receber." /><FiltrosPeriodo filtros={filtros} definir={setFiltros} contas={contas} buscar={buscar} /><CardPadrao permitirOverflow><div className="grid gap-3 md:grid-cols-[1fr_260px_auto]"><Input placeholder="Documento, pessoa, descrição ou conta" value={q} onChange={(e) => setQ(e.target.value)} /><SelectPadrao rotulo="Conciliação" valor={conciliada} aoMudar={setConciliada} opcoes={[{ value: '', label: 'Todas' }, { value: 'sim', label: 'Conciliadas' }, { value: 'nao', label: 'Não conciliadas' }]} compacto /><BotaoPrimario onClick={buscar}>Filtrar</BotaoPrimario></div></CardPadrao>{erro && <p className="text-sm text-destructive">{erro}</p>}<CardPadrao><Tabela cabecalhos={['Data', 'Conta', 'Tipo', 'Documento / descrição', 'Valor', 'Conciliação']}>{linhas.map((linha) => <tr key={`${linha.origem}-${linha.id}`} className="border-b"><td>{formatarDataBr(linha.data)}</td><td>{linha.contaNome}</td><td>{linha.origem === 'pagar' ? 'Pagar' : 'Receber'}</td><td><p>{linha.documento || '—'}</p><p className="text-xs text-muted-foreground">{linha.descricao}</p></td><td className={linha.valor < 0 ? 'text-rose-600' : 'text-emerald-600'}>{formatarMoedaBr(linha.valor)}</td><td>{linha.conciliada ? 'Sim' : 'Não'}</td></tr>)}</Tabela>{!linhas.length && <Vazio texto="Nenhuma movimentação no período." />}</CardPadrao></div>
}

export function TelaExtratosBancarios() {
  const [extratos, setExtratos] = useState<Extrato[]>([])
  const [erro, setErro] = useState('')
  useEffect(() => { clienteHttp.get<{ extratos: Extrato[] }>('/conciliacao-bancaria/extratos').then(({ data }) => setExtratos(data.extratos)).catch((e) => setErro(extrairMensagemApi(e, 'Não foi possível carregar os extratos.'))) }, [])
  return <div className="space-y-4"><Cabecalho titulo="Extratos" descricao="Arquivos bancários importados na conciliação." />{erro && <p className="text-sm text-destructive">{erro}</p>}<CardPadrao><Tabela cabecalhos={['Conta', 'Arquivo', 'Origem', 'Período', 'Linhas', 'Usuário', 'Importado em']}>{extratos.map((item) => <tr key={item.id} className="border-b"><td><Link className="font-medium text-primary hover:underline" href={`/conciliacao-bancaria?extratoId=${item.id}&contaEmpresaId=${item.contaEmpresaId}`}>{item.conta}</Link></td><td>{item.arquivo}</td><td>{item.origem.toUpperCase()}</td><td>{item.periodoDe && item.periodoAte ? `${formatarDataBr(item.periodoDe)} a ${formatarDataBr(item.periodoAte)}` : '—'}</td><td>{item.linhas}</td><td>{item.usuario}</td><td>{formatarDataBr(item.importadoEm)}</td></tr>)}</Tabela>{!extratos.length && <Vazio texto="Nenhum extrato importado." />}</CardPadrao></div>
}

export function TelaRelatoriosFinanceiros() {
  const contas = useContas()
  const [filtros, setFiltros] = useState(filtrosIniciais)
  const [totais, setTotais] = useState<TotaisConciliacao | null>(null)
  const [erro, setErro] = useState('')
  const buscar = useCallback(async () => {
    if (!filtros.contaEmpresaId) { setErro('Selecione uma conta bancária.'); return }
    try {
      const { data } = await clienteHttp.get<{ totais: TotaisConciliacao }>('/conciliacao-bancaria/relatorio', { params: filtros })
      setTotais(data.totais); setErro('')
    } catch (e) { setErro(extrairMensagemApi(e, 'Não foi possível gerar o relatório.')) }
  }, [filtros])
  async function exportar() {
    try {
      const { data } = await clienteHttp.get('/conciliacao-bancaria/relatorio.csv', { params: filtros, responseType: 'blob' })
      const url = URL.createObjectURL(data); const link = document.createElement('a'); link.href = url; link.download = 'relatorio-conciliacao.csv'; link.click(); URL.revokeObjectURL(url)
    } catch (e) { setErro(extrairMensagemApi(e, 'Não foi possível exportar o relatório.')) }
  }
  const cards = totais ? [['Total do extrato', totais.totalExtrato, totais.quantidadeExtrato], ['Conciliado', totais.conciliado, totais.quantidadeConciliada], ['Pendente', totais.pendente, totais.quantidadePendente], ['Não identificado', totais.naoIdentificado, totais.quantidadeNaoIdentificada]] as const : []
  return <div className="space-y-4"><Cabecalho titulo="Relatórios" descricao="Resumo da conciliação por conta e período." /><FiltrosPeriodo filtros={filtros} definir={setFiltros} contas={contas} buscar={buscar} permitirTodas={false} />{erro && <p className="text-sm text-destructive">{erro}</p>}{totais && <><div className="flex justify-end"><Button variant="outline" onClick={exportar}><Download className="mr-2 size-4" />Exportar CSV</Button></div><div className="grid gap-3 md:grid-cols-4">{cards.map(([rotulo, valor, quantidade]) => <CardPadrao key={rotulo} compacto><p className="text-xs text-muted-foreground">{rotulo}</p><p className="text-xl font-semibold">{formatarMoedaBr(valor)}</p><p className="text-xs text-muted-foreground">{quantidade} lançamentos</p></CardPadrao>)}</div></>}</div>
}

function Tabela({ cabecalhos, children }: { cabecalhos: string[]; children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground">{cabecalhos.map((item) => <th key={item} className="px-3 py-2">{item}</th>)}</tr></thead><tbody className="[&_td]:px-3 [&_td]:py-2">{children}</tbody></table></div>
}

function Vazio({ texto }: { texto: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{texto}</p>
}
