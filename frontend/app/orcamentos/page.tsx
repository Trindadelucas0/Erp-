'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { CampoBuscaLista } from '@/components/compartilhado/campo-busca-lista'
import { BadgeStatus } from '@/components/ui/badge-status'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { CardPadrao } from '@/components/ui/card-padrao'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { textosContemTodosTermos } from '@/lib/normalizar-busca'
import { type OrcamentoListaApi } from '@/lib/orcamento-api'
import { formatarDataCivil, rotuloStatusOrcamento } from '@/lib/orcamento-layout'
import { formatarMoeda } from '@/lib/pedido-compra-shared'
import { clienteHttp } from '@/services/api'

function ConteudoDaPagina() {
  const roteador = useRouter()
  const [busca, setBusca] = useState('')
  const [orcamentos, setOrcamentos] = useState<OrcamentoListaApi[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    clienteHttp
      .get<{ orcamentos: OrcamentoListaApi[] }>('/orcamentos')
      .then(({ data }) => {
        if (ativo) setOrcamentos(data.orcamentos)
      })
      .catch((falha: unknown) => {
        if (ativo) setErro(extrairMensagemApi(falha, 'Não foi possível carregar os orçamentos.'))
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [])

  const lista = useMemo(
    () =>
      orcamentos.filter((orcamento) =>
        textosContemTodosTermos([orcamento.numero, orcamento.clienteNome], busca)
      ),
    [busca, orcamentos]
  )

  return (
    <div className="min-w-0 space-y-6">
      <TituloPagina caminho="Vendas > Orçamentos">Orçamentos</TituloPagina>

      <CardPadrao
        titulo="Orçamentos"
        acoes={
          <BotaoPrimario type="button" onClick={() => roteador.push('/orcamentos/novo')}>
            <Plus className="mr-1 size-4 inline" />
            Novo orçamento
          </BotaoPrimario>
        }
      >
        <div className="mb-3 print:hidden">
          <CampoBuscaLista
            nomeCampo="busca-lista-orcamentos"
            rotulo="Busca"
            className="sm:max-w-xs"
            placeholder="Nº ou cliente"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </div>

        {erro ? (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        ) : carregando ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum orçamento</p>
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Lista de orçamentos</caption>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Nº</th>
                  <th className="px-2 py-2 font-medium">Cliente</th>
                  <th className="px-2 py-2 font-medium">Data</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((orcamento) => (
                  <tr
                    key={orcamento.id}
                    className="cursor-pointer border-b border-border/70 hover:bg-muted/40"
                    onClick={() => roteador.push(`/orcamentos/${orcamento.id}`)}
                    onKeyDown={(evento) => {
                      if (evento.key === 'Enter' || evento.key === ' ') {
                        evento.preventDefault()
                        roteador.push(`/orcamentos/${orcamento.id}`)
                      }
                    }}
                    tabIndex={0}
                  >
                    <td className="px-2 py-3 font-medium">{orcamento.numero}</td>
                    <td className="px-2 py-3">{orcamento.clienteNome}</td>
                    <td className="px-2 py-3">{formatarDataCivil(orcamento.data)}</td>
                    <td className="px-2 py-3">
                      <BadgeStatus variante="info">{rotuloStatusOrcamento(orcamento.status)}</BadgeStatus>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">{formatarMoeda(orcamento.total)}</td>
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

export default function PaginaOrcamentos() {
  return (
    <ProtegerRota chaveDaPagina="orcamentos">
      <ConteudoDaPagina />
    </ProtegerRota>
  )
}
