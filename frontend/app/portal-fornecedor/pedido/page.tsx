'use client'

/**
 * Página pública do pedido no portal do fornecedor.
 * Mostra itens/condições do pedido, permite baixar o Excel e enviar o
 * documento oficial do fornecedor (PDF/XLSX/XLS/CSV) para conferência.
 */
import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clienteHttp } from '@/services/api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { BadgeStatus } from '@/components/ui/badge-status'
import {
  RelatorioConferenciaVisual,
  type RelatorioConferencia,
} from '@/components/conferencia-arquivo/relatorio-conferencia-visual'
import { limparTokenPortalFornecedor, obterTokenPortalFornecedor } from '@/lib/portal-fornecedor'
import { resolverUrlUpload } from '@/lib/resolver-url-upload'
import { cn } from '@/lib/utils'

type StatusConferenciaAnexo = 'pendente' | 'aprovado' | 'ajuste_solicitado'

const ROTULO_STATUS_CONFERENCIA: Record<
  StatusConferenciaAnexo,
  { texto: string; variante: 'ativo' | 'pendente' | 'reprovado' }
> = {
  pendente: { texto: 'Em conferência', variante: 'pendente' },
  aprovado: { texto: 'Aprovado', variante: 'ativo' },
  ajuste_solicitado: { texto: 'Ajuste solicitado', variante: 'reprovado' },
}

type ItemPedidoPortal = {
  codigo: string | null
  produtoNome: string
  unidade: string
  quantidade: number
  precoUnitario: number
  total: number
  urlFotoMiniatura: string | null
}

type AnexoPortal = {
  id: string
  nomeArquivo: string
  enviadoEm: string
  statusConferencia: StatusConferenciaAnexo
  motivoAjuste: string | null
  temRelatorioPdf: boolean
}

type PedidoPortal = {
  numero: number
  fornecedorNome: string
  transportadoraNome: string | null
  modalidadeTransporte: string | null
  condicaoPagamento: string | null
  previsaoEntrega: string | null
  observacoes: string | null
  status: string
  itens: ItemPedidoPortal[]
  anexos: AnexoPortal[]
}

function extrairErro(erro: unknown, padrao: string): string {
  if (erro && typeof erro === 'object' && 'response' in erro) {
    const res = (erro as { response?: { data?: { mensagem?: string; message?: string } } }).response
    if (res?.data?.mensagem) return res.data.mensagem
    if (res?.data?.message) return res.data.message
  }
  return padrao
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function lerArquivoComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const resultado = reader.result as string
      resolve(resultado.includes(',') ? resultado.split(',')[1] : resultado)
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsDataURL(arquivo)
  })
}

