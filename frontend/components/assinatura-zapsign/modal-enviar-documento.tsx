'use client'

import { useRef, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { Modal } from '@/components/ui/modal'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Label } from '@/components/ui/label'

type Props = {
  aberto: boolean
  aoFechar: () => void
  aoEnviar: () => void
}

type Erros = {
  nomeDocumento?: string
  signatarioNome?: string
  signatarioEmail?: string
  arquivo?: string
}

function extrairMensagem(erro: unknown, padrao: string): string {
  const data = (erro as { response?: { data?: { mensagem?: string } } })?.response?.data
  return data?.mensagem || padrao
}

function lerArquivoComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const resultado = reader.result as string
      // Remove o prefixo "data:application/pdf;base64,"
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

export function ModalEnviarDocumento({ aberto, aoFechar, aoEnviar }: Props) {
  const inputArquivoRef = useRef<HTMLInputElement>(null)

  const [nomeDocumento, setNomeDocumento] = useState('')
  const [signatarioNome, setSignatarioNome] = useState('')
  const [signatarioEmail, setSignatarioEmail] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)

  const [enviando, setEnviando] = useState(false)
  const [erroGeral, setErroGeral] = useState('')
  const [erros, setErros] = useState<Erros>({})

  function fechar() {
    if (enviando) return
    resetar()
    aoFechar()
  }

  function resetar() {
    setNomeDocumento('')
    setSignatarioNome('')
    setSignatarioEmail('')
    setArquivo(null)
    setErros({})
    setErroGeral('')
    if (inputArquivoRef.current) inputArquivoRef.current.value = ''
  }

  function aoSelecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setArquivo(f)
    if (f) setErros((prev) => ({ ...prev, arquivo: undefined }))

    if (f && !nomeDocumento) {
      const nomeSemExtensao = f.name.replace(/\.pdf$/i, '')
      setNomeDocumento(nomeSemExtensao)
    }
  }

  function validar(): boolean {
    const novosErros: Erros = {}

    if (!nomeDocumento.trim() || nomeDocumento.trim().length < 3) {
      novosErros.nomeDocumento = 'Nome deve ter pelo menos 3 caracteres'
    }
    if (!signatarioNome.trim() || signatarioNome.trim().length < 2) {
      novosErros.signatarioNome = 'Nome do signatário é obrigatório'
    }
    if (signatarioEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signatarioEmail)) {
      novosErros.signatarioEmail = 'E-mail inválido'
    }
    if (!arquivo) {
      novosErros.arquivo = 'Selecione um arquivo PDF'
    } else if (!arquivo.name.toLowerCase().endsWith('.pdf')) {
      novosErros.arquivo = 'Apenas arquivos PDF são aceitos'
    } else if (arquivo.size > 10 * 1024 * 1024) {
      novosErros.arquivo = 'O arquivo não pode ultrapassar 10 MB'
    }

    setErros(novosErros)
    return Object.keys(novosErros).length === 0
  }

  async function enviar() {
    if (!validar()) return

    setEnviando(true)
    setErroGeral('')

    try {
      const base64Pdf = await lerArquivoComoBase64(arquivo!)

      await clienteHttp.post('/zapsign/documentos', {
        nomeDocumento: nomeDocumento.trim(),
        signatarioNome: signatarioNome.trim(),
        signatarioEmail: signatarioEmail.trim() || undefined,
        base64Pdf,
      })

      resetar()
      aoEnviar()
    } catch (err) {
      setErroGeral(extrairMensagem(err, 'Erro ao enviar documento. Tente novamente.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      titulo="Enviar documento para assinatura"
      descricao="O signatário receberá um link para assinar eletronicamente via ZapSign."
      largura="md"
      rodape={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={fechar} disabled={enviando}>
            Cancelar
          </Button>
          <BotaoPrimario type="button" onClick={enviar} disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar para assinatura'}
          </BotaoPrimario>
        </div>
      }
    >
      <div className="space-y-4">
        {erroGeral && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erroGeral}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="arquivo-pdf">Arquivo PDF</Label>
          <input
            ref={inputArquivoRef}
            id="arquivo-pdf"
            type="file"
            accept="application/pdf,.pdf"
            onChange={aoSelecionarArquivo}
            disabled={enviando}
            className="flex w-full cursor-pointer rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-muted-foreground shadow-sm file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          {erros.arquivo && (
            <p className="text-sm text-destructive">{erros.arquivo}</p>
          )}
          {arquivo && !erros.arquivo && (
            <p className="text-xs text-muted-foreground">
              {arquivo.name} — {(arquivo.size / 1024).toFixed(0)} KB
            </p>
          )}
        </div>

        <InputPadrao
          rotulo="Nome do documento"
          value={nomeDocumento}
          onChange={(e) => setNomeDocumento(e.target.value)}
          placeholder="Ex: Contrato de prestação de serviços"
          mensagemDeErro={erros.nomeDocumento}
          disabled={enviando}
          maxLength={255}
        />

        <InputPadrao
          rotulo="Nome do signatário"
          value={signatarioNome}
          onChange={(e) => setSignatarioNome(e.target.value)}
          placeholder="Nome completo de quem vai assinar"
          mensagemDeErro={erros.signatarioNome}
          disabled={enviando}
          maxLength={200}
        />

        <InputPadrao
          rotulo="E-mail do signatário (opcional)"
          type="email"
          value={signatarioEmail}
          onChange={(e) => setSignatarioEmail(e.target.value)}
          placeholder="email@exemplo.com.br"
          mensagemDeErro={erros.signatarioEmail}
          disabled={enviando}
        />

        <p className="text-xs text-muted-foreground">
          Se informado, a ZapSign enviará o link de assinatura automaticamente por e-mail.
          Caso contrário, copie o link após o envio.
        </p>
      </div>
    </Modal>
  )
}
