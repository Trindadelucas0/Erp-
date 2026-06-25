'use client'

import { useCallback, useState } from 'react'
import { Lock, LockOpen } from 'lucide-react'
import { estaDesbloqueado, limparTokenReauth } from '@/lib/reauth-assinatura'
import { ConfirmacaoComSenha } from '@/components/compartilhado/confirmacao-com-senha'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Button } from '@/components/ui/button'

type Props = {
  children: React.ReactNode
  /** Texto exibido no card de bloqueio. */
  descricao?: string
}

/**
 * Envolve conteúdo sensível da área de assinatura.
 * Exibe um portão de confirmação de senha enquanto o admin não se autenticar;
 * após desbloqueio (15 min) renderiza os filhos normalmente.
 */
export function PortaoAssinaturaComSenha({
  children,
  descricao = 'Esta seção exige confirmação de senha de administrador.',
}: Props) {
  const [desbloqueado, setDesbloqueado] = useState(() => estaDesbloqueado())

  const aoDesbloquear = useCallback(() => {
    setDesbloqueado(true)
  }, [])

  const bloquear = useCallback(() => {
    limparTokenReauth()
    setDesbloqueado(false)
  }, [])

  if (desbloqueado) {
    return (
      <>
        <div className="flex justify-end mb-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={bloquear}
            className="gap-1.5 text-muted-foreground"
          >
            <Lock className="size-3.5" />
            Bloquear seção
          </Button>
        </div>
        {children}
      </>
    )
  }

  return (
    <CardPadrao
      titulo="Acesso restrito"
      descricao={descricao}
      acoes={<LockOpen className="size-5 text-muted-foreground" />}
    >
      <ConfirmacaoComSenha
        escopo="assinatura-documentos"
        mensagem="Para visualizar ou enviar documentos de assinatura, confirme sua senha de administrador. O acesso ficará ativo por 15 minutos."
        onConfirmar={aoDesbloquear}
        onCancelar={() => {}}
      />
    </CardPadrao>
  )
}
