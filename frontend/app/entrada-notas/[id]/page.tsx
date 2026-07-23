'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { Abas } from '@/components/ui/abas'
import {
  ConteudoVisualizacaoNota,
  type VisualizacaoNota,
} from '@/components/entrada-notas/conteudo-visualizacao-nota'
import { BarraCarregamentoDownload } from '@/components/entrada-notas/barra-carregamento-download'
import { CheckCircle2 } from 'lucide-react'
import {
  ehDocumentalEntrada,
  prefixoPdfDocumento,
  rotuloTipoDocumentoLongo,
} from '@/lib/tipo-documento-entrada'
import type { StatusDaAba } from '@/hooks/use-validacao-de-abas'

type ResultadoEtapa = {
  status: string
  avisos: string[]
  bloqueios: string[]
  bloqueiosNaoLiberaveis?: string[]
  exigeManifesto?: boolean
}

type Analise = {
  cadastro: ResultadoEtapa
  fiscal: ResultadoEtapa
  negociacao: ResultadoEtapa
  frete?: ResultadoEtapa
  autoLancado?: boolean
  motivoParada?: string | null
}

type ItemNota = {
  id: string
  nItem: number
  descricao: string | null
  gtin: string | null
  codigoProduto: string | null
  ncm: string | null
  cfop: string | null
  cst: string | null
  origem: string | null
  quantidade: number | null
  valorUnitario: number | null
  valorTotal: number | null
  pesoKg?: number | null
  custoFreteRateado?: number | null
  produtoId: string | null
  vinculoModo: string | null
  criticaCadastro: boolean
  criticaFiscal: boolean
  criticaNegociacao: boolean
  produto: {
    id: string
    nomeVenda: string
    sku: string | null
    ncm: string | null
    codigoOrigem: string | null
  } | null
}

type CteVinculado = {
  id: string
  origemVinculo: string
  chaveNfeReferenciada: string | null
  valorFrete: number | null
  cte: {
    id: string
    chaveNfe: string
    nomeEmitente: string | null
    documentoEmitente: string | null
    valorTotal: number | null
    dataEmissao: string | null
    statusEntrada: string
  } | null
}

type DetalheNota = {
  id: string
  chaveNfe: string
  tipoDocumento?: string | null
  nomeEmitente: string | null
  documentoEmitente: string | null
  valorTotal: number | null
  dataEmissao: string | null
  statusEntrada: string
  origem: string
  etapaAtual: string
  criticasLiberadas: boolean
  observacaoContato: string | null
  pedidoCompraId: string | null
  origemLancamento: string | null
  prazoPagamentoXml: string | null
  prazoPagamentoTexto: string | null
  modFrete?: string | null
  chaveNfeReferenciada?: string | null
  exigeCte?: boolean
  regraRateioFrete?: string
  fornecedor: { id: string; nome: string; cnpj: string | null; nomeFantasia: string | null } | null
  analise: Analise | null
  ctesVinculados?: CteVinculado[]
  nfesVinculadas?: Array<{
    id: string
    origemVinculo: string
    nfe: { id: string; chaveNfe: string; nomeEmitente: string | null; valorTotal: number | null; statusEntrada: string } | null
  }>
  despesasFrete?: Array<{ id: string; valor: number | null; status: string; origem: string; pessoaId: string | null }>
  itens: ItemNota[]
}

type ProdutoBusca = { id: string; nomeVenda: string; sku?: string | null; codigoBarras?: string | null }

type AbaId = 'cadastro' | 'fiscal' | 'negociacao' | 'frete' | 'lancamento'

function normalizarNcm(valor?: string | null): string {
  return (valor ?? '').replace(/\D/g, '').trim()
}

function itemPrecisaImportarFiscal(item: ItemNota): boolean {
  if (!item.produtoId || !item.produto) return false
  const ncmNf = normalizarNcm(item.ncm)
  const ncmProd = normalizarNcm(item.produto.ncm)
  if (ncmNf && ncmNf !== ncmProd) return true
  const origNf = (item.origem ?? '').trim()
  const origProd = (item.produto.codigoOrigem ?? '').trim()
  if (origNf && origNf !== origProd) return true
  return false
}

function statusAbaDeEtapa(etapa?: ResultadoEtapa | null): StatusDaAba {
  if (!etapa || etapa.status === 'pendente') return 'idle'
  if (etapa.status === 'ok') return 'valid'
  if (etapa.status === 'bloqueante') return 'error'
  return 'idle'
}

