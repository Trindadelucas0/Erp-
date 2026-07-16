'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import {
  abrirWhatsappComMensagem,
  selecionarTelefonesParaAvisoFront,
  type AvisoWhatsappPortal,
  type TelefoneWhatsappAviso,
} from '@/lib/whatsapp-portal'

type Props = {
  aberto: boolean
  telefones: TelefoneWhatsappAviso[]
  texto: string
  aoFechar: () => void
}

export function ModalEscolherTelefoneWhatsapp({ aberto, telefones, texto, aoFechar }: Props) {
  const [selecionado, setSelecionado] = useState<string | null>(null)

  const telefoneAtual = selecionado ?? telefones[0]?.id ?? null

  function confirmar() {
    const telefone = telefones.find((t) => t.id === telefoneAtual) ?? telefones[0]
    if (!telefone) {
      aoFechar()
      return
    }
    abrirWhatsappComMensagem(telefone.valor, texto)
    aoFechar()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Enviar pelo WhatsApp"
      descricao="Escolha o telefone do fornecedor para abrir a mensagem pronta."
      largura="sm"
      rodape={
        <>
          <Button type="button" variant="outline" onClick={aoFechar}>
            Agora não
          </Button>
          <Button type="button" onClick={confirmar}>
            Abrir WhatsApp
          </Button>
        </>
      }
    >
      <ul className="space-y-2">
        {telefones.map((telefone) => (
          <li key={telefone.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-muted/40">
              <input
                type="radio"
                name="telefone-whatsapp"
                className="size-4"
                checked={telefoneAtual === telefone.id}
                onChange={() => setSelecionado(telefone.id)}
              />
              <span className="text-sm font-medium">{telefone.valorFormatado}</span>
              {telefone.whatsapp ? (
                <span className="text-xs text-muted-foreground">WhatsApp</span>
              ) : null}
              {telefone.principal ? (
                <span className="text-xs text-muted-foreground">Principal</span>
              ) : null}
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

/**
 * Processa o retorno da API: abre no número do fornecedor (1 telefone / 1 WhatsApp)
 * ou modal (2+). Preferência pelo telefone marcado como WhatsApp.
 * Sem telefone cadastrado: não abre nada.
 */
export function processarAvisoWhatsappPortal(
  aviso: AvisoWhatsappPortal | null | undefined,
  aoPrecisarEscolher: (dados: { telefones: TelefoneWhatsappAviso[]; texto: string }) => void
): boolean {
  if (!aviso?.avisoWhatsappDisponivel || !aviso.textoWhatsapp) {
    return false
  }

  const telefones = selecionarTelefonesParaAvisoFront(aviso.telefonesWhatsapp ?? [])
  if (telefones.length === 0) {
    return false
  }

  if (telefones.length === 1) {
    abrirWhatsappComMensagem(telefones[0].valor, aviso.textoWhatsapp)
    return false
  }

  aoPrecisarEscolher({ telefones, texto: aviso.textoWhatsapp })
  return true
}