export default function PaginaPedidoPortalFornecedor() {
  const router = useRouter()
  const [pedido, setPedido] = useState<PedidoPortal | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviandoUpload, setEnviandoUpload] = useState(false)
  const [mensagemUpload, setMensagemUpload] = useState('')
  const [relatorioAbertoId, setRelatorioAbertoId] = useState<string | null>(null)
  const [relatorios, setRelatorios] = useState<Record<string, RelatorioConferencia>>({})
  const [carregandoRelatorioId, setCarregandoRelatorioId] = useState<string | null>(null)
  const [erroRelatorio, setErroRelatorio] = useState('')

  const carregarPedido = useCallback(async () => {
    const token = obterTokenPortalFornecedor()
    if (!token) {
      router.replace('/portal-fornecedor/login')
      return
    }

    setCarregando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.get('/portal-fornecedor/pedido', {
        headers: { 'X-Portal-Token': token },
      })
      setPedido(data.pedido)
    } catch (e) {
      limparTokenPortalFornecedor()
      setErro(extrairErro(e, 'Sessão expirada. Faça login novamente.'))
      setTimeout(() => router.replace('/portal-fornecedor/login'), 2000)
    } finally {
      setCarregando(false)
    }
  }, [router])

  useEffect(() => {
    carregarPedido()
  }, [carregarPedido])

  function saindo() {
    limparTokenPortalFornecedor()
    router.replace('/portal-fornecedor/login')
  }

  async function baixarExcel() {
    const token = obterTokenPortalFornecedor()
    if (!token) return
    const resposta = await clienteHttp.get('/portal-fornecedor/pedido/excel', {
      headers: { 'X-Portal-Token': token },
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([resposta.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = `pedido-${pedido?.numero ?? ''}.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  async function baixarRelatorioConferencia(anexo: AnexoPortal) {
    const token = obterTokenPortalFornecedor()
    if (!token) return
    const resposta = await clienteHttp.get(
      `/portal-fornecedor/anexos/${anexo.id}/relatorio-pdf`,
      { headers: { 'X-Portal-Token': token }, responseType: 'blob' }
    )
    const url = window.URL.createObjectURL(new Blob([resposta.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = `relatorio-conferencia-pedido-${pedido?.numero ?? ''}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  async function alternarRelatorio(anexo: AnexoPortal) {
    if (relatorioAbertoId === anexo.id) {
      setRelatorioAbertoId(null)
      return
    }

    setRelatorioAbertoId(anexo.id)
    setErroRelatorio('')

    if (relatorios[anexo.id]) return

    const token = obterTokenPortalFornecedor()
    if (!token) return

    setCarregandoRelatorioId(anexo.id)
    try {
      const { data } = await clienteHttp.get(`/portal-fornecedor/anexos/${anexo.id}/relatorio-json`, {
        headers: { 'X-Portal-Token': token },
      })
      setRelatorios((atual) => ({ ...atual, [anexo.id]: data.relatorio }))
    } catch (e) {
      setErroRelatorio(extrairErro(e, 'Erro ao carregar o relatório da conferência.'))
    } finally {
      setCarregandoRelatorioId(null)
    }
  }

  function aoSelecionarArquivo(evento: ChangeEvent<HTMLInputElement>) {
    setArquivo(evento.target.files?.[0] ?? null)
    setMensagemUpload('')
  }

  async function enviarDocumento(evento: FormEvent) {
    evento.preventDefault()
    const token = obterTokenPortalFornecedor()
    if (!token || !arquivo) return

    setEnviandoUpload(true)
    setMensagemUpload('')
    setErro('')
    try {
      const base64Arquivo = await lerArquivoComoBase64(arquivo)
      await clienteHttp.post(
        '/portal-fornecedor/upload',
        { nomeArquivo: arquivo.name, mimeType: arquivo.type, base64Arquivo },
        { headers: { 'X-Portal-Token': token } }
      )
      setMensagemUpload('Documento enviado com sucesso. Nossa equipe vai conferir em breve.')
      setArquivo(null)
      await carregarPedido()
    } catch (e) {
      setErro(extrairErro(e, 'Erro ao enviar o documento.'))
    } finally {
      setEnviandoUpload(false)
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <CardPadrao titulo="Não foi possível carregar o pedido">
          <p className="text-sm text-destructive">{erro}</p>
        </CardPadrao>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pedido #{pedido.numero}</h1>
        <Button variant="outline" size="sm" onClick={saindo}>
          Sair
        </Button>
      </div>

      <CardPadrao titulo="Dados do pedido" descricao={pedido.fornecedorNome}>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Condição de pagamento:</span>{' '}
            {pedido.condicaoPagamento ?? '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Transporte:</span>{' '}
            {pedido.modalidadeTransporte ?? '—'}
            {pedido.transportadoraNome ? ` (${pedido.transportadoraNome})` : ''}
          </p>
          <p>
            <span className="text-muted-foreground">Previsão de entrega:</span>{' '}
            {pedido.previsaoEntrega
              ? new Date(pedido.previsaoEntrega).toLocaleDateString('pt-BR')
              : '—'}
          </p>
        </div>
        {pedido.observacoes && (
          <p className="mt-3 text-sm text-muted-foreground">Obs.: {pedido.observacoes}</p>
        )}
      </CardPadrao>

      <CardPadrao
        titulo="Itens"
        acoes={
          <Button variant="outline" size="sm" onClick={baixarExcel}>
            Baixar Excel
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="w-24 py-2 pr-2">Código</th>
                <th className="py-2 pr-2">Produto</th>
                <th className="w-16 py-2 pr-2">Un.</th>
                <th className="w-20 py-2 pr-2 text-right">Qtd.</th>
                <th className="w-28 py-2 pr-2 text-right">Preço unit.</th>
                <th className="w-28 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {pedido.itens.map((item, indice) => {
                const urlFoto = resolverUrlUpload(item.urlFotoMiniatura)
                return (
                <tr key={indice} className="border-b last:border-0">
                  <td className="whitespace-nowrap py-2 pr-2">{item.codigo ?? '—'}</td>
                  <td className="min-w-0 py-2 pr-2">
                    <div className="flex items-center gap-2">
                      {urlFoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={urlFoto}
                          alt=""
                          className="size-8 shrink-0 rounded object-cover"
                          onError={(evento) => {
                            evento.currentTarget.style.display = 'none'
                            evento.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                      ) : null}
                      <div className={cn('size-8 shrink-0 rounded bg-muted', urlFoto && 'hidden')} />
                      <span className="break-words">{item.produtoNome}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-2">{item.unidade}</td>
                  <td className="whitespace-nowrap py-2 pr-2 text-right">{item.quantidade}</td>
                  <td className="whitespace-nowrap py-2 pr-2 text-right">
                    {formatarMoeda(item.precoUnitario)}
                  </td>
                  <td className="whitespace-nowrap py-2 text-right">{formatarMoeda(item.total)}</td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardPadrao>

      <CardPadrao
        titulo="Enviar seu documento"
        descricao="Envie o pedido, nota ou proposta oficial (PDF, XLSX, XLS ou CSV) para conferência"
      >
        <form onSubmit={enviarDocumento} className="space-y-3">
          <input
            type="file"
            accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            onChange={aoSelecionarArquivo}
            className="block w-full text-sm"
          />

          {erro && <p className="text-sm text-destructive">{erro}</p>}
          {mensagemUpload && <p className="text-sm text-primary">{mensagemUpload}</p>}

          <BotaoPrimario type="submit" disabled={!arquivo || enviandoUpload}>
            {enviandoUpload ? 'Enviando...' : 'Enviar documento'}
          </BotaoPrimario>
        </form>

        {pedido.anexos.length > 0 && (
          <div className="mt-4 space-y-2 border-t pt-3 text-sm">
            <p className="font-medium">Documentos já enviados</p>
            {pedido.anexos.map((anexo) => (
              <div key={anexo.id} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">
                    {anexo.nomeArquivo} — {new Date(anexo.enviadoEm).toLocaleString('pt-BR')}
                  </span>
                  <BadgeStatus variante={ROTULO_STATUS_CONFERENCIA[anexo.statusConferencia].variante}>
                    {ROTULO_STATUS_CONFERENCIA[anexo.statusConferencia].texto}
                  </BadgeStatus>
                </div>
                {anexo.statusConferencia === 'ajuste_solicitado' && anexo.motivoAjuste && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">
                    Motivo do ajuste: {anexo.motivoAjuste}
                  </p>
                )}
                {anexo.temRelatorioPdf && (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => alternarRelatorio(anexo)}
                    >
                      {relatorioAbertoId === anexo.id ? 'Ocultar relatório da conferência' : 'Ver relatório da conferência'}
                    </button>
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => baixarRelatorioConferencia(anexo)}
                    >
                      Baixar PDF
                    </button>
                  </div>
                )}

                {relatorioAbertoId === anexo.id && (
                  <div className="mt-2 space-y-3 rounded-md border p-3">
                    {carregandoRelatorioId === anexo.id && (
                      <p className="text-muted-foreground">Carregando relatório...</p>
                    )}
                    {erroRelatorio && carregandoRelatorioId !== anexo.id && !relatorios[anexo.id] && (
                      <p className="text-destructive">{erroRelatorio}</p>
                    )}
                    {relatorios[anexo.id] && <RelatorioConferenciaVisual relatorio={relatorios[anexo.id]} />}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardPadrao>
    </div>
  )
}