function abaInicial(nota: DetalheNota): AbaId {
  const etapa = nota.etapaAtual
  const motivo = nota.analise?.motivoParada
  if (nota.statusEntrada === 'entrada_contagem' || nota.statusEntrada === 'entrada_consolidada') {
    return 'lancamento'
  }
  // Gate frete (modFrete=1 sem CT-e): abre direto na aba de vínculo manual
  if (motivo === 'frete' || etapa === 'frete') return 'frete'
  if (motivo === 'negociacao' || etapa === 'negociacao') return 'negociacao'
  if (motivo === 'fiscal' || etapa === 'fiscal') return 'fiscal'
  if (motivo === 'cadastro' || etapa === 'cadastro' || etapa === 'servico') return 'cadastro'
  if (etapa === 'lancamento') return 'lancamento'
  return 'cadastro'
}

function rotuloModFrete(mod: string | null | undefined): string {
  const m = (mod ?? '').trim()
  const mapa: Record<string, string> = {
    '0': '0 — Remetente',
    '1': '1 — Destinatário',
    '2': '2 — Terceiros',
    '3': '3 — Próprio remetente',
    '4': '4 — Próprio destinatário',
    '9': '9 — Sem frete',
  }
  return mapa[m] ?? (m || '—')
}

function EtapaResumo({ etapa }: { etapa?: ResultadoEtapa | null }) {
  if (!etapa) return <p className="text-sm text-muted-foreground">Pendente</p>
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium uppercase tracking-wide">{etapa.status}</p>
      {etapa.bloqueios?.map((b) => (
        <p key={b} className="text-destructive">
          {b}
        </p>
      ))}
      {etapa.bloqueiosNaoLiberaveis?.map((b) => (
        <p key={b} className="text-destructive">
          {b}
        </p>
      ))}
      {etapa.avisos?.map((a) => (
        <p key={a} className="text-muted-foreground">
          {a}
        </p>
      ))}
    </div>
  )
}

