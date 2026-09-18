'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'

type Operador = { id: string; name: string }

type Props = {
  aberto: boolean
  ocupado?: boolean
  aoFechar: () => void
  aoConfirmar: (responsavelId: string) => void
}

export function ModalLiberarParaContagem({ aberto, ocupado, aoFechar, aoConfirmar }: Props) {
  const [operadores, setOperadores] = useState<Operador[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [responsavelId, setResponsavelId] = useState('')

  useEffect(() => {
    if (!aberto) return
    setResponsavelId('')
    setErro('')
    setCarregando(true)
    void clienteHttp
      .get<{ operadores: Operador[] }>('/requisicoes/operadores')
      .then((r) => setOperadores(r.data.operadores ?? []))
      .catch((e) => {
        setOperadores([])
        setErro(extrairMensagemApi(e, 'Não foi possível listar quem pode contar.'))
      })
      .finally(() => setCarregando(false))
  }, [aberto])

  const semOperadores = !carregando && operadores.length === 0

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Liberar para contagem"
      descricao="Escolha quem vai contar esta mercadoria. Sem pessoa a nota permanece em Aguardando chegada."
      largura="md"
      rodape={
        <>
          <Button type="button" variant="outline" onClick={aoFechar} disabled={ocupado}>
            Cancelar
          </Button>
          <BotaoPrimario
            type="button"
            disabled={ocupado || semOperadores || !responsavelId}
            onClick={() => aoConfirmar(responsavelId)}
          >
            {ocupado ? 'Liberando…' : 'Liberar para contagem'}
          </BotaoPrimario>
        </>
      }
    >
      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando operadores…</p>
      ) : semOperadores ? (
        <p className="text-sm text-destructive" role="alert">
          {erro || 'Cadastre um usuário ativo nesta empresa para designar quem vai contar.'}
        </p>
      ) : (
        <SelectPadrao
          rotulo="Quem vai contar"
          obrigatorio
          valor={responsavelId}
          aoMudar={setResponsavelId}
          opcoes={operadores.map((o) => ({ value: o.id, label: o.name }))}
          placeholder="Selecione"
        />
      )}
    </Modal>
  )
}
