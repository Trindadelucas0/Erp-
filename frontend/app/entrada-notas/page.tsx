'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { BadgeStatus } from '@/components/ui/badge-status'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'
import {
  ControlesPaginacao,
  type ItensPorPagina,
} from '@/components/ui/controles-paginacao'
import { Modal } from '@/components/ui/modal'
import {
  ConteudoVisualizacaoNota,
  type VisualizacaoNota,
} from '@/components/entrada-notas/conteudo-visualizacao-nota'
import { BarraCarregamentoDownload } from '@/components/entrada-notas/barra-carregamento-download'
import { Loader2 } from 'lucide-react'

import { mascaraCnpj } from '@/lib/documentos'

type DestinatarioValidacao = 'ok' | 'divergente' | 'pendente'

type NotaPendente = {
  id: string
  chaveNfe: string
  tipoDocumento?: string | null
  nomeEmitente: string | null
  documentoEmitente: string | null
  cnpjDestinatario?: string | null
  tipoNfe?: string | null
  valorTotal: number | null
  dataEmissao: string | null
  situacao: string | null
  statusEntrada: string
  origem: string
  etapaAtual: string
  nfeCompleta?: boolean
  destinatarioValidacao?: DestinatarioValidacao
  cnpjEmpresa?: string | null
  temDanfe?: boolean
  danfeStatus?: string | null
}

type JobStatus = {
  id: string
  status: string
  progresso: number
  mensagem: string | null
  logResumo: string | null
}

type PainelEntrada = 'analise' | 'contagem' | 'consolidada' | 'cancelada'

type FiltrosEntradaSalvos = {
  dataDe: string
  dataAte: string
  painel: PainelEntrada
  busca: string
}

type XmlVisualizacao = {
  id: string
  chaveNfe: string
  tipoDocumento: string
  nomeEmitente: string | null
  documentoEmitente: string | null
  valorTotal: number | null
  dataEmissao: string | null
  origemXml: string
  visualizacao: VisualizacaoNota
}

const PAINEIS: Array<{ id: PainelEntrada; rotulo: string }> = [
  { id: 'analise', rotulo: 'Em análise' },
  { id: 'contagem', rotulo: 'Liberadas p/ contagem' },
  { id: 'consolidada', rotulo: 'Consolidadas' },
  { id: 'cancelada', rotulo: 'Canceladas' },
]

const STORAGE_FILTROS = 'entrada-notas:filtros'

function isoDataLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function primeiroDiaMesAtual(): string {
  const d = new Date()
  return isoDataLocal(new Date(d.getFullYear(), d.getMonth(), 1))
}

function hojeIso(): string {
  return isoDataLocal(new Date())
}

function lerFiltrosSalvos(): FiltrosEntradaSalvos | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_FILTROS)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<FiltrosEntradaSalvos>
    const painelValidos = PAINEIS.map((p) => p.id)
    return {
      dataDe: typeof parsed.dataDe === 'string' ? parsed.dataDe : primeiroDiaMesAtual(),
      dataAte: typeof parsed.dataAte === 'string' ? parsed.dataAte : hojeIso(),
      painel: painelValidos.includes(parsed.painel as PainelEntrada)
        ? (parsed.painel as PainelEntrada)
        : 'analise',
      busca: typeof parsed.busca === 'string' ? parsed.busca : '',
    }
  } catch {
    return null
  }
}

function gravarFiltrosSalvos(f: FiltrosEntradaSalvos) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_FILTROS, JSON.stringify(f))
  } catch {
    /* ignore quota */
  }
}

function formatarDocCurto(doc: string | null | undefined): string {
  if (!doc) return '—'
  const d = doc.replace(/\D/g, '')
  if (d.length === 14) return mascaraCnpj(d)
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  return doc
}

function rotuloValidacaoDest(v: DestinatarioValidacao | undefined): string {
  if (v === 'ok') return 'Nosso CNPJ'
  if (v === 'divergente') return 'Outro destinatário'
  return 'A confirmar'
}

