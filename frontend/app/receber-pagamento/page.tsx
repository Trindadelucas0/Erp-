'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { BadgeStatus } from '@/components/ui/badge-status'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { usePermissao } from '@/hooks/use-permissao'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  CHAVE_AVISO,
  RECEBER_PAGAMENTO_EM_DESENVOLVIMENTO,
  TEXTO_CARD_DESENVOLVIMENTO,
  TITULO_CARD_DESENVOLVIMENTO,
} from '@/lib/receber-pagamento-desenvolvimento'
import { clienteHttp } from '@/services/api'

type VendaPaga = {
  id: string
  numero: number
  clienteNome: string
  status: string
  separacoes: number[]
}

function rotuloStatus(status: string) {
  if (status === 'paga') return 'Paga'
  return status
}

function ConteudoDaPagina() {
  const roteador = useRouter()
  const podeCriar = usePermissao('vendas:create')
  const [vendas, setVendas] = useState<VendaPaga[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState('')

  const carregar = useCallback(() => {
    setCarregando(true)
    setErro('')
    clienteHttp
      .get<{ vendas: VendaPaga[] }>('/receber-pagamento')
      .then(({ data }) => setVendas(data.vendas ?? []))
      .catch((falha: unknown) => {
        setErro(extrairMensagemApi(falha, 'Não foi possível carregar as vendas.'))
      })
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    const texto = sessionStorage.getItem(CHAVE_AVISO)
    if (texto) {
      sessionStorage.removeItem(CHAVE_AVISO)
      setAviso(texto)
    }
    carregar()
  }, [carregar])

  return (
    <div className="min-w-0 space-y-6">
      <TituloPagina
        caminho="Vendas > Receber pagamento"
        subtitulo="Venda paga. Ao confirmar, nasce uma Separação por produto."
      >
        Receber pagamento
      </TituloPagina>

      {RECEBER_PAGAMENTO_EM_DESENVOLVIMENTO ? (
        <CardPadrao titulo={TITULO_CARD_DESENVOLVIMENTO}>
          {TEXTO_CARD_DESENVOLVIMENTO.map((linha) => (
            <p key={linha} className="text-sm text-foreground">
              {linha}
            </p>
          ))}
        </CardPadrao>
      ) : null}

      <CardPadrao
        titulo="Vendas pagas"
        acoes={
          podeCriar ? (
            <BotaoPrimario type="button" onClick={() => roteador.push('/receber-pagamento/novo')}>
              <Plus className="mr-1 size-4 inline" />
              Nova venda
            </BotaoPrimario>
          ) : null
        }
      >
        {aviso ? (
          <p className="mb-3 text-sm text-foreground" role="status">
            {aviso}
          </p>
        ) : null}
        {erro ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive" role="alert">
              {erro}
            </p>
            <Button type="button" variant="outline" onClick={carregar}>
              Tentar de novo
            </Button>
          </div>
        ) : carregando ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : vendas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma venda paga.</p>
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Vendas pagas</caption>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Nº</th>
                  <th className="px-2 py-2 font-medium">Cliente</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Separações</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((venda) => (
                  <tr key={venda.id} className="border-b border-border/70">
                    <td className="px-2 py-3 font-medium">{venda.numero}</td>
                    <td className="px-2 py-3">{venda.clienteNome}</td>
                    <td className="px-2 py-3">
                      <BadgeStatus variante="info">{rotuloStatus(venda.status)}</BadgeStatus>
                    </td>
                    <td className="px-2 py-3">{venda.separacoes.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardPadrao>
    </div>
  )
}

export default function PaginaReceberPagamento() {
  return (
    <ProtegerRota chaveDaPagina="receber-pagamento">
      <ConteudoDaPagina />
    </ProtegerRota>
  )
}
