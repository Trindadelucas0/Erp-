'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { BadgeStatus } from '@/components/ui/badge-status'
import { CabecalhoColunaOrdenavel } from '@/components/ui/cabecalho-coluna-ordenavel'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'
import {
  ControlesPaginacao,
  type ItensPorPagina,
} from '@/components/ui/controles-paginacao'
import { Modal } from '@/components/ui/modal'
import { useOrdenacaoColunas } from '@/hooks/use-ordenacao-colunas'
import { ordenarLista } from '@/lib/ordenacao-lista'
import {
  ConteudoVisualizacaoNota,
  type VisualizacaoNota,
} from '@/components/entrada-notas/conteudo-visualizacao-nota'
import { BarraCarregamentoDownload } from '@/components/entrada-notas/barra-carregamento-download'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { classesCampoLista, classesCampoBase } from '@/components/ui/classes-campo'
import { cn } from '@/lib/utils'
import { CheckCircle2, Loader2 } from 'lucide-react'

import { mascaraCnpj, mascaraCpf } from '@/lib/documentos'
import {
  prefixoPdfDocumento,
  rotuloTipoDocumentoCurto,
  varianteBadgeTipo,
} from '@/lib/tipo-documento-entrada'

type NotaPendente = {
  id: string
  chaveNfe: string
  tipoDocumento?: string | null
  nomeEmitente: string | null
  documentoEmitente: string | null
  tipoNfe?: string | null
  valorTotal: number | null
  dataEmissao: string | null
  situacao: string | null
  statusEntrada: string
  origem: string
  etapaAtual: string
  nfeCompleta?: boolean
  cnpjEmpresa?: string | null
  temDanfe?: boolean
  danfeStatus?: string | null
  /** CT-e↔NF de mercadoria já vinculados */
  temVinculoFrete?: boolean
  chaveNfeReferenciada?: string | null
}

type JobStatus = {
  id: string
  status: string
  progresso: number
  mensagem: string | null
  logResumo: string | null
}

type CotaFocus = {
  habilitada: boolean
  usados: number
  cota: number
  restantes: number
  mesReferencia: string
  custoExtraCentavos: number
}

type RecursosDocumento = {
  verNota: boolean
  baixarXml: boolean
  baixarPdfFocus: boolean
  danfeCacheIndisponivelHoras: number
  danfeRateLimitMinutos: number
}

const RECURSOS_PADRAO: RecursosDocumento = {
  verNota: true,
  baixarXml: true,
  baixarPdfFocus: true,
  danfeCacheIndisponivelHoras: 24,
  danfeRateLimitMinutos: 2,
}

type DetalhesCotaEsgotada = {
  usados?: number
  cota?: number
  custoExtraCentavos?: number
  mesReferencia?: string
}

function extrairCotaEsgotada(erro: unknown): DetalhesCotaEsgotada | null {
  if (!erro || typeof erro !== 'object') return null
  const axiosErro = erro as {
    response?: {
      status?: number
      data?: {
        codigo?: string
        detalhes?: DetalhesCotaEsgotada
      }
    }
  }
  if (axiosErro.response?.status !== 402) return null
  if (axiosErro.response.data?.codigo !== 'COTA_ESGOTADA') return null
  return axiosErro.response.data.detalhes ?? {}
}

function formatarCustoExtraCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

type PainelEntrada =
  | 'analise'
  | 'aguardando_chegada'
  | 'contagem'
  | 'consolidada'
  | 'problemas'
  | 'cancelada'

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
  { id: 'aguardando_chegada', rotulo: 'Aguardando chegada' },
  { id: 'contagem', rotulo: 'Liberadas p/ contagem' },
  { id: 'consolidada', rotulo: 'Entradas consolidadas' },
  { id: 'problemas', rotulo: 'Com problemas' },
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
  const limpo = doc.toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (limpo.length === 14 || /[A-Z]/.test(limpo)) return mascaraCnpj(doc)
  if (limpo.length === 11) return mascaraCpf(limpo)
  return doc
}

function ehArquivoXml(nome: string): boolean {
  return nome.toLowerCase().endsWith('.xml')
}

