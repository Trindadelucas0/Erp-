'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Paperclip,
  Trash2,
  Download,
  FileText,
  ImageIcon,
  Upload,
  Lock,
} from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { Button } from '@/components/ui/button'
import { formatarDataBr } from '@/lib/contas-a-pagar'
import { prepararImagemAteBytes } from '@/lib/comprimir-imagem-ate-bytes'
import { cn } from '@/lib/utils'

export type AnexoContaPagar = {
  id: string
  nomeArquivo: string
  mimeType: string
  tamanhoBytes: number
  createdAt: string
  usuario?: { id: string; name: string } | null
}

const MAX_BYTES = 2 * 1024 * 1024
const MIMES_OK = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

function mimePelaExtensao(nome: string): string {
  const n = nome.toLowerCase()
  if (n.endsWith('.pdf')) return 'application/pdf'
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  if (n.endsWith('.png')) return 'image/png'
  if (n.endsWith('.webp')) return 'image/webp'
  return ''
}

function resolverMimeArquivo(file: File): string {
  const informado = (file.type || '').toLowerCase()
  if (informado && MIMES_OK.has(informado)) {
    return informado === 'image/jpg' ? 'image/jpeg' : informado
  }
  return mimePelaExtensao(file.name)
}

type Props = {
  contaId: string | null
  somenteLeitura?: boolean
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function ehImagem(mime: string): boolean {
  return mime.startsWith('image/')
}

function lerArquivoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(String(reader.result ?? ''))
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'))
    reader.readAsDataURL(file)
  })
}

function BadgeTipo({ children }: { children: string }) {
  return (
    <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  )
}