function ConteudoDetalheEntrada() {
  const params = useParams()
  const router = useRouter()
  const id = String(params.id)
  const [nota, setNota] = useState<DetalheNota | null>(null)
  const [pedidos, setPedidos] = useState<Array<{ id: string; numero: number; status: string }>>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [senha, setSenha] = useState('')
  const [obsContato, setObsContato] = useState('')
  const [prazo, setPrazo] = useState('')
  const [buscaProduto, setBuscaProduto] = useState('')
  const [produtos, setProdutos] = useState<ProdutoBusca[]>([])
  const [itemVinculando, setItemVinculando] = useState<string | null>(null)
  const [acao, setAcao] = useState(false)
  const [xmlBusy, setXmlBusy] = useState(false)
  const [downloadRotulo, setDownloadRotulo] = useState('')
  const [xmlModal, setXmlModal] = useState<{ visualizacao: VisualizacaoNota } | null>(null)
  const [danfeBloqueado, setDanfeBloqueado] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState<AbaId>('cadastro')
  const [chaveCteManual, setChaveCteManual] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const { data } = await clienteHttp.get<{
        nota: DetalheNota
        pedidosDisponiveis: Array<{ id: string; numero: number; status: string }>
      }>(`/entrada-notas/${id}`)
      setNota(data.nota)
      setPedidos(data.pedidosDisponiveis ?? [])
      setObsContato(data.nota.observacaoContato ?? '')
      setPrazo(data.nota.prazoPagamentoTexto ?? '')
      setAbaAtiva(abaInicial(data.nota))
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Falha ao carregar nota.'))
      setNota(null)
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function baixarXml() {
    setXmlBusy(true)
    setDownloadRotulo('Baixando XML…')
    try {
      const resp = await clienteHttp.get(`/focus-nfe/nfe-recebidas/${id}/xml`, {
        responseType: 'blob',
      })
      const blob = new Blob([resp.data], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${prefixoPdfDocumento(nota?.tipoDocumento)}-${nota?.chaveNfe || id}.xml`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Falha ao baixar XML.'))
    } finally {
      setXmlBusy(false)
      setDownloadRotulo('')
    }
  }

  async function baixarDanfe() {
    setXmlBusy(true)
    setDownloadRotulo('Baixando PDF…')
    try {
      const resp = await clienteHttp.get(`/focus-nfe/nfe-recebidas/${id}/danfe`, {
        responseType: 'blob',
      })
      const blob = new Blob([resp.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${prefixoPdfDocumento(nota?.tipoDocumento)}-${nota?.chaveNfe || id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setDanfeBloqueado(false)
    } catch (err) {
      setDanfeBloqueado(true)
      setErro(extrairMensagemApi(err, 'Falha ao baixar PDF.'))
    } finally {
      setXmlBusy(false)
      setDownloadRotulo('')
    }
  }

  async function visualizarXml() {
    setXmlBusy(true)
    setDownloadRotulo('Abrindo nota…')
    try {
      const { data } = await clienteHttp.get<{ visualizacao: VisualizacaoNota }>(
        `/focus-nfe/nfe-recebidas/${id}/xml`,
        { params: { modo: 'visualizar' } }
      )
      setXmlModal({ visualizacao: data.visualizacao })
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Falha ao abrir nota.'))
    } finally {
      setXmlBusy(false)
      setDownloadRotulo('')
    }
  }

  async function postAcao(path: string, body?: Record<string, unknown>) {
    setAcao(true)
    setErro(null)
    setMensagem(null)
    try {
      const { data } = await clienteHttp.post<{
        nota?: DetalheNota
        pedidosDisponiveis?: Array<{ id: string; numero: number; status: string }>
        mensagem?: string
      }>(`/entrada-notas/${id}${path}`, body ?? {})
      if (data.nota) {
        setNota(data.nota)
        setPedidos(data.pedidosDisponiveis ?? [])
        setAbaAtiva(abaInicial(data.nota))
        if (data.nota.origemLancamento === 'automatica') {
          setMensagem('Entrada automática concluída (Liberar para contagem).')
        } else if (
          data.nota.statusEntrada === 'entrada_contagem' ||
          data.nota.statusEntrada === 'entrada_consolidada'
        ) {
          setMensagem(`Nota lançada: ${data.nota.statusEntrada}.`)
        }
      } else if (data.mensagem) {
        setMensagem(data.mensagem)
        await carregar()
      }
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Falha na ação.'))
    } finally {
      setAcao(false)
    }
  }

  async function deleteVinculo(vinculoId: string) {
    setAcao(true)
    setErro(null)
    try {
      const { data } = await clienteHttp.delete<{
        nota?: DetalheNota
        pedidosDisponiveis?: Array<{ id: string; numero: number; status: string }>
      }>(`/entrada-notas/${id}/vinculos-cte/${vinculoId}`)
      if (data.nota) {
        setNota(data.nota)
        setPedidos(data.pedidosDisponiveis ?? [])
        setAbaAtiva(abaInicial(data.nota))
      } else {
        await carregar()
      }
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Falha ao desvincular CT-e.'))
    } finally {
      setAcao(false)
    }
  }

  async function buscarProdutos() {
    if (buscaProduto.trim().length < 2) return
    try {
      const { data } = await clienteHttp.get<{ produtos?: ProdutoBusca[] }>('/produtos', {
        params: { q: buscaProduto.trim(), pagina: 1, limite: 20, resumo: 'true' },
      })
      setProdutos(data.produtos ?? [])
    } catch {
      setProdutos([])
    }
  }

  const finalizada =
    nota?.statusEntrada === 'entrada_contagem' ||
    nota?.statusEntrada === 'entrada_consolidada' ||
    nota?.statusEntrada === 'cancelada'

  const ehDocumental = ehDocumentalEntrada(nota?.tipoDocumento)
  const ehNfse = nota?.tipoDocumento === 'nfse'
  const ehCte = nota?.tipoDocumento === 'cte'
  const ehNfe55 = !ehDocumental

  const fiscalExigeManifesto =
    nota?.analise?.fiscal?.exigeManifesto === true ||
    (nota?.analise?.fiscal?.bloqueiosNaoLiberaveis?.length ?? 0) > 0 ||
    (nota?.analise?.fiscal?.bloqueios ?? []).some((m) =>
      /sem CFOP|sem CST|desconhecimento da opera/i.test(m)
    )
  const cadastroBloqueante = nota?.analise?.cadastro?.status === 'bloqueante'
  const fiscalBloqueante = nota?.analise?.fiscal?.status === 'bloqueante'
  const negociacaoBloqueante = nota?.analise?.negociacao?.status === 'bloqueante'
  const freteBloqueante = nota?.analise?.frete?.status === 'bloqueante'
  const podeLiberarCriticas = !cadastroBloqueante && !fiscalExigeManifesto
  const motivoBloqueioLiberacao = cadastroBloqueante
    ? 'Cadastro bloqueante não libera por senha — cadastre o fornecedor e vincule produtos, depois reanalise.'
    : fiscalExigeManifesto
      ? 'CST/CFOP impeditivo não libera por senha — use desconhecimento da operação ou devolução.'
      : null

  const abas = useMemo(() => {
    if (!nota) return []
    if (ehNfse) {
      return [
        { id: 'cadastro', rotulo: 'Cadastro', status: statusAbaDeEtapa(nota.analise?.cadastro) },
        { id: 'lancamento', rotulo: 'Lançamento', status: 'idle' as StatusDaAba },
      ]
    }
    if (ehCte) {
      return [
        { id: 'cadastro', rotulo: 'Cadastro', status: statusAbaDeEtapa(nota.analise?.cadastro) },
        { id: 'frete', rotulo: 'Vínculo NF', status: statusAbaDeEtapa(nota.analise?.negociacao) },
        { id: 'lancamento', rotulo: 'Lançamento', status: 'idle' as StatusDaAba },
      ]
    }
    return [
      { id: 'cadastro', rotulo: 'Cadastro', status: statusAbaDeEtapa(nota.analise?.cadastro) },
      { id: 'fiscal', rotulo: 'Fiscal', status: statusAbaDeEtapa(nota.analise?.fiscal) },
      { id: 'negociacao', rotulo: 'Negociação', status: statusAbaDeEtapa(nota.analise?.negociacao) },
      { id: 'frete', rotulo: 'Frete / CT-e', status: statusAbaDeEtapa(nota.analise?.frete) },
      { id: 'lancamento', rotulo: 'Lançamento', status: 'idle' as StatusDaAba },
    ]
  }, [nota, ehNfse, ehCte])

  function abaBloqueada(idAba: string): boolean {
    if (finalizada) return false
    if (ehNfse) return idAba === 'lancamento' && cadastroBloqueante
    if (ehCte) {
      if (idAba === 'frete') return cadastroBloqueante
      if (idAba === 'lancamento') return cadastroBloqueante || negociacaoBloqueante
      return false
    }
    if (idAba === 'fiscal') return cadastroBloqueante
    if (idAba === 'negociacao') {
      return cadastroBloqueante || (fiscalBloqueante && !nota?.criticasLiberadas)
    }
    if (idAba === 'frete') {
      return (
        cadastroBloqueante ||
        (fiscalBloqueante && !nota?.criticasLiberadas) ||
        (negociacaoBloqueante && !nota?.criticasLiberadas)
      )
    }
    if (idAba === 'lancamento') {
      return (
        cadastroBloqueante ||
        fiscalExigeManifesto ||
        (fiscalBloqueante && !nota?.criticasLiberadas) ||
        (negociacaoBloqueante && !nota?.criticasLiberadas) ||
        freteBloqueante
      )
    }
    return false
  }

  if (carregando) {
    return (
      <div className="min-w-0 space-y-6">
        <p className="text-sm text-muted-foreground">Carregando nota…</p>
      </div>
    )
  }

  if (!nota) {
    return (
      <div className="min-w-0 space-y-3">
        <p className="text-sm text-destructive">{erro || 'Nota não encontrada.'}</p>
        <Button asChild variant="outline">
          <Link href="/entrada-notas">Voltar</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      <BarraCarregamentoDownload ativo={xmlBusy} rotulo={downloadRotulo || 'Carregando…'} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/entrada-notas">← Lista</Link>
          </Button>
          <h1 className="text-xl font-semibold">Análise de entrada</h1>
          <p className="font-mono text-xs text-muted-foreground">{nota.chaveNfe}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={xmlBusy} onClick={() => void visualizarXml()}>
            Ver nota
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={xmlBusy} onClick={() => void baixarXml()}>
            Baixar XML
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={xmlBusy || danfeBloqueado}
            onClick={() => void baixarDanfe()}
          >
            Baixar PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={acao || finalizada}
            onClick={() => postAcao('/analisar', { forcarReparseItens: true })}
          >
            Reanalisar
          </Button>
        </div>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}
      {mensagem && <p className="text-sm text-emerald-700 dark:text-emerald-400">{mensagem}</p>}

      <Modal
        aberto={Boolean(xmlModal)}
        aoFechar={() => setXmlModal(null)}
        titulo="Visualizar nota"
        descricao="Documento fiscal legível (emitente, itens e totais)."
        largura="5xl"
        alturaMinimaConteudo="md"
        rodape={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setXmlModal(null)}>
              Fechar
            </Button>
          </div>
        }
      >
        {xmlModal?.visualizacao && <ConteudoVisualizacaoNota visualizacao={xmlModal.visualizacao} />}
      </Modal>

      <CardPadrao titulo="Resumo">
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground">Tipo:</span>{' '}
            {rotuloTipoDocumentoLongo(nota.tipoDocumento)}
            {((nota.nfesVinculadas?.length ?? 0) > 0 ||
              (nota.ctesVinculados?.length ?? 0) > 0) && (
              <span
                title="CT-e e NF de mercadoria vinculados"
                className="inline-flex text-emerald-600 dark:text-emerald-400"
              >
                <CheckCircle2 className="size-4" aria-label="Vinculado" />
              </span>
            )}
          </p>
          <p>
            <span className="text-muted-foreground">Emitente:</span> {nota.nomeEmitente ?? '—'} (
            {nota.documentoEmitente ?? '—'})
          </p>
          <p>
            <span className="text-muted-foreground">Fornecedor ERP:</span>{' '}
            {nota.fornecedor?.nome ?? 'não vinculado'}
          </p>
          <p>
            <span className="text-muted-foreground">Valor:</span>{' '}
            {nota.valorTotal != null
              ? nota.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              : '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Status:</span> {nota.statusEntrada}
          </p>
          <p>
            <span className="text-muted-foreground">Etapa:</span> {nota.etapaAtual}
          </p>
          {ehNfe55 && (
            <p>
              <span className="text-muted-foreground">Frete (modFrete):</span> {rotuloModFrete(nota.modFrete)}
            </p>
          )}
        </div>
      </CardPadrao>

      <Abas
        abas={abas}
        abaAtiva={abaAtiva}
        aoMudar={(idAba) => setAbaAtiva(idAba as AbaId)}
        abaDesabilitada={abaBloqueada}
      />

      {abaAtiva === 'cadastro' && (
        <div className="space-y-4">
          <CardPadrao titulo="Análise de cadastro">
            <EtapaResumo etapa={nota.analise?.cadastro} />
            {cadastroBloqueante && nota.documentoEmitente ? (
              <div className="mt-3">
                <Link
                  href={`/fornecedores?novo=1&documento=${encodeURIComponent(
                    nota.documentoEmitente.replace(/\D/g, '')
                  )}${
                    nota.nomeEmitente ? `&nome=${encodeURIComponent(nota.nomeEmitente)}` : ''
                  }&retorno=${encodeURIComponent(`/entrada-notas/${nota.id}`)}`}
                >
                  <Button type="button" size="sm">
                    Cadastrar fornecedor
                  </Button>
                </Link>
              </div>
            ) : null}
          </CardPadrao>

          <CardPadrao
            titulo={ehNfse ? 'Serviço (NFS-e)' : ehCte ? 'Transporte (CTe)' : 'Itens — vínculo de produtos'}
          >
            {ehDocumental ? (
              <p className="text-sm text-muted-foreground">
                {ehCte
                  ? 'CTe: cadastre a transportadora (emitente) como fornecedor. O vínculo com a NF de mercadoria fica na aba Vínculo NF / Frete.'
                  : 'NFS-e: cadastre o prestador como fornecedor. Sem itens de produto.'}
              </p>
            ) : (
              <div className="space-y-4">
                {nota.itens.map((item) => (
                  <div key={item.id} className="rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="font-medium">
                        #{item.nItem} {item.descricao ?? '—'}
                      </p>
                      <p className="text-muted-foreground">
                        {item.quantidade ?? '—'} ×{' '}
                        {item.valorUnitario != null
                          ? item.valorUnitario.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })
                          : '—'}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      GTIN {item.gtin ?? '—'} · cProd {item.codigoProduto ?? '—'}
                    </p>
                    <p className="mt-1">
                      Produto:{' '}
                      {item.produto
                        ? `${item.produto.nomeVenda} (${item.vinculoModo ?? 'vinculado'})`
                        : 'sem vínculo'}
                      {item.criticaCadastro && (
                        <span className="ml-2 text-destructive">crítica cadastro</span>
                      )}
                    </p>
                    {!finalizada && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {!item.produtoId && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setItemVinculando(item.id)}
                          >
                            Buscar produto
                          </Button>
                        )}
                        {item.produtoId && item.codigoProduto && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={acao}
                            onClick={() => postAcao('/gravar-codigo-original', { itemId: item.id })}
                          >
                            Gravar código original no vínculo
                          </Button>
                        )}
                      </div>
                    )}
                    {itemVinculando === item.id && (
                      <div className="mt-3 space-y-2 rounded-md border border-dashed p-3">
                        <div className="flex gap-2">
                          <input
                            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                            placeholder="Buscar produto…"
                            value={buscaProduto}
                            onChange={(e) => setBuscaProduto(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void buscarProdutos()
                            }}
                          />
                          <Button type="button" size="sm" onClick={() => void buscarProdutos()}>
                            Buscar
                          </Button>
                        </div>
                        <ul className="max-h-40 space-y-1 overflow-y-auto">
                          {produtos.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                className="w-full rounded px-2 py-1 text-left hover:bg-muted"
                                disabled={acao}
                                onClick={async () => {
                                  await postAcao('/vincular-item', {
                                    itemId: item.id,
                                    produtoId: p.id,
                                  })
                                  setItemVinculando(null)
                                  setProdutos([])
                                  setBuscaProduto('')
                                }}
                              >
                                {p.nomeVenda} {p.sku ? `(${p.sku})` : ''}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
                {nota.itens.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem itens. Reanalisar ou reimporte o XML.</p>
                )}
              </div>
            )}
          </CardPadrao>
        </div>
      )}

      {abaAtiva === 'fiscal' && ehNfe55 && (
        <div className="space-y-4">
          <CardPadrao titulo="Análise fiscal">
            <EtapaResumo etapa={nota.analise?.fiscal} />
            <p className="mt-2 text-sm text-muted-foreground">
              Divergência de NCM/origem: importe da NF ou liberar críticas. CST/CFOP: desconhecimento ou
              devolução.
            </p>
          </CardPadrao>
          <CardPadrao titulo="Itens — NCM / origem / CST">
            <div className="space-y-3">
              {nota.itens.map((item) => (
                <div key={item.id} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    #{item.nItem} {item.descricao ?? '—'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    NCM {item.ncm ?? '—'} · CFOP {item.cfop ?? '—'} · CST {item.cst ?? '—'} · orig{' '}
                    {item.origem ?? '—'}
                  </p>
                  {item.criticaFiscal && <p className="text-destructive">crítica fiscal</p>}
                  {!finalizada && item.produtoId && itemPrecisaImportarFiscal(item) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={acao}
                      onClick={() =>
                        postAcao('/importar-fiscal-produto', {
                          itemId: item.id,
                          ncm: true,
                          origem: true,
                        })
                      }
                    >
                      Importar NCM/origem da NF
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardPadrao>
          {!finalizada && (
            <CardPadrao titulo="Liberar críticas (NCM/origem)">
              {motivoBloqueioLiberacao && (
                <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">{motivoBloqueioLiberacao}</p>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Label htmlFor="senha-criticas-f">Senha gerente</Label>
                  <input
                    id="senha-criticas-f"
                    type="password"
                    className="mt-1 block w-full max-w-xs min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    disabled={!podeLiberarCriticas}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={acao || !senha.trim() || !podeLiberarCriticas}
                  onClick={() => postAcao('/liberar-criticas', { senha })}
                >
                  Liberar críticas
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={acao}
                  onClick={() => postAcao('/cancelar-liberacao')}
                >
                  Cancelar liberação
                </Button>
              </div>
            </CardPadrao>
          )}
        </div>
      )}

      {abaAtiva === 'negociacao' && ehNfe55 && (
        <div className="space-y-4">
          <CardPadrao titulo="Análise de negociação">
            <EtapaResumo etapa={nota.analise?.negociacao} />
          </CardPadrao>
          <CardPadrao titulo="Pedido e prazo">
            <div className="flex flex-wrap items-end gap-3 text-sm">
              <div>
                <Label>Pedido de compra</Label>
                <select
                  className="mt-1 block w-full max-w-xs min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                  value={nota.pedidoCompraId ?? ''}
                  disabled={finalizada || acao}
                  onChange={(e) => {
                    if (e.target.value)
                      void postAcao('/definir-pedido', { pedidoCompraId: e.target.value })
                  }}
                >
                  <option value="">Selecione…</option>
                  {pedidos.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.numero} ({p.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="prazo">Prazo (se NF sem prazo)</Label>
                <input
                  id="prazo"
                  className="mt-1 block w-full max-w-xs min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                  value={prazo}
                  disabled={finalizada}
                  onChange={(e) => setPrazo(e.target.value)}
                  placeholder={nota.prazoPagamentoXml ?? 'Ex.: 30/60 dias'}
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={finalizada || acao || !prazo.trim()}
                onClick={() => postAcao('/definir-prazo', { prazo })}
              >
                Salvar prazo e reanalisar
              </Button>
            </div>
            {nota.prazoPagamentoXml && (
              <p className="mt-2 text-xs text-muted-foreground">Prazo no XML: {nota.prazoPagamentoXml}</p>
            )}
          </CardPadrao>
          {!finalizada && (
            <CardPadrao titulo="Controles">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={acao || !senha.trim() || !podeLiberarCriticas}
                  onClick={() => postAcao('/liberar-criticas', { senha })}
                >
                  Liberar críticas (senha)
                </Button>
                <input
                  type="password"
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Senha gerente"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={acao || !obsContato.trim()}
                  onClick={() => postAcao('/contato-fornecedor', { observacao: obsContato })}
                >
                  Contato fornecedor
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={acao}
                  onClick={() => postAcao('/manifestar', { tipo: 'desconhecimento' })}
                >
                  Desconhecimento
                </Button>
              </div>
              <textarea
                className="mt-3 min-h-[70px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={obsContato}
                onChange={(e) => setObsContato(e.target.value)}
                placeholder="Observação contato"
              />
            </CardPadrao>
          )}
        </div>
      )}

      {abaAtiva === 'frete' && (
        <div className="space-y-4">
          {ehNfe55 && (
            <CardPadrao titulo="Frete da mercadoria">
              <EtapaResumo etapa={nota.analise?.frete} />
              <p className="mt-2 text-sm">
                <span className="text-muted-foreground">modFrete:</span> {rotuloModFrete(nota.modFrete)}
              </p>
              {nota.exigeCte && (
                <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                  Frete por conta do destinatário — é obrigatório ter CT-e vinculado.
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Rateio do frete: regra do fornecedor = {nota.regraRateioFrete ?? 'valor'}
              </p>
            </CardPadrao>
          )}

          {ehCte && (
            <CardPadrao titulo="NF-e referenciada">
              <EtapaResumo etapa={nota.analise?.negociacao} />
              <p className="mt-2 text-sm break-all">
                Chave no XML: {nota.chaveNfeReferenciada ?? 'não encontrada'}
              </p>
              {(nota.nfesVinculadas ?? []).length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {nota.nfesVinculadas!.map((v) => (
                    <li key={v.id}>
                      <Link className="underline" href={`/entrada-notas/${v.nfe?.id}`}>
                        NF …{v.nfe?.chaveNfe?.slice(-8)} — {v.nfe?.nomeEmitente}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Ainda sem vínculo com NF de mercadoria. O sistema busca na Focus pela chave
                    acima.
                  </p>
                  {nota.chaveNfeReferenciada && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={acao || finalizada}
                      onClick={() => postAcao('/analisar')}
                    >
                      Buscar NF pela chave
                    </Button>
                  )}
                </div>
              )}
            </CardPadrao>
          )}

          {ehNfe55 && (
            <CardPadrao titulo="CT-es vinculados">
              {(nota.ctesVinculados ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum CT-e vinculado.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {nota.ctesVinculados!.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
                      <div>
                        <p className="font-medium">
                          …{v.cte?.chaveNfe?.slice(-8)} · {v.cte?.nomeEmitente ?? '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {v.origemVinculo} ·{' '}
                          {(v.valorFrete ?? v.cte?.valorTotal)?.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }) ?? '—'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {v.cte?.id && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/entrada-notas/${v.cte.id}`}>Abrir CT-e</Link>
                          </Button>
                        )}
                        {!finalizada && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={acao}
                            onClick={() => void deleteVinculo(v.id)}
                          >
                            Desvincular
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!finalizada && (
                <div
                  className={
                    nota.exigeCte && (nota.ctesVinculados ?? []).length === 0
                      ? 'mt-4 space-y-3 rounded-md border border-amber-500/50 bg-amber-500/5 p-3'
                      : 'mt-4 space-y-2'
                  }
                >
                  {nota.exigeCte && (nota.ctesVinculados ?? []).length === 0 ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                        Incluir CT-e manualmente
                      </p>
                      <p className="text-xs text-amber-800/90 dark:text-amber-300/90">
                        Frete por conta do destinatário exige CT-e. Se o sync não vinculou
                        automaticamente, cole a chave de acesso do CT-e (44 dígitos) — o
                        documento precisa já estar na Entrada de Notas desta empresa.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Opcional: vincular outro CT-e pela chave.
                    </p>
                  )}
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[240px] flex-1">
                      <Label htmlFor="chave-cte">Chave do CT-e</Label>
                      <input
                        id="chave-cte"
                        className="mt-1 block w-full max-w-xl rounded-md border bg-background px-3 py-2 font-mono text-sm"
                        value={chaveCteManual}
                        onChange={(e) =>
                          setChaveCteManual(e.target.value.replace(/\D/g, '').slice(0, 44))
                        }
                        placeholder="44 dígitos da chave de acesso"
                        autoComplete="off"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={acao || chaveCteManual.length < 44}
                      onClick={() =>
                        postAcao('/vincular-cte', { chaveCte: chaveCteManual }).then(() =>
                          setChaveCteManual('')
                        )
                      }
                    >
                      Vincular CT-e
                    </Button>
                  </div>
                </div>
              )}
            </CardPadrao>
          )}
        </div>
      )}

      {abaAtiva === 'lancamento' && (
        <div className="space-y-4">
          {!finalizada ? (
            <CardPadrao titulo="Lançamento">
              <p className="mb-3 text-sm text-muted-foreground">
                {ehDocumental
                  ? 'Conferência documental. Liberar para contagem não movimenta estoque.'
                  : 'Conferência final. Consolidar exige senha (só status; ledger futuro).'}
              </p>
              {abaBloqueada('lancamento') && (
                <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
                  Resolva as etapas anteriores (cadastro → fiscal → negociação → frete) antes de lançar.
                </p>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <BotaoPrimario
                  type="button"
                  disabled={acao || abaBloqueada('lancamento')}
                  onClick={() => postAcao('/lancar', { modo: 'contagem' })}
                >
                  Liberar para contagem
                </BotaoPrimario>
                <div>
                  <Label htmlFor="senha-consolidar">Senha gerente</Label>
                  <input
                    id="senha-consolidar"
                    type="password"
                    className="mt-1 block w-full max-w-xs min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={acao || !senha || abaBloqueada('lancamento')}
                  onClick={() => postAcao('/lancar', { modo: 'consolidar', senha })}
                >
                  {ehDocumental ? 'Consolidar (documental)' : 'Consolidar estoque'}
                </Button>
              </div>
            </CardPadrao>
          ) : (
            <CardPadrao titulo="Finalizada">
              <p className="text-sm">
                Status <strong>{nota.statusEntrada}</strong>
                {nota.origemLancamento ? ` · origem ${nota.origemLancamento}` : ''}.
              </p>
              {(nota.despesasFrete ?? []).length > 0 && (
                <div className="mt-3 text-sm">
                  <p className="font-medium">Despesas de frete (CT-e)</p>
                  <ul className="mt-1 space-y-1">
                    {nota.despesasFrete!.map((d) => (
                      <li key={d.id}>
                        {d.valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} —{' '}
                        {d.status}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Button className="mt-3" type="button" onClick={() => router.push('/entrada-notas')}>
                Voltar à lista
              </Button>
            </CardPadrao>
          )}
        </div>
      )}
    </div>
  )
}

export default function PaginaDetalheEntradaNota() {
  return (
    <ProtegerRota chaveDaPagina="entrada-notas">
      <ConteudoDetalheEntrada />
    </ProtegerRota>
  )
}
