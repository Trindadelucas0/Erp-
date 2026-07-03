'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { comprimirImagemProduto, type ResultadoCompressaoProduto } from '@/lib/comprimir-imagem-produto'
import { resolverUrlUpload } from '@/lib/resolver-url-upload'

type Props = {
  urlAtual?: string | null
  disabled?: boolean
  aoComprimir: (resultado: ResultadoCompressaoProduto) => void
  aoRemover?: () => void
}

export function CampoFotoProduto({ urlAtual, disabled, aoComprimir, aoRemover }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [processando, setProcessando] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [erro, setErro] = useState('')

  const imagemExibida = preview ?? resolverUrlUpload(urlAtual)

  async function aoSelecionarArquivo(file: File | undefined) {
    if (!file || disabled) return
    setErro('')
    setProcessando(true)
    try {
      const resultado = await comprimirImagemProduto(file)
      setPreview(resultado.principal.dataUrl)
      setFeedback(resultado.feedback)
      aoComprimir(resultado)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao comprimir imagem')
    } finally {
      setProcessando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function remover() {
    setPreview(null)
    setFeedback('')
    setErro('')
    aoRemover?.()
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Foto do produto</p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
          {imagemExibida ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagemExibida}
              alt="Foto do produto"
              className="size-full object-cover"
            />
          ) : (
            <ImagePlus className="size-8 text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={disabled || processando}
            onChange={(e) => aoSelecionarArquivo(e.target.files?.[0])}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || processando}
              onClick={() => inputRef.current?.click()}
            >
              {processando ? (
                <>
                  <Loader2 className="mr-1 size-4 animate-spin" />
                  Comprimindo...
                </>
              ) : (
                'Selecionar foto'
              )}
            </Button>

            {(imagemExibida || urlAtual) && !disabled && aoRemover && (
              <Button type="button" variant="ghost" size="sm" onClick={remover}>
                <Trash2 className="mr-1 size-4" />
                Remover
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Aceita até 25 MB. Comprime automaticamente para miniatura (~72 KB) e principal (~220 KB).
          </p>

          {feedback && (
            <p className="text-xs text-primary">{feedback}</p>
          )}

          {erro && (
            <p className="text-xs text-destructive">{erro}</p>
          )}
        </div>
      </div>
    </div>
  )
}