function varianteValidacaoDest(
  v: DestinatarioValidacao | undefined
): 'sucesso' | 'reprovado' | 'inativo' {
  if (v === 'ok') return 'sucesso'
  if (v === 'divergente') return 'reprovado'
  return 'inativo'
}

function ehArquivoXml(nome: string): boolean {
  return nome.toLowerCase().endsWith('.xml')
}

function rotuloStatus(status: string): string {
  if (status === 'pendente') return 'pendente — clique para analisar'
  if (status === 'em_analise') return 'em análise — clique para continuar'
  if (status === 'stand_by') return 'stand-by (contato fornecedor)'
  if (status === 'entrada_contagem') return 'liberada para contagem'
  if (status === 'entrada_consolidada') return 'estoque consolidado (status)'
  if (status === 'cancelada') return 'cancelada / manifesto'
  return status
}

function varianteStatusEntrada(
  status: string
): 'pendente' | 'info' | 'aguardando' | 'inativo' | 'sucesso' {
  if (status === 'pendente') return 'pendente'
  if (status === 'em_analise') return 'info'
  if (status === 'stand_by') return 'aguardando'
  if (status === 'entrada_contagem' || status === 'entrada_consolidada') return 'sucesso'
  return 'inativo'
}

function rotuloStatusCurto(status: string): string {
  if (status === 'em_analise') return 'em análise'
  if (status === 'stand_by') return 'stand-by'
  if (status === 'entrada_contagem') return 'contagem'
  if (status === 'entrada_consolidada') return 'consolidada'
  return status
}

function tituloPainel(painel: PainelEntrada): string {
  return PAINEIS.find((p) => p.id === painel)?.rotulo ?? 'Notas'
}