function rotuloOrigem(origem: string): string {
  if (origem === 'xml') return 'XML Manual'
  if (origem === 'focus') return 'Automática'
  return origem || '—'
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
  const [ctesForaDoFiltroData, setCtesForaDoFiltroData] = useState(0)
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [filtrosProntos, setFiltrosProntos] = useState(false)
  const [reprocessando, setReprocessando] = useState(false)
  const [xmlModal, setXmlModal] = useState<XmlVisualizacao | null>(null)
  const [xmlCarregandoId, setXmlCarregandoId] = useState<string | null>(null)
  const [liberandoId, setLiberandoId] = useState<string | null>(null)
  const [downloadRotulo, setDownloadRotulo] = useState('')
  const [pagina, setPagina] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState<ItensPorPagina>(10)
  const [cotaFocus, setCotaFocus] = useState<CotaFocus | null>(null)
  const [recursosDoc, setRecursosDoc] = useState<RecursosDocumento>(RECURSOS_PADRAO)
  const [modalCotaAberto, setModalCotaAberto] = useState(false)
  const [detalhesCotaModal, setDetalhesCotaModal] = useState<DetalhesCotaEsgotada | null>(null)
  const { ordenacao, alternarOrdenacao } = useOrdenacaoColunas<
    'emissao' | 'tipo' | 'fornecedor' | 'chave' | 'valor' | 'origem' | 'etapa'
  >()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputArquivosRef = useRef<HTMLInputElement | null>(null)
  const vinculoFornecedorFeitoRef = useRef(false)
  const vinculoCteFeitoRef = useRef(false)
  const painelAnalise = painel === 'analise'

  const carregarCota = useCallback(async () => {
    try {
      const { data } = await clienteHttp.get<{ cota: CotaFocus }>('/focus-nfe/cota')
      setCotaFocus(data.cota)
    } catch {
      /* cota é informativa — não bloqueia a tela */
    }
  }, [])

  const carregarRecursosDocumento = useCallback(async () => {
    try {
      const { data } = await clienteHttp.get<{ recursos: RecursosDocumento }>(
        '/focus-nfe/recursos-documento'
      )
      if (data.recursos) setRecursosDoc(data.recursos)
    } catch {
      /* herda padrões até a API responder */
    }
  }, [])

  useEffect(() => {
    void carregarRecursosDocumento()
  }, [carregarRecursosDocumento])

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
  }, [painel, dataDe, dataAte, buscaDebounced, itensPorPagina, ordenacao])

  const notasOrdenadas = useMemo(
    () =>
      ordenarLista(notas, ordenacao, (n, coluna) => {
        switch (coluna) {
          case 'emissao':
            return n.dataEmissao ? new Date(n.dataEmissao).getTime() : 0
          case 'tipo':
            return n.tipoDocumento ?? ''
          case 'fornecedor':
            return n.nomeEmitente ?? ''
          case 'chave':
            return n.chaveNfe
          case 'valor':
            return n.valorTotal ?? 0
          case 'origem':
            return rotuloOrigem(n.origem)
          case 'etapa':
            return n.etapaAtual
        }
      }),
    [notas, ordenacao]
  )

  const totalPaginas = Math.max(1, Math.ceil(notasOrdenadas.length / itensPorPagina))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const listaPaginada = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina
    return notasOrdenadas.slice(inicio, inicio + itensPorPagina)
  }, [notasOrdenadas, paginaAtual, itensPorPagina])

  const carregar = useCallback(async (opcoes?: { silencioso?: boolean }) => {
    if (!opcoes?.silencioso) setCarregando(true)
    setErro('')
    try {
      const params: Record<string, string> = { painel }
      if (dataDe) params.dataDe = dataDe
      if (dataAte) params.dataAte = dataAte
      if (buscaDebounced) params.busca = buscaDebounced
      const { data } = await clienteHttp.get<{
        notas: NotaPendente[]
        ctesForaDoFiltroData?: number
      }>('/focus-nfe/nfe-recebidas', { params })
      setNotas(data.notas)
      setCtesForaDoFiltroData(
        typeof data.ctesForaDoFiltroData === 'number' ? data.ctesForaDoFiltroData : 0
      )
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível listar as notas.'))
    } finally {
      if (!opcoes?.silencioso) setCarregando(false)
    }
  }, [dataDe, dataAte, painel, buscaDebounced])

  useEffect(() => {
    if (!filtrosProntos) return
    carregar()
    void carregarCota()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [carregar, carregarCota, filtrosProntos])

  async function acompanharJob(
    jobId: string,
    opcoes?: { limparFiltroData?: boolean; atualizarLista?: boolean }
  ): Promise<'ok' | 'erro'> {
    if (pollRef.current) clearInterval(pollRef.current)
    setMensagem('Sincronizando em lotes (NFe + NFS-e + CTe)…')

    const atualizarLista = opcoes?.atualizarLista !== false

    return new Promise((resolve) => {
      pollRef.current = setInterval(async () => {
        try {
          const { data } = await clienteHttp.get<{ job: JobStatus }>(`/focus-nfe/jobs/${jobId}`)
          setJob(data.job)
          if (data.job.status === 'ok' || data.job.status === 'erro') {
            if (pollRef.current) clearInterval(pollRef.current)
            pollRef.current = null
            setSincronizando(false)
            if (data.job.status === 'ok') {
              const msg =
                data.job.mensagem ??
                'Sincronização concluída. Use Ver todas (sem data) se o filtro esconder notas.'
              setMensagem(msg)
              if (opcoes?.limparFiltroData && (dataDe || dataAte)) {
                setDataDe('')
                setDataAte('')
              } else if (atualizarLista) {
                await carregar()
              }
              resolve('ok')
            } else {
              setErro(data.job.mensagem ?? 'Falha na sincronização.')
              if (atualizarLista) await carregar({ silencioso: true })
              resolve('erro')
            }
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          setSincronizando(false)
          resolve('erro')
        }
      }, 1500)
    })
  }

  /** Reprocessar XMLs + vincular fornecedores/CT-e + atualizar lista (sem sync Focus). */
  async function executarPosSyncLocal(opcoes?: {
    forcarRetryFocus?: boolean
    prefixoMensagem?: string
  }): Promise<boolean> {
    let falhouReprocessar = false
    let mensagemReproc = ''
    setReprocessando(true)
    setDownloadRotulo('Completando dados…')
    try {
      const { data: reproc } = await clienteHttp.post<{
        mensagem: string
        processados: number
      }>('/focus-nfe/nfe-recebidas/reprocessar-xmls')
      mensagemReproc = reproc.mensagem
    } catch (err) {
      falhouReprocessar = true
      setErro(extrairMensagemApi(err, 'Falha ao reprocessar XMLs.'))
    }

    setDownloadRotulo('Vinculando fornecedores…')
    const vinculadas = await vincularFornecedoresPendentes({
      silencioso: true,
      semRecarregar: true,
    })

    setDownloadRotulo('Vinculando CT-es…')
    const loteCte = await vincularCtesPendentes({
      silencioso: true,
      forcarRetryFocus: opcoes?.forcarRetryFocus !== false,
    })

    setDownloadRotulo('Atualizando lista…')
    await carregar()
    await carregarCota()
    if (!falhouReprocessar) {
      const partes: string[] = []
      if (opcoes?.prefixoMensagem) partes.push(opcoes.prefixoMensagem)
      if (mensagemReproc) partes.push(mensagemReproc)
      if (vinculadas > 0) partes.push(`${vinculadas} fornecedor(es) vinculado(s).`)
      if (loteCte.vinculados > 0) {
        partes.push(`${loteCte.vinculados} CT-e(s) vinculado(s).`)
      } else if (loteCte.pendentes > 0) {
        partes.push(
          `${loteCte.pendentes} CT-e(s) aguardando NF (Focus sem XML — importe o XML da mercadoria).`
        )
      }
      if ((loteCte.vinculosReparados ?? 0) > 0) {
        partes.push(`${loteCte.vinculosReparados} vínculo(s) CT-e corrigido(s) (tomador ≠ empresa).`)
      }
      if ((loteCte.ctesCanceladosTomador ?? 0) > 0) {
        partes.push(
          `${loteCte.ctesCanceladosTomador} CT-e(s) cancelado(s) (tomador ≠ empresa).`
        )
      }
      setMensagem(partes.length > 0 ? partes.join(' ') : 'Busca concluída.')
    }
    return !falhouReprocessar
  }

  /** Um clique: sync Focus (NFe+NFS-e+CTe) → completar XMLs locais → vincular fornecedores → atualizar lista. */
  async function executarBuscar(opcoes?: { liberarExtras?: boolean }) {
    if (sincronizando || importando || reprocessando) return
    setErro('')
    setMensagem('')
    setJob(null)
    setSincronizando(true)
    setDownloadRotulo('Buscando na Focus…')
    let focusPuladaPorCota = false
    let detalhesCotaSkip: DetalhesCotaEsgotada | null = null
    let syncOk = false

    try {
      try {
        const { data } = await clienteHttp.post<{ jobId: string; status: string }>(
          '/focus-nfe/jobs/sincronizar',
          { completo: false, liberarExtras: opcoes?.liberarExtras === true }
        )
        setMensagem('Buscando na Focus (NFe + NFS-e + CTe)…')
        const resultado = await acompanharJob(data.jobId, { atualizarLista: false })
        if (resultado === 'erro') return
        syncOk = true
      } catch (err) {
        const detalhesCota = extrairCotaEsgotada(err)
        if (detalhesCota && !opcoes?.liberarExtras) {
          focusPuladaPorCota = true
          detalhesCotaSkip = detalhesCota
          setErro('')
          setMensagem(
            'Cota mensal esgotada — Focus não consultada. Atualizando dados locais…'
          )
        } else {
          setErro(extrairMensagemApi(err, 'Não foi possível iniciar a sync.'))
          return
        }
      }

      if (!syncOk && !focusPuladaPorCota) return

      await executarPosSyncLocal({
        forcarRetryFocus: !focusPuladaPorCota,
        prefixoMensagem: focusPuladaPorCota
          ? 'Cota mensal esgotada — Focus não consultada; dados locais atualizados.'
          : undefined,
      })

      if (focusPuladaPorCota && detalhesCotaSkip) {
        setDetalhesCotaModal(detalhesCotaSkip)
        setModalCotaAberto(true)
      }
    } finally {
      setSincronizando(false)
      setReprocessando(false)
      setDownloadRotulo('')
    }
  }

  function confirmarLiberarExtrasCota() {
    setModalCotaAberto(false)
    setDetalhesCotaModal(null)
    void executarBuscar({ liberarExtras: true })
  }

  async function vincularFornecedoresPendentes(opcoes?: {
    silencioso?: boolean
    semRecarregar?: boolean
  }) {
    try {
      const { data } = await clienteHttp.post<{ vinculadas: number }>(
        '/entrada-notas/vincular-fornecedores-pendentes'
      )
      if (data.vinculadas > 0) {
        if (!opcoes?.silencioso) {
          setMensagem(
            `${data.vinculadas} nota(s) vinculada(s) automaticamente a fornecedor cadastrado.`
          )
        }
        if (!opcoes?.semRecarregar) {
          await carregar({ silencioso: true })
        }
      }
      return data.vinculadas
    } catch {
      return 0
    }
  }

  async function vincularCtesPendentes(opcoes?: {
    silencioso?: boolean
    forcarRetryFocus?: boolean
  }) {
    try {
      const { data } = await clienteHttp.post<{
        vinculados: number
        importadosFocus: number
        analisados: number
        pendentes: number
        vinculosReparados?: number
        ctesCanceladosTomador?: number
      }>('/entrada-notas/vincular-ctes-pendentes', {
        importarFocusSeAusente: true,
        forcarRetryFocus: opcoes?.forcarRetryFocus === true,
      })
      const reparados = data.vinculosReparados ?? 0
      const canceladosTomador = data.ctesCanceladosTomador ?? 0
      if (data.vinculados > 0 && !opcoes?.silencioso) {
        setMensagem(
          `${data.vinculados} CT-e(s) vinculado(s) à NF de mercadoria` +
            (data.importadosFocus > 0
              ? ` (${data.importadosFocus} NF buscada(s) na Focus).`
              : '.')
        )
      }
      if (data.vinculados > 0 || reparados > 0 || canceladosTomador > 0) {
        await carregar({ silencioso: true })
      }
      return {
        vinculados: data.vinculados,
        pendentes: data.pendentes,
        importadosFocus: data.importadosFocus,
        vinculosReparados: reparados,
        ctesCanceladosTomador: canceladosTomador,
      }
    } catch {
      return {
        vinculados: 0,
        pendentes: 0,
        importadosFocus: 0,
        vinculosReparados: 0,
        ctesCanceladosTomador: 0,
      }
    }
  }

  // Ao entrar: tenta vincular fornecedor nas notas já puxadas (API local — sem Focus).
  useEffect(() => {
    if (!filtrosProntos) return
    if (vinculoFornecedorFeitoRef.current) return
    vinculoFornecedorFeitoRef.current = true
    void vincularFornecedoresPendentes({ silencioso: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez por visita
  }, [filtrosProntos])

  // Ao entrar / F5: vínculo local + Focus só se ainda não tentou (não martela DistDFe).
  // Retry Focus de todas as chaves: botão BUSCAR (forcarRetryFocus: true).
  useEffect(() => {
    if (!filtrosProntos) return
    if (vinculoCteFeitoRef.current) return
    vinculoCteFeitoRef.current = true
    void vincularCtesPendentes({ silencioso: true, forcarRetryFocus: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez por visita
  }, [filtrosProntos])

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
    if (!recursosDoc.baixarPdfFocus) {
      setErro('Baixar PDF não está disponível no plano da empresa.')
      return
    }
    const bloqueadoFocus =
      !n.temDanfe &&
      (n.danfeStatus === 'indisponivel' || n.danfeStatus === 'rate_limit')
    if (bloqueadoFocus) {
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
      a.download = `${prefixoPdfDocumento(n.tipoDocumento)}-${n.chaveNfe || n.id}.pdf`
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

  async function liberarParaContagem(id: string) {
    setLiberandoId(id)
    setErro('')
    try {
      await clienteHttp.post(`/entrada-notas/${id}/liberar-para-contagem`)
      setMensagem('Nota liberada para contagem — a logística já pode conferir em Contagens de entrada.')
      await carregar({ silencioso: true })
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível liberar a nota para contagem.'))
    } finally {
      setLiberandoId(null)
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

  const barraSyncAtiva = (sincronizando || reprocessando) && !xmlCarregandoId
  const barraRotulo = xmlCarregandoId
    ? downloadRotulo || 'Carregando…'
    : sincronizando
      ? job?.mensagem || downloadRotulo || 'Sincronizando Focus…'
      : reprocessando
        ? downloadRotulo || 'Completando dados…'
        : downloadRotulo || 'Carregando…'

  return (
    <div className="min-w-0 space-y-6">
      <BarraCarregamentoDownload
        ativo={Boolean(xmlCarregandoId) || barraSyncAtiva}
        rotulo={barraRotulo}
      />
      <TituloPagina
        caminho="Fiscal > Entrada de Notas"
        subtitulo={
          <>
            O sistema sincroniza sozinho a cada ~2 min (<strong>NFe 55</strong>, <strong>NFS-e</strong> e{' '}
            <strong>CTe</strong> em que a empresa é tomadora do frete). Use <strong>BUSCAR</strong> para forçar
            agora (lotes de até 10). Filtros e pesquisa leem só o banco local.
          </>
        }
      >
        Entrada de Notas
      </TituloPagina>

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
        <div className="space-y-1 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          <p>{mensagem}</p>
          {(mensagem.includes('DistDFe') || mensagem.includes('0 NFe')) && (
            <p className="text-xs text-muted-foreground">
              Meta: NFe + NFS-e + CTe. Se só NFS-e veio, ligue Recebimento de NFes/CTe na Focus e use{' '}
              <strong>Ver todas (sem data)</strong>.
            </p>
          )}
        </div>
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
            ? 'Sync automático ~2 min; BUSCAR força agora (Focus + completar + lista)'
            : painel === 'aguardando_chegada'
              ? 'Nota de revenda lançada — aguardando chegada física da mercadoria. Libere para a logística iniciar a contagem.'
              : painel === 'consolidada'
                ? 'Notas com entrada consolidada. NFe com estoque lançado (físico + fiscal). NFS-e/CTe documentais não movimentam estoque.'
                : painel === 'contagem'
                  ? 'Liberadas para contagem — logística confere em Contagens; consolidar só após contagem OK (NFe produto)'
                  : 'Lista do banco local — use Filtrar para atualizar'
        }
      >
        {painelAnalise && (
          <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={ocupado}
              onClick={() => void executarBuscar()}
            >
              {ocupado && (sincronizando || reprocessando) ? (
                <>
                  <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
                  Buscando…
                </>
              ) : (
                'BUSCAR'
              )}
            </Button>
            {cotaFocus?.habilitada && (
              <span
                className="text-xs text-muted-foreground"
                title={`Mês ${cotaFocus.mesReferencia}. Extra: ${formatarCustoExtraCentavos(cotaFocus.custoExtraCentavos)} por nota.`}
              >
                Notas Focus:{' '}
                <strong className="text-foreground">
                  {Math.min(cotaFocus.usados, cotaFocus.cota)}/{cotaFocus.cota}
                </strong>
                {cotaFocus.usados > cotaFocus.cota
                  ? ` (+${cotaFocus.usados - cotaFocus.cota} extras)`
                  : ''}
              </span>
            )}
          </div>
        )}

        <div className="mb-3 flex min-w-0 flex-wrap items-end gap-3">
          <div className="min-w-0 w-full flex-1 space-y-1 sm:min-w-[12rem]">
            <Label htmlFor="filtro-busca">Pesquisar na lista</Label>
            <input
              id="filtro-busca"
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Emitente, valor ou chave (banco local)…"
              className={classesCampoLista}
            />
          </div>
          <div className="min-w-0 w-full space-y-1 sm:w-auto">
            <Label htmlFor="filtro-de">Emissão de</Label>
            <input
              id="filtro-de"
              type="date"
              value={dataDe}
              onChange={(e) => setDataDe(e.target.value)}
              className={cn(classesCampoLista, 'sm:w-auto')}
            />
          </div>
          <div className="min-w-0 w-full space-y-1 sm:w-auto">
            <Label htmlFor="filtro-ate">até</Label>
            <input
              id="filtro-ate"
              type="date"
              value={dataAte}
              onChange={(e) => setDataAte(e.target.value)}
              className={cn(classesCampoLista, 'sm:w-auto')}
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

        {filtrosDataAtivos && ctesForaDoFiltroData > 0 && (
          <div
            role="status"
            className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          >
            <span>
              Há <strong>{ctesForaDoFiltroData}</strong> CT-e(s) neste painel fora do período
              filtrado (o sync já gravou no banco — filtro de emissão esconde).
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-amber-400 bg-white"
              onClick={() => {
                setDataDe('')
                setDataAte('')
              }}
            >
              Ver todas (sem data)
            </Button>
          </div>
        )}

        <p className="mb-3 text-sm text-muted-foreground">
          {carregando
            ? 'Carregando…'
            : `${notas.length} nota${notas.length !== 1 ? 's' : ''}`}
        </p>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <CabecalhoColunaOrdenavel
                  className="px-4 py-3"
                  rotulo="Emissão"
                  coluna="emissao"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                />
                <CabecalhoColunaOrdenavel
                  className="px-4 py-3"
                  rotulo="Tipo"
                  coluna="tipo"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                />
                <CabecalhoColunaOrdenavel
                  className="px-4 py-3"
                  rotulo="Fornecedor"
                  coluna="fornecedor"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                />
                <CabecalhoColunaOrdenavel
                  className="hidden px-4 py-3 lg:table-cell"
                  rotulo="Chave"
                  coluna="chave"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                />
                <CabecalhoColunaOrdenavel
                  className="px-4 py-3"
                  rotulo="Valor"
                  coluna="valor"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  alinhamento="right"
                />
                <CabecalhoColunaOrdenavel
                  className="hidden px-4 py-3 md:table-cell"
                  rotulo="Origem"
                  coluna="origem"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                />
                <CabecalhoColunaOrdenavel
                  className="hidden px-4 py-3 md:table-cell"
                  rotulo="Etapa"
                  coluna="etapa"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                />
                <th className="px-4 py-3 font-medium">XML</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <LinhasSkeletonTabela linhas={5} colunas={8} />
              ) : notas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    {painelAnalise
                      ? 'Nenhuma nota neste painel (filtro de datas/busca ativo). Use BUSCAR, Ver todas (sem data) ou importe XML.'
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
                      <div className="flex items-center gap-1.5">
                        <BadgeStatus
                          variante={varianteBadgeTipo(n.tipoDocumento)}
                        >
                          {rotuloTipoDocumentoCurto(n.tipoDocumento)}
                        </BadgeStatus>
                        {n.temVinculoFrete ? (
                          <span
                            title="CT-e e NF de mercadoria vinculados"
                            className="inline-flex text-emerald-600 dark:text-emerald-400"
                          >
                            <CheckCircle2 className="size-4" aria-label="Vinculado" />
                          </span>
                        ) : null}
                      </div>
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
                    <td className="hidden px-4 py-3 lg:table-cell">
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
                    <td className="hidden px-4 py-3 md:table-cell">
                      <BadgeStatus variante="inativo">{rotuloOrigem(n.origem)}</BadgeStatus>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <div className="flex flex-wrap items-center gap-1">
                        <BadgeStatus variante="info">{n.etapaAtual}</BadgeStatus>
                        {n.statusEntrada === 'problema_resolvido' ? (
                          <BadgeStatus variante="sucesso">Resolvida</BadgeStatus>
                        ) : null}
                        {n.statusEntrada === 'com_problema' ? (
                          <BadgeStatus variante="reprovado">Com problema</BadgeStatus>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1">
                        {n.statusEntrada === 'aguardando_chegada' && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={liberandoId === n.id || ocupado}
                            onClick={() => void liberarParaContagem(n.id)}
                          >
                            {liberandoId === n.id ? (
                              <>
                                <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
                                Liberando…
                              </>
                            ) : (
                              'Liberar para contagem'
                            )}
                          </Button>
                        )}
                        {recursosDoc.verNota && (
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
                        )}
                        {recursosDoc.baixarXml && (
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
                        )}
                        {recursosDoc.baixarPdfFocus && (
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
                                ? 'DANFE indisponível na Focus — use Ver nota'
                                : n.danfeStatus === 'rate_limit'
                                  ? 'Aguarde 1–2 min (limite Focus)'
                                  : 'Baixar DANFE/DACTe da Focus'
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
                            prefixoPdfDocumento(n.tipoDocumento)
                          )}
                        </Button>
                        )}
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
        aberto={modalCotaAberto}
        aoFechar={() => {
          setModalCotaAberto(false)
          setDetalhesCotaModal(null)
        }}
        titulo="Cota mensal esgotada"
        descricao="Os dados locais já foram atualizados. Confirme se deseja liberar notas extras na Focus."
        largura="md"
        rodape={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModalCotaAberto(false)
                setDetalhesCotaModal(null)
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={confirmarLiberarExtrasCota}>
              Liberar extras e buscar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          Cota mensal de{' '}
          <strong className="text-foreground">
            {detalhesCotaModal?.cota ?? cotaFocus?.cota ?? 100}
          </strong>{' '}
          notas Focus esgotada
          {detalhesCotaModal?.usados != null
            ? ` (${detalhesCotaModal.usados} usadas)`
            : ''}
          . Cada nota adicional custa{' '}
          <strong className="text-foreground">
            {formatarCustoExtraCentavos(
              detalhesCotaModal?.custoExtraCentavos ??
                cotaFocus?.custoExtraCentavos ??
                10
            )}
          </strong>
          . Deseja liberar a busca mesmo assim?
        </p>
      </Modal>

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
              {recursosDoc.baixarXml && (
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
              )}
              {recursosDoc.baixarPdfFocus && (
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
              )}
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
        descricao="XML de NFe 55 (produto), NFS-e nacional (serviço) ou CTe (transporte). Um arquivo por vez."
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
                className={cn(classesCampoBase, 'min-h-[4.5rem] resize-y py-2 font-mono')}
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
