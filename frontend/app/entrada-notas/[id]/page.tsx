'use client'

import { useCallback, useEffect, useState } from 'react'
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
import {
  ConteudoVisualizacaoNota,
  type VisualizacaoNota,
} from '@/components/entrada-notas/conteudo-visualizacao-nota'
import { BarraCarregamentoDownload } from '@/components/entrada-notas/barra-carregamento-download'
import { Loader2 } from 'lucide-react'

type ResultadoEtapa = {
  status: string
  avisos: string[]
  bloqueios: string[]
}

type Analise = {
  cadastro: ResultadoEtapa
  fiscal: ResultadoEtapa
  negociacao: ResultadoEtapa
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
  produtoId: string | null
  vinculoModo: string | null
  criticaCadastro: boolean
  criticaFiscal: boolean
  criticaNegociacao: boolean
  produto: { id: string; nomeVenda: string; sku: string | null; ncm: string | null; codigoOrigem: string | null } | null
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
  fornecedor: { id: string; nome: string; cnpj: string | null; nomeFantasia: string | null } | null
  analise: Analise | null
  itens: ItemNota[]
}

type ProdutoBusca = { id: string; nomeVenda: string; sku?: string | null; codigoBarras?: string | null }

function EtapaCard({ titulo, etapa }: { titulo: string; etapa: ResultadoEtapa | undefined }) {
  if (!etapa) return null
  const cor =
    etapa.status === 'ok'
      ? 'border-emerald-500/40 bg-emerald-500/5'
      : etapa.status === 'bloqueante'
        ? 'border-destructive/40 bg-destructive/5'
        : 'border-amber-500/40 bg-amber-500/5'
  return (
    <div className={`rounded-md border p-3 text-sm ${cor}`}>
      <p className="font-medium">
        {titulo}: <span className="uppercase">{etapa.status}</span>
      </p>
      {etapa.bloqueios.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-destructive">
          {etapa.bloqueios.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {etapa.avisos.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-amber-700 dark:text-amber-400">
          {etapa.avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ConteudoDetalheEntrada() {
  const params = useParams()
  const router = useRouter()
  const id = String(params.id ?? '')
  const [nota, setNota] = useState<DetalheNota | null>(null)
  const [pedidos, setPedidos] = useState<Array<{ id: string; numero: number; status: string }>>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [obsContato, setObsContato] = useState('')
  const [prazo, setPrazo] = useState('')
  const [senha, setSenha] = useState('')
  const [buscaProduto, setBuscaProduto] = useState('')
  const [produtos, setProdutos] = useState<ProdutoBusca[]>([])
  const [itemVinculando, setItemVinculando] = useState<string | null>(null)
  const [acao, setAcao] = useState(false)
  const [xmlModal, setXmlModal] = useState<{
    id: string
    chaveNfe: string
    tipoDocumento?: string
    visualizacao: VisualizacaoNota
  } | null>(null)
  const [xmlBusy, setXmlBusy] = useState(false)
  const [downloadRotulo, setDownloadRotulo] = useState('')
  const [danfeBloqueado, setDanfeBloqueado] = useState(false)

  const aplicarResposta = useCallback((data: { nota: DetalheNota; pedidosDisponiveis?: typeof pedidos }) => {
    setNota(data.nota)
    setPedidos(data.pedidosDisponiveis ?? [])
    setPrazo(data.nota.prazoPagamentoTexto ?? '')
    setObsContato(data.nota.observacaoContato ?? '')
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.get<{ nota: DetalheNota; pedidosDisponiveis: typeof pedidos }>(
        `/entrada-notas/${id}`
      )
      aplicarResposta(data)
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível carregar a nota.'))
    } finally {
      setCarregando(false)
    }
  }, [id, aplicarResposta])

  useEffect(() => {
    if (id) void carregar()
  }, [id, carregar])

  async function visualizarXml() {
    if (!id) return
    setXmlBusy(true)
    setDownloadRotulo('Abrindo nota…')
    setErro('')
    try {
      const { data } = await clienteHttp.get<{
        id: string
        chaveNfe: string
        tipoDocumento?: string
        visualizacao: VisualizacaoNota
      }>(`/focus-nfe/nfe-recebidas/${id}/xml`, { params: { modo: 'visualizar' } })
      setXmlModal({
        id: data.id,
        chaveNfe: data.chaveNfe,
        tipoDocumento: data.tipoDocumento,
        visualizacao: data.visualizacao,
      })
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível visualizar a nota.'))
    } finally {
      setXmlBusy(false)
      setDownloadRotulo('')
    }
  }

  async function baixarXml() {
    if (!id || !nota) return
    setXmlBusy(true)
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
      a.download = `${nota.chaveNfe || id}.xml`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível baixar o XML.'))
    } finally {
      setXmlBusy(false)
      setDownloadRotulo('')
    }
  }

  async function baixarDanfe() {
    if (!id || !nota || danfeBloqueado) return
    setXmlBusy(true)
    setDownloadRotulo('Baixando PDF…')
    setErro('')
    try {
      const { data } = await clienteHttp.get<ArrayBuffer>(`/focus-nfe/nfe-recebidas/${id}/danfe`, {
        responseType: 'arraybuffer',
      })
      const blob = new Blob([data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${nota.tipoDocumento === 'nfse' ? 'DANFSe' : 'DANFE'}-${nota.chaveNfe || id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setDanfeBloqueado(false)
    } catch (err) {
      const status =
        typeof err === 'object' && err && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined
      if (status === 422 || status === 429) {
        setDanfeBloqueado(true)
      }
      setErro(extrairMensagemApi(err, 'Não foi possível baixar o PDF.'))
    } finally {
      setXmlBusy(false)
      setDownloadRotulo('')
    }
  }

  async function postAcao(path: string, body?: object) {
    setAcao(true)
    setErro('')
    setMensagem('')
    try {
      const { data } = await clienteHttp.post<{ nota?: DetalheNota; pedidosDisponiveis?: typeof pedidos; mensagem?: string; sucesso?: boolean }>(
        `/entrada-notas/${id}${path}`,
        body ?? {}
      )
      if (data.nota) {
        aplicarResposta(data as { nota: DetalheNota; pedidosDisponiveis?: typeof pedidos })
        if (data.nota.statusEntrada === 'entrada_contagem' || data.nota.statusEntrada === 'entrada_consolidada') {
          setMensagem(
            data.nota.origemLancamento === 'automatica'
              ? 'Entrada automática concluída (Liberar para contagem).'
              : `Nota lançada: ${data.nota.statusEntrada}.`
          )
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

  async function buscarProdutos() {
    if (buscaProduto.trim().length < 2) return
    try {
      const { data } = await clienteHttp.get<{ produtos?: ProdutoBusca[] }>(
        '/produtos',
        { params: { q: buscaProduto.trim(), pagina: 1, limite: 20, resumo: 'true' } }
      )
      setProdutos(data.produtos ?? [])
    } catch {
      setProdutos([])
    }
  }

  const finalizada =
    nota?.statusEntrada === 'entrada_contagem' ||
    nota?.statusEntrada === 'entrada_consolidada' ||
    nota?.statusEntrada === 'cancelada'

  const ehNfse = nota?.tipoDocumento === 'nfse'

  if (carregando) {
    return <p className="p-6 text-sm text-muted-foreground">Carregando nota…</p>
  }

  if (!nota) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-destructive">{erro || 'Nota não encontrada.'}</p>
        <Button asChild variant="outline">
          <Link href="/entrada-notas">Voltar</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
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
            {xmlBusy && downloadRotulo.startsWith('Abrindo') ? (
              <>
                <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
                Abrindo…
              </>
            ) : (
              'Ver nota'
            )}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={xmlBusy} onClick={() => void baixarXml()}>
            {xmlBusy && downloadRotulo.includes('XML') ? (
              <>
                <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
                Baixando…
              </>
            ) : (
              'Baixar XML'
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={xmlBusy || danfeBloqueado}
            title={danfeBloqueado ? 'PDF indisponível ou limite Focus — use Ver nota' : 'Baixar PDF (DANFE/DANFSe)'}
            onClick={() => void baixarDanfe()}
          >
            {xmlBusy && downloadRotulo.includes('PDF') ? (
              <>
                <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
                Baixando…
              </>
            ) : (
              'Baixar PDF'
            )}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={acao || finalizada} onClick={() => postAcao('/analisar', { forcarReparseItens: true })}>
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
            <Button type="button" variant="outline" onClick={() => void baixarXml()} disabled={xmlBusy}>
              Baixar XML
            </Button>
            <Button
              type="button"
              onClick={() => void baixarDanfe()}
              disabled={xmlBusy || danfeBloqueado}
              title={danfeBloqueado ? 'PDF indisponível ou limite Focus — use Ver nota' : undefined}
            >
              Baixar PDF
            </Button>
          </div>
        }
      >
        {xmlModal?.visualizacao && (
          <ConteudoVisualizacaoNota visualizacao={xmlModal.visualizacao} />
        )}
      </Modal>

      <CardPadrao titulo="Resumo">
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <p>
            <span className="text-muted-foreground">Tipo:</span>{' '}
            {nota.tipoDocumento === 'nfse' ? 'NFS-e (serviço)' : 'NFe 55 (produto)'}
          </p>
          <p>
            <span className="text-muted-foreground">Emitente:</span>{' '}
            {nota.nomeEmitente ?? '—'} ({nota.documentoEmitente ?? '—'})
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
          <p>
            <span className="text-muted-foreground">Críticas liberadas:</span>{' '}
            {nota.criticasLiberadas ? 'sim' : 'não'}
          </p>
        </div>
      </CardPadrao>

      <div className="grid gap-3 md:grid-cols-3">
        <EtapaCard titulo="1. Cadastro" etapa={nota.analise?.cadastro} />
        <EtapaCard titulo="2. Fiscal" etapa={nota.analise?.fiscal} />
        <EtapaCard titulo="3. Negociação" etapa={nota.analise?.negociacao} />
      </div>
      {nota.analise?.fiscal?.bloqueios?.length && !ehNfse ? (
        <p className="text-sm text-muted-foreground">
          Divergência de NCM ou origem: importe da NF para o produto. Problema de CST/CFOP: não
          prossiga — use desconhecimento da operação ou devolução.
        </p>
      ) : null}

      {!finalizada && (
        <CardPadrao titulo="Controles (caminho humano)">
          <p className="mb-3 text-sm text-muted-foreground">
            Liberar críticas exige senha de gerente (divergência fiscal ou de negociação). Contato
            coloca a NF em stand-by. Desconhecimento / não realizada = manifesto Focus.
          </p>
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="senha-criticas">Senha gerente (liberar críticas)</Label>
                <input
                  id="senha-criticas"
                  type="password"
                  className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={acao || !senha.trim()}
                onClick={() => postAcao('/liberar-criticas', { senha })}
              >
                Liberar críticas
              </Button>
            </div>
            <Button type="button" size="sm" variant="outline" disabled={acao} onClick={() => postAcao('/cancelar-liberacao')}>
              Cancelar liberação
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={acao || !obsContato.trim()}
              onClick={() => postAcao('/contato-fornecedor', { observacao: obsContato })}
            >
              Contato fornecedor (stand-by)
            </Button>
            {!ehNfse && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={acao}
                  onClick={() => postAcao('/manifestar', { tipo: 'desconhecimento' })}
                >
                  Desconhecimento da operação
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={acao}
                  onClick={() =>
                    postAcao('/manifestar', {
                      tipo: 'nao_realizada',
                      justificativa: 'Operação não realizada — devolução/recusa na entrada.',
                    })
                  }
                >
                  Operação não realizada (devolução)
                </Button>
              </>
            )}
          </div>
          <div className="mt-3 space-y-1">
            <Label htmlFor="obs">Observação contato</Label>
            <textarea
              id="obs"
              className="min-h-[70px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={obsContato}
              onChange={(e) => setObsContato(e.target.value)}
            />
          </div>
        </CardPadrao>
      )}

      {!ehNfse && (
      <CardPadrao titulo="Negociação — pedido e prazo">
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <div>
            <Label>Pedido de compra</Label>
            <select
              className="mt-1 block rounded-md border bg-background px-3 py-2"
              value={nota.pedidoCompraId ?? ''}
              disabled={finalizada || acao}
              onChange={(e) => {
                if (e.target.value) void postAcao('/definir-pedido', { pedidoCompraId: e.target.value })
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
              className="mt-1 block rounded-md border bg-background px-3 py-2"
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
      )}

      <CardPadrao titulo={ehNfse ? 'Serviço (NFS-e)' : 'Itens da NF'}>
        {ehNfse ? (
          <p className="text-sm text-muted-foreground">
            NFS-e de serviço: não há itens de produto, vínculo por barras/código original nem
            conferência com pedido de compra. Cadastro = prestador como fornecedor. Liberação é
            documental (sem movimento de estoque).
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
                    ? item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    : '—'}
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                GTIN {item.gtin ?? '—'} · cProd {item.codigoProduto ?? '—'} · NCM {item.ncm ?? '—'} · CFOP{' '}
                {item.cfop ?? '—'} · CST {item.cst ?? '—'} · orig {item.origem ?? '—'}
              </p>
              <p className="mt-1">
                Produto:{' '}
                {item.produto
                  ? `${item.produto.nomeVenda} (${item.vinculoModo ?? 'vinculado'})`
                  : 'sem vínculo'}
                {item.criticaCadastro && <span className="ml-2 text-destructive">crítica cadastro</span>}
                {item.criticaFiscal && <span className="ml-2 text-destructive">crítica fiscal</span>}
                {item.criticaNegociacao && <span className="ml-2 text-destructive">crítica negociação</span>}
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
                  {item.produtoId && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={acao}
                      onClick={() =>
                        postAcao('/importar-fiscal-produto', { itemId: item.id, ncm: true, origem: true })
                      }
                    >
                      Importar NCM/origem da NF para o produto
                    </Button>
                  )}
                </div>
              )}
              {itemVinculando === item.id && (
                <div className="mt-3 space-y-2 rounded-md border border-dashed p-3">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                      placeholder="Buscar produto (nome, SKU, barras)…"
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
                            await postAcao('/vincular-item', { itemId: item.id, produtoId: p.id })
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
            <p className="text-sm text-muted-foreground">
              Sem itens. Clique em Reanalisar (reparse XML) ou reimporte o arquivo.
            </p>
          )}
        </div>
        )}
      </CardPadrao>

      {!finalizada && (
        <CardPadrao titulo="4. Lançamento">
          <p className="mb-3 text-sm text-muted-foreground">
            {ehNfse
              ? 'Conferência documental. Liberar para contagem não movimenta estoque. Consolidar exige senha de gerente (só status).'
              : 'Conferência final. Consolidar estoque exige senha de gerente (registra status; ainda não movimenta saldo físico).'}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <BotaoPrimario
              type="button"
              disabled={acao}
              onClick={() => postAcao('/lancar', { modo: 'contagem' })}
            >
              Liberar para contagem
            </BotaoPrimario>
            <div>
              <Label htmlFor="senha-consolidar">Senha gerente</Label>
              <input
                id="senha-consolidar"
                type="password"
                className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={acao || !senha}
              onClick={() => postAcao('/lancar', { modo: 'consolidar', senha })}
            >
              {ehNfse ? 'Consolidar (documental)' : 'Consolidar estoque'}
            </Button>
          </div>
        </CardPadrao>
      )}

      {finalizada && (
        <CardPadrao titulo="Finalizada">
          <p className="text-sm">
            Status <strong>{nota.statusEntrada}</strong>
            {nota.origemLancamento ? ` · origem ${nota.origemLancamento}` : ''}.
          </p>
          <Button className="mt-3" type="button" onClick={() => router.push('/entrada-notas')}>
            Voltar à lista
          </Button>
        </CardPadrao>
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
