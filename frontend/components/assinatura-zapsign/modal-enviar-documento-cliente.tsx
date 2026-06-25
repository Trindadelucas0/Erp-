'use client'

import { useRef, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { Modal } from '@/components/ui/modal'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Label } from '@/components/ui/label'

export type ClienteParaAssinatura = {
  id: string
  nome: string
  email: string | null
}

type Props = {
  cliente: ClienteParaAssinatura
  aberto: boolean
  aoFechar: () => void
  aoEnviar: (linkAssinatura: string | null) => void
}

function lerArquivoComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const resultado = reader.result as string
      const base64 = resultado.split(',')[1]
      if (!base64) {
        reject(new Error('Falha ao converter arquivo para base64'))
        return
      }
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo'))
    reader.readAsDataURL(arquivo)
  })
}

export function ModalEnviarDocumentoCliente({ cliente, aberto, aoFechar, aoEnviar }: Props) {
  const inputArquivoRef = useRef<HTMLInputElement>(null)

  const [passo, setPasso] = useState<1 | 2>(1)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [nomeDocumento, setNomeDocumento] = useState('')
  const [erroArquivo, setErroArquivo] = useState('')
  const [erroNome, setErroNome] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [erroGeral, setErroGeral] = useState('')

  function resetar() {
    setPasso(1)
    setArquivo(null)
    setNomeDocumento('')
    setErroArquivo('')
    setErroNome('')
    setErroGeral('')
    setEnviando(false)
    if (inputArquivoRef.current) inputArquivoRef.current.value = ''
  }

  function fechar() {
    if (enviando) return
    resetar()
    aoFechar()
  }

  function aoSelecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setArquivo(f)
    setErroArquivo('')
    if (f && !nomeDocumento) {
      setNomeDocumento(f.name.replace(/\.pdf$/i, ''))
    }
  }

  function validarPasso1(): boolean {
    let valido = true
    if (!arquivo) {
      setErroArquivo('Selecione um arquivo PDF')
      valido = false
    } else if (!arquivo.name.toLowerCase().endsWith('.pdf')) {
      setErroArquivo('Apenas arquivos PDF são aceitos')
      valido = false
    } else if (arquivo.size > 10 * 1024 * 1024) {
      setErroArquivo('O arquivo não pode ultrapassar 10 MB')
      valido = false
    }
    if (!nomeDocumento.trim() || nomeDocumento.trim().length < 3) {
      setErroNome('Nome deve ter pelo menos 3 caracteres')
      valido = false
    }
    return valido
  }

  function avancar() {
    if (validarPasso1()) setPasso(2)
  }

  async function confirmarEnvio() {
    if (!arquivo) return

    if (!cliente.email) {
      setErroGeral(
        `Cliente "${cliente.nome}" não possui e-mail cadastrado. Atualize o cadastro antes de enviar.`
      )
      return
    }

    setEnviando(true)
    setErroGeral('')

    try {
      const base64Pdf = await lerArquivoComoBase64(arquivo)

      const resposta = await clienteHttp.post<{ linkAssinatura: string | null }>(
        '/zapsign/documentos',
        {
          nomeDocumento: nomeDocumento.trim(),
          clienteId: cliente.id,
          base64Pdf,
        }
      )

      resetar()
      aoEnviar(resposta.data.linkAssinatura)
    } catch (err) {
      setErroGeral(extrairMensagemApi(err, 'Erro ao enviar documento. Tente novamente.'))
    } finally {
      setEnviando(false)
    }
  }

  const rodapePasso1 = (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={fechar}>
        Cancelar
      </Button>
      <BotaoPrimario type="button" onClick={avancar}>
        Próximo
      </BotaoPrimario>
    </div>
  )

  const rodapePasso2 = (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={() => setPasso(1)} disabled={enviando}>
        Voltar
      </Button>
      <BotaoPrimario type="button" onClick={confirmarEnvio} disabled={enviando || !cliente.email}>
        {enviando ? 'Enviando...' : 'Confirmar envio'}
      </BotaoPrimario>
    </div>
  )

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      titulo="Enviar contrato para assinatura"
      descricao={
        passo === 1
          ? 'Selecione o PDF e defina o nome do documento.'
          : 'Revise os dados antes de enviar. O signatário receberá o link por e-mail via ZapSign.'
      }
      largura="md"
      rodape={passo === 1 ? rodapePasso1 : rodapePasso2}
    >
      {passo === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="arquivo-pdf">Arquivo PDF</Label>
            <input
              ref={inputArquivoRef}
              id="arquivo-pdf"
              type="file"
              accept="application/pdf,.pdf"
              onChange={aoSelecionarArquivo}
              className="flex w-full cursor-pointer rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-muted-foreground shadow-sm file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            {erroArquivo && (
              <p className="text-sm text-destructive">{erroArquivo}</p>
            )}
            {arquivo && !erroArquivo && (
              <p className="text-xs text-muted-foreground">
                {arquivo.name} — {(arquivo.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>

          <InputPadrao
            rotulo="Nome do documento"
            value={nomeDocumento}
            onChange={(e) => {
              setNomeDocumento(e.target.value)
              if (erroNome) setErroNome('')
            }}
            placeholder="Ex: Contrato de prestação de serviços"
            mensagemDeErro={erroNome}
            maxLength={255}
          />
        </div>
      )}

      {passo === 2 && (
        <div className="space-y-4">
          {erroGeral && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erroGeral}
            </p>
          )}

          <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Cliente</span>
              <p className="mt-0.5">{cliente.nome}</p>
            </div>

            <div>
              <span className="font-medium text-muted-foreground">E-mail do signatário</span>
              {cliente.email ? (
                <p className="mt-0.5">{cliente.email}</p>
              ) : (
                <p className="mt-0.5 text-destructive">
                  E-mail não cadastrado. Atualize o cadastro do cliente antes de continuar.
                </p>
              )}
            </div>

            <div>
              <span className="font-medium text-muted-foreground">Documento</span>
              <p className="mt-0.5">
                {nomeDocumento}
                {arquivo && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({(arquivo.size / 1024).toFixed(0)} KB)
                  </span>
                )}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            A ZapSign enviará o link de assinatura automaticamente para o e-mail acima.
          </p>
        </div>
      )}
    </Modal>
  )
}
