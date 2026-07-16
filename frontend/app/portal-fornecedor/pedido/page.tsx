'use client'

/**
 * Página pública do pedido no portal do fornecedor.
 * Mostra itens/condições do pedido, permite baixar o Excel e enviar o
 * documento oficial do fornecedor (PDF/XLSX/XLS/CSV) para conferência.
 */
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clienteHttp } from '@/services/api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import {
  CardDocumentoFornecedor,
  formatarDataHoraDocumento,
  rotuloStatusConferencia,
} from '@/components/pedidos-compra/lista-documentos-fornecedor'
import { limparTokenPortalFornecedor, obterTokenPortalFornecedor } from '@/lib/portal-fornecedor'
import { validarArquivoAnexoFornecedor } from '@/lib/anexo-fornecedor'
import { resolverUrlUpload } from '@/lib/resolver-url-upload'
import { cn } from '@/lib/utils'

type StatusConferenciaAnexo = 'pendente' | 'aprovado' | 'ajuste_solicitado'

type ItemPedidoPortal = {
  codigoOriginal: string | null
  codigoBarras: string | null
  produtoNome: string
  unidade: string
  quantidade: number
  urlFotoMiniatura: string | null
}

type AnexoPortal = {
  id: string
  nomeArquivo: string
  enviadoEm: string
  statusConferencia: StatusConferenciaAnexo
  motivoAjuste: string | null
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
  const inputArquivoRef = useRef<HTMLInputElement>(null)

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

  async function baixarArquivoDoPedido(formato: 'excel' | 'pdf') {
    const token = obterTokenPortalFornecedor()
    if (!token) return
    const extensao = formato === 'excel' ? 'xlsx' : 'pdf'
    const resposta = await clienteHttp.get(`/portal-fornecedor/pedido/${formato}`, {
      headers: { 'X-Portal-Token': token },
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([resposta.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = `pedido-${pedido?.numero ?? ''}.${extensao}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  function aoSelecionarArquivo(evento: ChangeEvent<HTMLInputElement>) {
    setArquivo(evento.target.files?.[0] ?? null)
    setMensagemUpload('')
  }

  async function enviarDocumento(evento: FormEvent) {
    evento.preventDefault()
    const token = obterTokenPortalFornecedor()
    if (!token || !arquivo) return

    const validacao = validarArquivoAnexoFornecedor(arquivo.name, arquivo.type)
    if ('erro' in validacao) {
      setErro(validacao.erro)
      return
    }

    setEnviandoUpload(true)
    setMensagemUpload('')
    setErro('')
    try {
      const base64Arquivo = await lerArquivoComoBase64(arquivo)
      await clienteHttp.post(
        '/portal-fornecedor/upload',
        { nomeArquivo: arquivo.name, mimeType: validacao.mimeType, base64Arquivo },
        { headers: { 'X-Portal-Token': token } }
      )
      setMensagemUpload('Documento enviado com sucesso. Nossa equipe vai conferir em breve.')
      setArquivo(null)
      if (inputArquivoRef.current) inputArquivoRef.current.value = ''
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => baixarArquivoDoPedido('pdf')}>
              Baixar PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => baixarArquivoDoPedido('excel')}>
              Baixar Excel
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="w-32 py-2 pr-2">Código de barras</th>
                <th className="w-24 py-2 pr-2">Código original</th>
                <th className="py-2 pr-2">Produto</th>
                <th className="w-16 py-2 pr-2">Un.</th>
                <th className="w-20 py-2 text-right">Qtd.</th>
              </tr>
            </thead>
            <tbody>
              {pedido.itens.map((item, indice) => {
                const urlFoto = resolverUrlUpload(item.urlFotoMiniatura)
                return (
                <tr key={indice} className="border-b last:border-0">
                  <td className="whitespace-nowrap py-2 pr-2">{item.codigoBarras ?? '—'}</td>
                  <td className="whitespace-nowrap py-2 pr-2">{item.codigoOriginal ?? '—'}</td>
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
                  <td className="whitespace-nowrap py-2 text-right">{item.quantidade}</td>
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
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputArquivoRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={aoSelecionarArquivo}
              className="hidden"
              disabled={enviandoUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={enviandoUpload}
              onClick={() => inputArquivoRef.current?.click()}
            >
              Escolher arquivo
            </Button>
            <span className="text-sm text-muted-foreground">
              {arquivo ? arquivo.name : 'Nenhum arquivo escolhido'}
            </span>
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}
          {mensagemUpload && <p className="text-sm text-primary">{mensagemUpload}</p>}

          <BotaoPrimario type="submit" disabled={!arquivo || enviandoUpload}>
            {enviandoUpload ? 'Enviando...' : 'Enviar documento'}
          </BotaoPrimario>
        </form>

        {pedido.anexos.length > 0 && (
          <div className="mt-4 space-y-3 border-t pt-3">
            <p className="text-sm font-medium">Documentos já enviados</p>
            {[...pedido.anexos]
              .sort((a, b) => {
                const aAprovado = a.statusConferencia === 'aprovado' ? 0 : 1
                const bAprovado = b.statusConferencia === 'aprovado' ? 0 : 1
                if (aAprovado !== bAprovado) return aAprovado - bAprovado
                return new Date(b.enviadoEm).getTime() - new Date(a.enviadoEm).getTime()
              })
              .map((anexo) => (
                <CardDocumentoFornecedor
                  key={anexo.id}
                  nomeArquivo={anexo.nomeArquivo}
                  metadados={`enviado ${formatarDataHoraDocumento(anexo.enviadoEm)}`}
                  status={rotuloStatusConferencia(anexo.statusConferencia, {
                    contexto: 'portal',
                  })}
                  destaque={anexo.statusConferencia === 'aprovado'}
                  motivoAjuste={
                    anexo.statusConferencia === 'ajuste_solicitado' ? anexo.motivoAjuste : null
                  }
                />
              ))}
          </div>
        )}
      </CardPadrao>
    </div>
  )
}
