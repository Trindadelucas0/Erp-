'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { salvarTokenReauth } from '@/lib/reauth-assinatura'
import { InputPadrao } from '@/components/ui/input-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'

type Props = {
  mensagem: string
  onConfirmar: () => void | Promise<void>
  onCancelar: () => void
  carregandoExterno?: boolean
  /** Quando informado, a verificação emite token de reautenticação para o escopo especificado. */
  escopo?: 'assinatura-documentos'
}

export function ConfirmacaoComSenha({
  mensagem,
  onConfirmar,
  onCancelar,
  carregandoExterno = false,
  escopo,
}: Props) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [verificando, setVerificando] = useState(false)

  async function aoConfirmar() {
    if (!senha) {
      setErro('Digite sua senha para confirmar')
      return
    }

    setVerificando(true)
    setErro('')

    try {
      const { data } = await clienteHttp.post('/auth/verificar-senha', {
        senha,
        ...(escopo ? { escopo } : {}),
      })
      if (escopo === 'assinatura-documentos' && data.tokenReauth) {
        salvarTokenReauth(data.tokenReauth, data.expiraEm)
      }
      await onConfirmar()
    } catch (e: unknown) {
      const mensagemErro =
        (e as { response?: { data?: { mensagem?: string } } })?.response?.data
          ?.mensagem ?? 'Senha incorreta'
      setErro(mensagemErro)
    } finally {
      setVerificando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3">
        <Lock className="mt-0.5 size-4 shrink-0 text-destructive" />
        <p className="text-sm text-destructive">{mensagem}</p>
      </div>

      <InputPadrao
        rotulo="Confirme sua senha"
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && aoConfirmar()}
        placeholder="Digite sua senha atual"
        mensagemDeErro={erro}
        autoFocus
      />

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancelar}
          disabled={verificando || carregandoExterno}
        >
          Cancelar
        </Button>
        <BotaoPrimario
          type="button"
          onClick={aoConfirmar}
          disabled={verificando || carregandoExterno}
          variant="destructive"
        >
          {verificando ? 'Verificando...' : 'Confirmar'}
        </BotaoPrimario>
      </div>
    </div>
  )
}