export function AnexosContaPagar({ contaId, somenteLeitura = false }: Props) {
  const [anexos, setAnexos] = useState<AnexoContaPagar[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const podeAnexar = Boolean(contaId) && !somenteLeitura

  const carregar = useCallback(async () => {
    if (!contaId) {
      setAnexos([])
      return
    }
    try {
      const { data } = await clienteHttp.get<{ anexos: AnexoContaPagar[] }>(
        `/contas-a-pagar/${contaId}/anexos`
      )
      setAnexos(data.anexos ?? [])
      setErro(null)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Falha ao listar anexos.'))
    }
  }, [contaId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function aoEscolherArquivo(file: File | null) {
    if (!file || !contaId || somenteLeitura) return
    setErro(null)
    setInfo(null)

    const mime = resolverMimeArquivo(file)
    if (!mime || !MIMES_OK.has(mime)) {
      setErro('Tipo não permitido. Use PDF, JPG, PNG ou WEBP.')
      return
    }

    const ehPdf = mime === 'application/pdf'
    if (ehPdf && file.size > MAX_BYTES) {
      setErro('PDF não pode ser superior a 2 MB')
      return
    }

    setEnviando(true)
    try {
      let nomeArquivo = file.name
      let mimeType = mime
      let base64Arquivo: string

      if (!ehPdf) {
        const preparado = await prepararImagemAteBytes(file, MAX_BYTES)
        nomeArquivo = preparado.nomeArquivo
        mimeType = preparado.mimeType
        base64Arquivo = preparado.dataUrl
        if (preparado.feedback) setInfo(preparado.feedback)
      } else {
        base64Arquivo = await lerArquivoBase64(file)
      }

      const { data } = await clienteHttp.post<{ anexo: AnexoContaPagar }>(
        `/contas-a-pagar/${contaId}/anexos`,
        {
          nomeArquivo,
          mimeType,
          base64Arquivo,
        }
      )
      setAnexos((prev) => [data.anexo, ...prev])
    } catch (e) {
      const fallback =
        e instanceof Error ? e.message : 'Não foi possível anexar o arquivo.'
      setErro(extrairMensagemApi(e, fallback))
    } finally {
      setEnviando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function baixar(anexo: AnexoContaPagar) {
    if (!contaId) return
    try {
      const { data } = await clienteHttp.get(
        `/contas-a-pagar/${contaId}/anexos/${anexo.id}/download`,
        { responseType: 'blob' }
      )
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = anexo.nomeArquivo
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Falha ao baixar o anexo.'))
    }
  }

  async function excluir(anexo: AnexoContaPagar) {
    if (!contaId || somenteLeitura) return
    if (!window.confirm(`Excluir o anexo "${anexo.nomeArquivo}"?`)) return
    setErro(null)
    try {
      await clienteHttp.delete(`/contas-a-pagar/${contaId}/anexos/${anexo.id}`)
      setAnexos((prev) => prev.filter((x) => x.id !== anexo.id))
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível excluir o anexo.'))
    }
  }

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <h3 className="text-sm font-medium leading-none">Anexos</h3>
          <p className="text-xs text-muted-foreground">
            Boleto, comprovante ou documento do título
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <BadgeTipo>PDF</BadgeTipo>
          <BadgeTipo>JPG</BadgeTipo>
          <BadgeTipo>PNG</BadgeTipo>
          <BadgeTipo>WEBP</BadgeTipo>
          <BadgeTipo>máx. 2 MB</BadgeTipo>
        </div>
      </div>

      {!contaId ? (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-border/80 bg-muted/30 px-4 py-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Lock className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1 pt-0.5">
            <p className="text-sm font-medium">Grave o título primeiro</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Depois de salvar, anexe PDF (até 2 MB) ou imagem — fotos maiores são reduzidas
              automaticamente para caber no limite.
            </p>
          </div>
        </div>
      ) : (
        <>
          {podeAnexar && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => void aoEscolherArquivo(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                disabled={enviando}
                onClick={() => inputRef.current?.click()}
                onDragEnter={(e) => {
                  e.preventDefault()
                  setArrastando(true)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setArrastando(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  setArrastando(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setArrastando(false)
                  void aoEscolherArquivo(e.dataTransfer.files?.[0] ?? null)
                }}
                className={cn(
                  'flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  arrastando
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-muted/20 hover:border-muted-foreground/40 hover:bg-muted/40',
                  enviando && 'pointer-events-none opacity-60'
                )}
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm ring-1 ring-border">
                  {enviando ? (
                    <Upload className="size-4 animate-pulse" aria-hidden />
                  ) : (
                    <Paperclip className="size-4" aria-hidden />
                  )}
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {enviando ? 'Enviando…' : 'Clique ou arraste um arquivo'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF até 2 MB · imagem maior é convertida automaticamente
                  </p>
                </div>
              </button>
            </>
          )}

          {somenteLeitura && contaId ? (
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              {anexos.length === 0
                ? 'Nenhum anexo neste título (somente visualização).'
                : 'Anexos somente para download neste modo.'}
            </div>
          ) : null}

          {info && (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {info}
            </p>
          )}

          {erro && (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {erro}
            </p>
          )}

          {contaId && anexos.length === 0 && !erro && !somenteLeitura ? (
            <p className="text-center text-xs text-muted-foreground">Nenhum arquivo anexado ainda.</p>
          ) : null}

          {anexos.length > 0 && (
            <ul className="space-y-2">
              {anexos.map((a) => {
                const Icone = ehImagem(a.mimeType) ? ImageIcon : FileText
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icone className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{a.nomeArquivo}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {formatarTamanho(a.tamanhoBytes)} · {formatarDataBr(a.createdAt)}
                        {a.usuario?.name ? ` · ${a.usuario.name}` : ''}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="size-8 p-0"
                        onClick={() => void baixar(a)}
                        aria-label={`Baixar ${a.nomeArquivo}`}
                      >
                        <Download className="size-3.5" />
                      </Button>
                      {!somenteLeitura && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="size-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => void excluir(a)}
                          aria-label={`Excluir ${a.nomeArquivo}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
