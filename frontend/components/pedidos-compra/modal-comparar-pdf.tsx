'use client'

import { FormEvent, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Label } from '@/components/ui/label'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'

type Divergencia = {
  campo: string
  esperado: string
  encontrado: string
  severidade: string
}

type Props = {
  aberto: boolean
  pedidoId: string
  numeroPedido: number | string
  aoFechar: () => void
}

async function lerPdfComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsDataURL(arquivo)
  })
}

export function ModalCompararPdf({ aberto, pedidoId, numeroPedido, aoFechar }: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [comparando, setComparando] = useState(false)
  const [erro, setErro] = useState('')
  const [divergencias, setDivergencias] = useState<Divergencia[]>([])
  const [concluido, setConcluido] = useState(false)

  function fechar() {
    setArquivo(null)
    setErro('')
    setDivergencias([])
    setConcluido(false)
    aoFechar()
  }

  async function comparar(e: FormEvent) {
    e.preventDefault()
    if (!arquivo || !pedidoId) {
      setErro('Selecione o PDF do fornecedor.')
      return
    }
    setComparando(true)
    setErro('')
    setDivergencias([])
    try {
      const base64Pdf = await lerPdfComoBase64(arquivo)
      const { data } = await clienteHttp.post(`/pedidos-compra/${pedidoId}/comparar-pdf`, {
        base64Pdf,
      })
      setDivergencias(data.divergencias ?? [])
      setConcluido(true)
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao comparar PDF'))
    } finally {
      setComparando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      titulo={`Comparar pedido #${numeroPedido} com PDF`}
      descricao="Envie o PDF enviado pelo fornecedor para comparar quantidades, preços e totais."
      largura="lg"
      rodape={
        <div className="flex w-full justify-end gap-2">
          <Button type="button" variant="outline" onClick={fechar} disabled={comparando}>
            Fechar
          </Button>
          <BotaoPrimario type="submit" form="form-comparar-pdf" disabled={comparando || !arquivo}>
            {comparando ? 'Comparando...' : 'Comparar com PDF'}
          </BotaoPrimario>
        </div>
      }
    >
      <form id="form-comparar-pdf" onSubmit={comparar} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pdf-fornecedor">PDF do fornecedor</Label>
          <input
            id="pdf-fornecedor"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
        </div>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        {concluido && divergencias.length === 0 && (
          <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
            Nenhuma divergência encontrada entre o pedido digitado e o PDF.
          </p>
        )}

        {divergencias.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-amber-700">
              {divergencias.length} divergência(s) encontrada(s)
            </p>
            <ul className="max-h-60 space-y-2 overflow-y-auto text-sm">
              {divergencias.map((d, i) => (
                <li key={i} className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                  <p className="font-medium">{d.campo}</p>
                  <p className="text-muted-foreground">
                    Esperado: {d.esperado} — Encontrado: {d.encontrado}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Modal>
  )
}
