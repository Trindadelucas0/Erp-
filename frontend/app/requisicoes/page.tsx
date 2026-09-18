'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { usePermissao } from '@/hooks/use-permissao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { CampoBuscaLista } from '@/components/compartilhado/campo-busca-lista'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'
import {
  BadgePrioridadeRequisicao,
  BadgeStatusRequisicao,
} from '@/components/requisicoes-wms/badges-requisicao'
import {
  formatarNumeroRequisicao,
  origemDestino,
  OPCOES_PRIORIDADE,
  OPCOES_STATUS,
  OPCOES_TIPO_OPERACAO,
  ROTULO_TIPO_OPERACAO,
  rotuloNfDaRequisicao,
  type ListaRequisicoes,
  type RequisicaoWms,
} from '@/lib/requisicoes-wms'
import { cn } from '@/lib/utils'

function ConteudoLista() {
  const { perfil } = useSessaoDoUsuario()
  const podeCriar = usePermissao('estoque:create')
  const padraoFila = perfil?.ehAdmin ? 'todas' : 'minha'
  const [fila, setFila] = useState<'minha' | 'todas'>(padraoFila)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [tipo, setTipo] = useState('')
  const [prioridade, setPrioridade] = useState('')
  const [itens, setItens] = useState<RequisicaoWms[]>([])
  const [total, setTotal] = useState(0)
  const [resumo, setResumo] = useState<Record<string, number>>({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (perfil && !perfil.ehAdmin) setFila('minha')
  }, [perfil])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.get<ListaRequisicoes>('/requisicoes', {
        params: {
          fila,
          ...(q.trim() ? { q: q.trim() } : {}),
          ...(status ? { status } : {}),
          ...(tipo ? { tipo } : {}),
          ...(prioridade ? { prioridade } : {}),
          pagina: 1,
          limite: 50,
        },
      })
      setItens(data.itens)
      setTotal(data.total)
      setResumo(data.resumoPorStatus ?? {})
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível carregar as requisições.'))
      setItens([])
      setTotal(0)
    } finally {
      setCarregando(false)
    }
  }, [fila, q, status, tipo, prioridade])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const cards = [
    { chave: '_total', rotulo: 'Total', valor: resumo._total ?? total },
    { chave: 'pendente', rotulo: 'Pendente', valor: resumo.pendente ?? 0 },
    { chave: 'disponivel', rotulo: 'Disponível', valor: resumo.disponivel ?? 0 },
    { chave: 'em_execucao', rotulo: 'Em execução', valor: resumo.em_execucao ?? 0 },
    { chave: 'pausada', rotulo: 'Pausadas', valor: resumo.pausada ?? 0 },
    { chave: 'concluida', rotulo: 'Concluídas', valor: resumo.concluida ?? 0 },
  ]

  return (
    <div className="space-y-4">
      <TituloPagina
        subtitulo="Ordens do armazém — Separação reserva e baixa o kardex; reposição não muda o total da empresa."
        aoLadoDoTitulo={
          podeCriar ? (
            <BotaoPrimario asChild>
              <Link href="/requisicoes/nova">
                <Plus className="mr-1 size-4" />
                Nova requisição
              </Link>
            </BotaoPrimario>
          ) : null
        }
      >
        Requisições
      </TituloPagina>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.chave} className="rounded-lg border-2 border-border bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">{c.rotulo}</p>
            <p className="text-lg font-semibold">{c.valor}</p>
          </div>
        ))}
      </div>

      <CardPadrao titulo="Fila" descricao="Prioridade crítica primeiro. Minha fila = atribuídas a você ou disponíveis sem dono.">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <CampoBuscaLista
              nomeCampo="busca-lista-requisicoes"
              rotulo="Busca"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Número, produto, endereço…"
            />
          </div>
          <SelectPadrao
            rotulo="Tipo"
            valor={tipo}
            aoMudar={setTipo}
            opcoes={[
              { value: '', label: 'Todos' },
              ...OPCOES_TIPO_OPERACAO,
              { value: 'contagem_entrada', label: ROTULO_TIPO_OPERACAO.contagem_entrada },
            ]}
          />
          <SelectPadrao
            rotulo="Status"
            valor={status}
            aoMudar={setStatus}
            opcoes={[{ value: '', label: 'Todos' }, ...OPCOES_STATUS]}
          />
          <SelectPadrao
            rotulo="Prioridade"
            valor={prioridade}
            aoMudar={setPrioridade}
            opcoes={[{ value: '', label: 'Todas' }, ...OPCOES_PRIORIDADE]}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={fila === 'minha' ? 'default' : 'outline'}
              onClick={() => setFila('minha')}
            >
              Minha fila
            </Button>
            <Button
              type="button"
              size="sm"
              variant={fila === 'todas' ? 'default' : 'outline'}
              onClick={() => setFila('todas')}
            >
              Todas da empresa
            </Button>
          </div>
        </div>

        {erro ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{erro}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void carregar()}>
              Tentar de novo
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-2">Nº</th>
                  <th className="px-2 py-2">Prioridade</th>
                  <th className="px-2 py-2">Tipo</th>
                  <th className="px-2 py-2">NF</th>
                  <th className="px-2 py-2">Origem → Destino</th>
                  <th className="px-2 py-2">Qtd</th>
                  <th className="px-2 py-2">Responsável</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <LinhasSkeletonTabela linhas={5} colunas={8} />
                ) : itens.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-2 py-8 text-center text-muted-foreground">
                      Nenhuma requisição nesta fila.
                    </td>
                  </tr>
                ) : (
                  itens.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-2 py-2">
                        <Link
                          href={`/requisicoes/${item.id}`}
                          className={cn('font-medium text-primary underline-offset-2 hover:underline')}
                        >
                          {formatarNumeroRequisicao(item.numero)}
                        </Link>
                      </td>
                      <td className="px-2 py-2">
                        <BadgePrioridadeRequisicao prioridade={item.prioridade} />
                      </td>
                      <td className="px-2 py-2">{ROTULO_TIPO_OPERACAO[item.tipoOperacao]}</td>
                      <td className="px-2 py-2">{rotuloNfDaRequisicao(item.nfeRecebidaChave) ?? '—'}</td>
                      <td className="px-2 py-2">{origemDestino(item)}</td>
                      <td className="px-2 py-2">{item.quantidade ?? '—'}</td>
                      <td className="px-2 py-2">{item.responsavelNome ?? '—'}</td>
                      <td className="px-2 py-2">
                        <BadgeStatusRequisicao status={item.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardPadrao>
    </div>
  )
}

export default function PaginaRequisicoes() {
  return (
    <ProtegerRota chaveDaPagina="requisicoes">
      <ConteudoLista />
    </ProtegerRota>
  )
}