function ConteudoEntradaNotas() {
  const router = useRouter()
  const [painel, setPainel] = useState<PainelEntrada>('analise')
  const [notas, setNotas] = useState<NotaPendente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [sincronizando, setSincronizando] = useState(false)
  const [job, setJob] = useState<JobStatus | null>(null)
  const [xmlTexto, setXmlTexto] = useState('')
  const [importando, setImportando] = useState(false)
  const [progressoImport, setProgressoImport] = useState('')
  const [arquivosSelecionados, setArquivosSelecionados] = useState<File[]>([])
  const [dataDe, setDataDe] = useState(primeiroDiaMesAtual)
  const [dataAte, setDataAte] = useState(hojeIso)
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [filtrosProntos, setFiltrosProntos] = useState(false)
  const [reprocessando, setReprocessando] = useState(false)
  const [xmlModal, setXmlModal] = useState<XmlVisualizacao | null>(null)
  const [xmlCarregandoId, setXmlCarregandoId] = useState<string | null>(null)
  const [downloadRotulo, setDownloadRotulo] = useState('')
  const [pagina, setPagina] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState<ItensPorPagina>(10)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputArquivosRef = useRef<HTMLInputElement | null>(null)
  const painelAnalise = painel === 'analise'

  useEffect(() => {
    const salvos = lerFiltrosSalvos()
    if (salvos) {
      setPainel(salvos.painel)
      setDataDe(salvos.dataDe)
      setDataAte(salvos.dataAte)
      setBusca(salvos.busca)
      setBuscaDebounced(salvos.busca.trim())
    }
    setFiltrosProntos(true)
  }, [])

  useEffect(() => {
    if (!filtrosProntos) return
    gravarFiltrosSalvos({ dataDe, dataAte, painel, busca })
  }, [dataDe, dataAte, painel, busca, filtrosProntos])

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 300)
    return () => clearTimeout(t)
  }, [busca])

  useEffect(() => {
    setPagina(1)
  }, [painel, dataDe, dataAte, buscaDebounced, itensPorPagina])

  const totalPaginas = Math.max(1, Math.ceil(notas.length / itensPorPagina))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const listaPaginada = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina
    return notas.slice(inicio, inicio + itensPorPagina)
  }, [notas, paginaAtual, itensPorPagina])

  const carregar = useCallback(async (opcoes?: { silencioso?: boolean }) => {
    if (!opcoes?.silencioso) setCarregando(true)
    setErro('')
    try {
      const params: Record<string, string> = { painel }
      if (dataDe) params.dataDe = dataDe
      if (dataAte) params.dataAte = dataAte
      if (buscaDebounced) params.busca = buscaDebounced
      const { data } = await clienteHttp.get<{ notas: NotaPendente[] }>(
        '/focus-nfe/nfe-recebidas',
        { params }
      )
      setNotas(data.notas)
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível listar as notas.'))
    } finally {
      if (!opcoes?.silencioso) setCarregando(false)
    }
  }, [dataDe, dataAte, painel, buscaDebounced])

  useEffect(() => {
    if (!filtrosProntos) return
    carregar()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [carregar, filtrosProntos])

  async function acompanharJob(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current)
    setMensagem('Sincronizando em lotes… notas já salvas aparecem abaixo.')
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await clienteHttp.get<{ job: JobStatus }>(`/focus-nfe/jobs/${jobId}`)
        setJob(data.job)
        await carregar({ silencioso: true })
        if (data.job.status === 'ok' || data.job.status === 'erro') {
          if (pollRef.current) clearInterval(pollRef.current)
          setSincronizando(false)
          if (data.job.status === 'ok') {
            setMensagem(data.job.mensagem ?? 'Sincronização concluída.')
            await carregar()
          } else {
            setErro(data.job.mensagem ?? 'Falha na sincronização.')
          }
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current)
        setSincronizando(false)
      }
    }, 1500)
  }

  async function baixarXmlNota(id: string, chave: string) {
    setXmlCarregandoId(id)
    setDownloadRotulo('Baixando XML…')
    setErro('')
    try {
      const { data } = await clienteHttp.get<string>(`/focus-nfe/nfe-recebidas/${id}/xml`, {
        responseType: 'text',
        transformResponse: [(d) => d],
      })
      const blob = new Blob([data], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${chave || id}.xml`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível baixar o XML.'))
    } finally {
      setXmlCarregandoId(null)
      setDownloadRotulo('')
    }
  }

  async function baixarDanfeNota(n: NotaPendente) {
    if (!n.temDanfe && (n.danfeStatus === 'indisponivel' || n.danfeStatus === 'rate_limit')) {
      setErro(
        n.danfeStatus === 'rate_limit'
          ? 'Limite Focus excedido. Aguarde 1–2 minutos e tente de novo.'
          : 'PDF ainda indisponível na Focus para esta nota. Use Ver nota ou tente mais tarde.'
      )
      return
    }
    setXmlCarregandoId(n.id)
    setDownloadRotulo('Baixando PDF…')
    setErro('')
    try {
      const { data } = await clienteHttp.get<ArrayBuffer>(`/focus-nfe/nfe-recebidas/${n.id}/danfe`, {
        responseType: 'arraybuffer',
      })
      const blob = new Blob([data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${n.tipoDocumento === 'nfse' ? 'DANFSe' : 'DANFE'}-${n.chaveNfe || n.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      await carregar({ silencioso: true })
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível baixar o PDF.'))
      await carregar({ silencioso: true })
    } finally {
      setXmlCarregandoId(null)
      setDownloadRotulo('')
    }
  }

  async function visualizarXmlNota(n: NotaPendente) {
    setXmlCarregandoId(n.id)
    setDownloadRotulo('Abrindo nota…')
    setErro('')
    try {
      const { data } = await clienteHttp.get<XmlVisualizacao>(
        `/focus-nfe/nfe-recebidas/${n.id}/xml`,
        { params: { modo: 'visualizar' } }
      )
      setXmlModal(data)
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível visualizar a nota.'))
    } finally {
      setXmlCarregandoId(null)
      setDownloadRotulo('')
    }
  }

  async function sincronizarFocus(completo: boolean) {
    setSincronizando(true)
    setErro('')
    setMensagem('')
    setJob(null)
    try {
      const { data } = await clienteHttp.post<{ jobId: string; status: string }>(
        '/focus-nfe/jobs/sincronizar',
        { completo }
      )
      setMensagem(
        completo
          ? 'Buscando na Focus tudo que existir contra o CNPJ (ciência + XML)…'
          : 'Buscando só notas novas na Focus…'
      )
      await acompanharJob(data.jobId)
    } catch (err) {
      setSincronizando(false)
      setErro(extrairMensagemApi(err, 'Não foi possível iniciar a sync.'))
    }
  }

  async function reprocessarXmls() {
    setReprocessando(true)
    setErro('')
    setMensagem('')
    try {
      const { data } = await clienteHttp.post<{ mensagem: string; processados: number }>(
        '/focus-nfe/nfe-recebidas/reprocessar-xmls'
      )
      setMensagem(data.mensagem)
      await carregar()
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Falha ao reprocessar XMLs.'))
    } finally {
      setReprocessando(false)
    }
  }

  async function importarUmXml(xmlBruto: string) {
    const xml = xmlBruto.replace(/^\uFEFF/, '').trim()
    const { data } = await clienteHttp.post<{ mensagem: string; chaveNfe: string }>(
      '/focus-nfe/nfe-recebidas/importar-xml',
      { xml }
    )
    return data
  }

  async function importarXmlColado() {
    if (!xmlTexto.trim()) {
      setErro('Cole o XML da NF-e ou selecione arquivos .xml.')
      return
    }
    setImportando(true)
    setErro('')
    setMensagem('')
    setProgressoImport('')
    try {
      const data = await importarUmXml(xmlTexto)
      setMensagem(data.mensagem)
      setXmlTexto('')
      await carregar()
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Falha ao importar XML.'))
    } finally {
      setImportando(false)
    }
  }

  function aoEscolherArquivos(lista: FileList | null) {
    if (!lista?.length) {
      setArquivosSelecionados([])
      return
    }
    const todos = Array.from(lista)
    const xmls = todos.filter((f) => ehArquivoXml(f.name))
    const ignorados = todos.length - xmls.length
    setArquivosSelecionados(xmls)
    if (ignorados > 0) {
      setErro(
        `${ignorados} arquivo(s) ignorado(s) (só .xml). ${xmls.length} XML(s) pronto(s) para importar.`
      )
    } else {
      setErro('')
    }
  }

  async function importarArquivosSequencial() {
    if (arquivosSelecionados.length === 0) {
      setErro('Selecione um ou mais arquivos .xml.')
      return
    }

    setImportando(true)
    setErro('')
    setMensagem('')
    const total = arquivosSelecionados.length
    let ok = 0
    const falhas: string[] = []

    for (let i = 0; i < total; i += 1) {
      const file = arquivosSelecionados[i]
      setProgressoImport(`Importando ${i + 1}/${total}… (${file.name})`)
      try {
        const texto = await file.text()
        const xml = texto.replace(/^\uFEFF/, '').trim()
        if (!xml) {
          falhas.push(`${file.name}: arquivo vazio`)
          continue
        }
        if (xml.length < 50) {
          falhas.push(`${file.name}: conteúdo muito curto — não parece XML de NF-e`)
          continue
        }
        await importarUmXml(xml)
        ok += 1
      } catch (err) {
        falhas.push(`${file.name}: ${extrairMensagemApi(err, 'falha')}`)
      }
    }

    setProgressoImport('')
    setArquivosSelecionados([])
    if (inputArquivosRef.current) inputArquivosRef.current.value = ''

    if (falhas.length === 0) {
      setMensagem(`${ok} ok de ${total} arquivo(s) importado(s).`)
      setErro('')
    } else {
      const detalhe = falhas.slice(0, 5).join('; ')
      const mais = falhas.length > 5 ? ` (+${falhas.length - 5}…)` : ''
      setMensagem(`${ok} ok, ${falhas.length} falhou(aram).`)
      setErro(`${detalhe}${mais}`)
    }

    await carregar()
    setImportando(false)
  }

  const ocupado = sincronizando || importando || reprocessando
  const filtrosDataAtivos = Boolean(dataDe || dataAte)

  return (
    <div className="min-w-0 space-y-6">
      <BarraCarregamentoDownload
        ativo={Boolean(xmlCarregandoId)}
        rotulo={downloadRotulo || 'Carregando…'}
      />
      <div>
        <p className="text-sm text-muted-foreground">Fiscal &gt; Entrada de Notas</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Entrada de Notas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sync Focus traz <strong>NFe 55</strong> (produto) e <strong>NFS-e</strong> (serviço
          nacional) em lotes (até 10 a cada ~2 min) e salva no banco. Lista, datas e busca usam só o
          que já está salvo — sem reconsultar a Focus.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PAINEIS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={painel === p.id ? 'default' : 'outline'}
            onClick={() => setPainel(p.id)}
          >
            {p.rotulo}
          </Button>
        ))}
      </div>

      {mensagem && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{mensagem}</p>
      )}
      {erro && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
      )}
      {progressoImport && <p className="text-sm text-muted-foreground">{progressoImport}</p>}
      {job && (
        <p className="text-xs text-muted-foreground">
          Job {job.id.slice(0, 8)}… · {job.status} · {job.progresso}%
          {job.mensagem ? ` — ${job.mensagem}` : ''}
        </p>
      )}

      <CardPadrao
        titulo={tituloPainel(painel)}
        descricao={
          painelAnalise
            ? 'Buscar tudo reinicia o cursor e puxa NFe/NFS-e em lotes. Datas e busca filtram só o banco local (filtro permanece ao abrir uma nota).'
            : 'Notas já lançadas ou canceladas. Filtro de datas e busca na lista local.'
        }
        acoes={
          <>
            {painelAnalise && (
              <>
                <BotaoPrimario
                  type="button"
                  onClick={() => sincronizarFocus(true)}
                  disabled={ocupado}
                >
                  {sincronizando ? 'Sincronizando…' : 'Buscar na Focus (tudo)'}
                </BotaoPrimario>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => sincronizarFocus(false)}
                  disabled={ocupado}
                >
                  Só novas
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={reprocessarXmls}
                  disabled={ocupado}
                >
                  {reprocessando ? 'Reprocessando…' : 'Completar dados'}
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void carregar()}
              disabled={carregando || ocupado}
            >
              Atualizar
            </Button>
          </>
        }
      >
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1 sm:min-w-[16rem]">
            <Label htmlFor="filtro-busca">Buscar</Label>
            <input
              id="filtro-busca"
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Emitente, valor ou chave (banco local)…"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filtro-de">Emissão de</Label>
            <input
              id="filtro-de"
              type="date"
              value={dataDe}
              onChange={(e) => setDataDe(e.target.value)}
              className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-auto"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filtro-ate">até</Label>
            <input
              id="filtro-ate"
              type="date"
              value={dataAte}
              onChange={(e) => setDataAte(e.target.value)}
              className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-auto"
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => carregar()} disabled={carregando}>
            Filtrar
          </Button>
          {filtrosDataAtivos && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDataDe(primeiroDiaMesAtual())
                setDataAte(hojeIso())
              }}
            >
              Mês atual
            </Button>
          )}
          {(dataDe || dataAte) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDataDe('')
                setDataAte('')
              }}
            >
              Ver todas (sem data)
            </Button>
          )}
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          {carregando
            ? 'Carregando…'
            : `${notas.length} nota${notas.length !== 1 ? 's' : ''}`}
        </p>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Emissão</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Emitente (quem emitiu)</th>
                <th className="px-4 py-3 font-medium">Destinatário</th>
                <th className="px-4 py-3 font-medium">Chave</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Origem</th>
                <th className="px-4 py-3 font-medium">Etapa</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">XML</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <LinhasSkeletonTabela linhas={5} colunas={10} />
              ) : notas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                    {painelAnalise
                      ? 'Nenhuma nota neste painel (filtro de datas/busca ativo). Clique em Buscar na Focus (tudo) ou Só novas. Use Ver todas (sem data) ou importe XML.'
                      : 'Nenhuma nota neste painel.'}
                  </td>
                </tr>
              ) : (
                listaPaginada.map((n) => (
                  <tr
                    key={n.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                    onClick={() => router.push(`/entrada-notas/${n.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        router.push(`/entrada-notas/${n.id}`)
                      }
                    }}
                    tabIndex={0}
                    role="link"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      {n.dataEmissao
                        ? new Date(n.dataEmissao).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <BadgeStatus
                        variante={n.tipoDocumento === 'nfse' ? 'info' : 'sucesso'}
                      >
                        {n.tipoDocumento === 'nfse' ? 'NFS-e' : 'NFe'}
                      </BadgeStatus>
                    </td>
                    <td className="max-w-[16rem] px-4 py-3">
                      <div
                        className="truncate font-medium"
                        title={n.nomeEmitente ?? undefined}
                      >
                        {n.nomeEmitente ?? '—'}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {formatarDocCurto(n.documentoEmitente)}
                      </div>
                    </td>
                    <td className="max-w-[12rem] px-4 py-3">
                      <div className="truncate text-xs">
                        {formatarDocCurto(n.cnpjDestinatario)}
                      </div>
                      <div className="mt-1">
                        <BadgeStatus variante={varianteValidacaoDest(n.destinatarioValidacao)}>
                          {rotuloValidacaoDest(n.destinatarioValidacao)}
                        </BadgeStatus>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/entrada-notas/${n.id}`}
                        title={n.chaveNfe}
                        className="block max-w-[10rem] truncate font-mono text-xs underline-offset-2 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        …{n.chaveNfe.slice(-8)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                      {n.valorTotal != null
                        ? n.valorTotal.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <BadgeStatus variante="inativo">{n.origem}</BadgeStatus>
                    </td>
                    <td className="px-4 py-3">
                      <BadgeStatus variante="info">{n.etapaAtual}</BadgeStatus>
                    </td>
                    <td className="px-4 py-3" title={rotuloStatus(n.statusEntrada)}>
                      <BadgeStatus variante={varianteStatusEntrada(n.statusEntrada)}>
                        {rotuloStatusCurto(n.statusEntrada)}
                      </BadgeStatus>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={xmlCarregandoId === n.id || ocupado}
                          onClick={() => void visualizarXmlNota(n)}
                        >
                          {xmlCarregandoId === n.id && downloadRotulo.startsWith('Abrindo') ? (
                            <>
                              <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
                              Abrindo…
                            </>
                          ) : (
                            'Ver nota'
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={xmlCarregandoId === n.id || ocupado}
                          onClick={() => void baixarXmlNota(n.id, n.chaveNfe)}
                        >
                          {xmlCarregandoId === n.id && downloadRotulo.includes('XML') ? (
                            <>
                              <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
                              …
                            </>
                          ) : (
                            'XML'
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={
                            xmlCarregandoId === n.id ||
                            ocupado ||
                            (!n.temDanfe &&
                              (n.danfeStatus === 'indisponivel' || n.danfeStatus === 'rate_limit'))
                          }
                          title={
                            n.temDanfe
                              ? 'PDF em cache no sistema'
                              : n.danfeStatus === 'indisponivel'
                                ? 'PDF indisponível na Focus — use Ver nota'
                                : n.danfeStatus === 'rate_limit'
                                  ? 'Aguarde 1–2 min (limite Focus)'
                                  : 'Baixar PDF (DANFE/DANFSe)'
                          }
                          onClick={() => void baixarDanfeNota(n)}
                        >
                          {xmlCarregandoId === n.id && downloadRotulo.includes('PDF') ? (
                            <>
                              <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
                              …
                            </>
                          ) : n.temDanfe ? (
                            'PDF'
                          ) : (
                            'DANFE'
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <ControlesPaginacao
          total={notas.length}
          pagina={paginaAtual}
          itensPorPagina={itensPorPagina}
          onPaginaChange={setPagina}
          onItensPorPaginaChange={setItensPorPagina}
        />
      </CardPadrao>

      <Modal
        aberto={Boolean(xmlModal)}
        aoFechar={() => setXmlModal(null)}
        titulo="Visualizar nota"
        descricao="Documento fiscal legível (emitente, itens e totais). XML e DANFE no rodapé."
        largura="5xl"
        alturaMinimaConteudo="md"
        rodape={
          xmlModal ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setXmlModal(null)}>
                Fechar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!xmlModal) return
                  void baixarXmlNota(xmlModal.id, xmlModal.chaveNfe)
                }}
                disabled={xmlCarregandoId === xmlModal.id}
              >
                Baixar XML
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!xmlModal) return
                  const n = notas.find((x) => x.id === xmlModal.id)
                  void baixarDanfeNota(
                    n ?? {
                      id: xmlModal.id,
                      chaveNfe: xmlModal.chaveNfe,
                      tipoDocumento: xmlModal.tipoDocumento,
                      nomeEmitente: null,
                      documentoEmitente: null,
                      valorTotal: null,
                      dataEmissao: null,
                      situacao: null,
                      statusEntrada: '',
                      origem: '',
                      etapaAtual: '',
                      temDanfe: false,
                      danfeStatus: null,
                    }
                  )
                }}
                disabled={xmlCarregandoId === xmlModal.id}
              >
                Baixar PDF
              </Button>
            </div>
          ) : null
        }
      >
        {xmlModal?.visualizacao && (
          <ConteudoVisualizacaoNota visualizacao={xmlModal.visualizacao} />
        )}
      </Modal>

      {painelAnalise && (
      <CardPadrao
        titulo="Importar XML"
        descricao="XML de NFe 55 (produto) ou NFS-e nacional (serviço). Um arquivo por vez."
        compacto
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor="entrada-xml-arquivos">Arquivos XML</Label>
              <input
                ref={inputArquivosRef}
                id="entrada-xml-arquivos"
                type="file"
                accept=".xml,text/xml,application/xml"
                multiple
                disabled={ocupado}
                onChange={(e) => aoEscolherArquivos(e.target.files)}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
              />
              {arquivosSelecionados.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {arquivosSelecionados.length} arquivo(s) prontos.
                </p>
              )}
            </div>
            <Button
              type="button"
              onClick={importarArquivosSequencial}
              disabled={ocupado || arquivosSelecionados.length === 0}
            >
              {importando && progressoImport
                ? progressoImport
                : arquivosSelecionados.length > 0
                  ? `Importar ${arquivosSelecionados.length}`
                  : 'Importar'}
            </Button>
          </div>

          <details className="rounded-md border border-border px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
              Colar XML
            </summary>
            <div className="mt-3 space-y-2">
              <Label htmlFor="entrada-xml-colar" className="sr-only">
                XML colado
              </Label>
              <textarea
                id="entrada-xml-colar"
                value={xmlTexto}
                onChange={(e) => setXmlTexto(e.target.value)}
                rows={3}
                disabled={ocupado}
                placeholder="Cole o XML da NF-e aqui…"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={importarXmlColado}
                disabled={ocupado}
              >
                Importar XML colado
              </Button>
            </div>
          </details>
        </div>
      </CardPadrao>
      )}
    </div>
  )
}

export default function PaginaEntradaNotas() {
  return (
    <ProtegerRota chaveDaPagina="entrada-notas">
      <ConteudoEntradaNotas />
    </ProtegerRota>
  )
}
