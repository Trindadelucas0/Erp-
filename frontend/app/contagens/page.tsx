'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Button } from '@/components/ui/button'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'

type NotaDisponivel = {
  id: string
  chaveNfe: string
  nomeEmitente: string | null
  documentoEmitente: string | null
  dataEmissao: string | null
  serie: string | null
  numero: string | null
}

type NotaIgnorada = NotaDisponivel & { motivo: string }

type SessaoAtiva = {
  id: string
  status: string
  iniciadoEm: string | null
  operadorNome: string
  entradas: NotaDisponivel[]
}

type SessaoHistorico = SessaoAtiva & {
  finalizadoEm: string | null
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

function formatarDataHora(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function rotuloStatusSessao(status: string): string {
  if (status === 'ok') return 'OK'
  if (status === 'divergente') return 'Divergente'
  if (status === 'cancelada') return 'Cancelada'
  if (status === 'em_andamento') return 'Em andamento'
  if (status === 'aberta') return 'Aberta'
  return status
}

function resumoEntradas(entradas: NotaDisponivel[]): string {
  if (entradas.length === 0) return '—'
  return entradas
    .map((e) => {
      const nf = e.numero ?? '—'
      const serie = e.serie ? ` · Série ${e.serie}` : ''
      return `${e.nomeEmitente || '—'} · NF ${nf}${serie}`
    })
    .join('; ')
}

function ConteudoListaContagens() {
  const router = useRouter()
  const [notas, setNotas] = useState<NotaDisponivel[]>([])
  const [ignoradas, setIgnoradas] = useState<NotaIgnorada[]>([])
  const [sessoesAtivas, setSessoesAtivas] = useState<SessaoAtiva[]>([])
  const [historicoRecente, setHistoricoRecente] = useState<SessaoHistorico[]>([])
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)
  const [iniciando, setIniciando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const { data } = await clienteHttp.get<{
        notas: NotaDisponivel[]
        ignoradas?: NotaIgnorada[]
        sessoesAtivas?: SessaoAtiva[]
        historicoRecente?: SessaoHistorico[]
      }>('/contagens/disponiveis')
      setNotas(data.notas ?? [])
      setIgnoradas(data.ignoradas ?? [])
      setSessoesAtivas(data.sessoesAtivas ?? [])
      setHistoricoRecente(data.historicoRecente ?? [])
      setSelecionadas(new Set())
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Falha ao listar entradas liberadas.'))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  function alternar(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function iniciar() {
    if (selecionadas.size === 0) {
      setErro('Selecione ao menos uma entrada.')
      return
    }
    setIniciando(true)
    setErro(null)
    try {
      const { data } = await clienteHttp.post<{ id: string }>('/contagens', {
        nfeRecebidaIds: [...selecionadas],
      })
      router.push(`/contagens/${data.id}`)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível iniciar a contagem.'))
      setIniciando(false)
    }
  }

  const nfeSemVinculo = ignoradas.filter((n) =>
    /vinculado a produto/i.test(n.motivo)
  )

  return (
    <div className="space-y-4">
      {!carregando && sessoesAtivas.length > 0 && (
        <CardPadrao titulo="Contagens em andamento">
          <p className="mb-3 text-sm text-muted-foreground">
            Estas entradas saem da lista de novas contagens enquanto a sessão estiver aberta. Use{' '}
            <strong>Continuar contagem</strong> para retomar ou <strong>Cancelar</strong> dentro da
            sessão para liberar a nota de novo.
          </p>
          <ul className="space-y-3 text-sm">
            {sessoesAtivas.map((sessao) => (
              <li
                key={sessao.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">
                    Iniciada em {formatarDataHora(sessao.iniciadoEm)} ·{' '}
                    {rotuloStatusSessao(sessao.status)} · Operador {sessao.operadorNome}
                  </p>
                  <ul className="text-muted-foreground">
                    {sessao.entradas.map((e) => (
                      <li key={e.id}>
                        {e.nomeEmitente || '—'} · NF {e.numero ?? '—'}
                        {e.serie ? ` · Série ${e.serie}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button type="button" asChild>
                  <Link href={`/contagens/${sessao.id}`}>Continuar contagem</Link>
                </Button>
              </li>
            ))}
          </ul>
        </CardPadrao>
      )}

      <CardPadrao
        titulo="Entradas liberadas para contagem"
        acoes={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void carregar()} disabled={carregando}>
              Atualizar
            </Button>
            <Button
              type="button"
              disabled={iniciando || selecionadas.size === 0}
              onClick={() => void iniciar()}
            >
              {iniciando ? 'Iniciando…' : `Iniciar contagem (${selecionadas.size})`}
            </Button>
          </div>
        }
      >
        <p className="mb-3 text-sm text-muted-foreground">
          Só entram NFe 55 com pelo menos um item <strong>vinculado a produto</strong>. Contagem
          cega: sem quantidade da nota, sem valor e sem DANFE. NFS-e/CT-e não aparecem aqui.
        </p>
        {erro && (
          <p className="mb-3 text-sm text-destructive" role="alert">
            {erro}
          </p>
        )}
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="w-10 px-3 py-2" scope="col">
                  <span className="sr-only">Selecionar</span>
                </th>
                <th className="px-3 py-2 font-medium" scope="col">
                  Fornecedor
                </th>
                <th className="px-3 py-2 font-medium" scope="col">
                  Nº nota
                </th>
                <th className="px-3 py-2 font-medium" scope="col">
                  Série
                </th>
                <th className="px-3 py-2 font-medium" scope="col">
                  Emissão
                </th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <LinhasSkeletonTabela colunas={5} linhas={5} />
              ) : notas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhuma NFe pronta para contagem física.
                    {sessoesAtivas.length > 0
                      ? ' Há contagens em andamento acima — use Continuar contagem.'
                      : nfeSemVinculo.length > 0
                        ? ` Há ${nfeSemVinculo.length} liberada(s) sem produto vinculado — veja abaixo.`
                        : ' Liberadas documentais (NFS-e/CT-e) não entram nesta tela.'}
                  </td>
                </tr>
              ) : (
                notas.map((n) => {
                  const marcada = selecionadas.has(n.id)
                  return (
                    <tr
                      key={n.id}
                      className={`border-b last:border-0 ${marcada ? 'bg-primary/5' : ''}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={() => alternar(n.id)}
                          aria-label={`Selecionar nota ${n.numero ?? n.id}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{n.nomeEmitente || '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {n.documentoEmitente || ''}
                        </div>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{n.numero ?? '—'}</td>
                      <td className="px-3 py-2 tabular-nums">{n.serie ?? '—'}</td>
                      <td className="px-3 py-2">{formatarData(n.dataEmissao)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </CardPadrao>

      {!carregando && nfeSemVinculo.length > 0 && (
        <CardPadrao titulo="Liberadas, mas ainda não contáveis">
          <p className="mb-3 text-sm text-muted-foreground">
            Estas NFes estão em Liberadas p/ contagem, porém falta vincular o produto na Entrada
            de Notas (aba Cadastro → Conciliar produto). Depois disso, volte aqui e atualize.
          </p>
          <ul className="space-y-2 text-sm">
            {nfeSemVinculo.map((n) => (
              <li
                key={n.id}
                className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {n.nomeEmitente || '—'} · NF {n.numero ?? '—'}
                  </span>
                  <Link
                    href={`/entrada-notas/${n.id}?aba=cadastro`}
                    className="text-primary underline"
                  >
                    Abrir na Entrada
                  </Link>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{n.motivo}</p>
              </li>
            ))}
          </ul>
        </CardPadrao>
      )}

      {!carregando && historicoRecente.length > 0 && (
        <CardPadrao titulo="Histórico recente">
          <p className="mb-3 text-sm text-muted-foreground">
            Últimas contagens finalizadas (OK, divergente ou cancelada). A quantidade esperada da
            nota continua oculta.
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Finalizado
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Status
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Operador
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Início
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Entradas
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {historicoRecente.map((sessao) => (
                  <tr key={sessao.id} className="border-b last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {formatarDataHora(sessao.finalizadoEm)}
                    </td>
                    <td className="px-3 py-2">{rotuloStatusSessao(sessao.status)}</td>
                    <td className="px-3 py-2">{sessao.operadorNome}</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {formatarDataHora(sessao.iniciadoEm)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {resumoEntradas(sessao.entradas)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link href={`/contagens/${sessao.id}`}>Ver</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardPadrao>
      )}
    </div>
  )
}

export default function PaginaContagens() {
  return (
    <ProtegerRota chaveDaPagina="contagens">
      <ConteudoListaContagens />
    </ProtegerRota>
  )
}
