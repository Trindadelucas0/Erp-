'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

type EntradaSessao = {
  id: string
  chaveNfe: string
  nomeEmitente: string | null
  documentoEmitente: string | null
  dataEmissao: string | null
  serie: string | null
  numero: string | null
}

type ItemSessao = {
  id: string
  produtoId: string
  sku: string | null
  nomeExibicao: string
  codigoBarras: string | null
  codigoOriginal: string | null
  marca: string | null
  unidade: string | null
  qtdEmbalagemPadrao: number | null
  qtdContada: number
  statusItem: string
}

type SessaoContagem = {
  id: string
  status: string
  iniciadoEm: string | null
  finalizadoEm: string | null
  observacao: string | null
  entradas: EntradaSessao[]
  itens: ItemSessao[]
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

function ConteudoSessaoContagem() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''
  const bipRef = useRef<HTMLInputElement>(null)

  const [sessao, setSessao] = useState<SessaoContagem | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [acao, setAcao] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [divergentes, setDivergentes] = useState<string[]>([])
  const [codigoBip, setCodigoBip] = useState('')
  const [observacao, setObservacao] = useState('')

  const editavel =
    sessao?.status === 'aberta' || sessao?.status === 'em_andamento'

  const carregar = useCallback(async () => {
    if (!id) return
    setCarregando(true)
    setErro(null)
    try {
      const { data } = await clienteHttp.get<SessaoContagem>(`/contagens/${id}`)
      setSessao(data)
      setObservacao(data.observacao ?? '')
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Falha ao carregar contagem.'))
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    if (editavel) bipRef.current?.focus()
  }, [editavel, sessao?.id])

  function atualizarItemLocal(item: ItemSessao) {
    setSessao((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        itens: prev.itens.map((i) => (i.id === item.id ? item : i)),
      }
    })
  }

  async function enviarBip(codigo: string) {
    const limpo = codigo.trim()
    if (!limpo || !id || !editavel) return
    setAcao(true)
    setErro(null)
    setMensagem(null)
    try {
      const { data } = await clienteHttp.post<{
        item: ItemSessao
        incremento: number
        tipoBip: string
      }>(`/contagens/${id}/bip`, { codigoBarras: limpo })
      atualizarItemLocal(data.item)
      setMensagem(
        data.tipoBip === 'master'
          ? `Caixa master: +${data.incremento} em ${data.item.nomeExibicao}`
          : `+${data.incremento} em ${data.item.nomeExibicao}`
      )
      setCodigoBip('')
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Bip não reconhecido.'))
      setCodigoBip('')
    } finally {
      setAcao(false)
      bipRef.current?.focus()
    }
  }

  async function salvarQtdManual(itemId: string, valor: number) {
    if (!id || !editavel) return
    setAcao(true)
    setErro(null)
    try {
      const { data } = await clienteHttp.patch<{ item: ItemSessao }>(
        `/contagens/${id}/itens/${itemId}`,
        { qtdContada: valor }
      )
      atualizarItemLocal(data.item)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Falha ao gravar quantidade.'))
      await carregar()
    } finally {
      setAcao(false)
      bipRef.current?.focus()
    }
  }

  async function gravar(confirmarDivergencia: boolean) {
    if (!id || !editavel) return
    setAcao(true)
    setErro(null)
    setMensagem(null)
    try {
      const { data } = await clienteHttp.post<{
        ok: boolean
        divergentes: string[]
        mensagem: string
        sessao: SessaoContagem
      }>(`/contagens/${id}/gravar`, {
        confirmarDivergencia,
        observacao: observacao || null,
      })
      setSessao(data.sessao)
      setDivergentes(data.divergentes ?? [])
      setMensagem(data.mensagem)
      if (data.ok) {
        setTimeout(() => router.push('/contagens'), 1200)
      }
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Falha ao gravar contagem.'))
    } finally {
      setAcao(false)
    }
  }

  async function cancelar() {
    if (!id || !editavel) return
    if (!window.confirm('Cancelar esta contagem? As entradas voltam para liberadas.')) return
    setAcao(true)
    try {
      await clienteHttp.post(`/contagens/${id}/cancelar`)
      router.push('/contagens')
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Falha ao cancelar.'))
      setAcao(false)
    }
  }

  if (carregando && !sessao) {
    return <p className="text-sm text-muted-foreground">Carregando contagem…</p>
  }

  if (!sessao) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{erro || 'Contagem não encontrada.'}</p>
        <Button asChild variant="outline">
          <Link href="/contagens">Voltar</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-2 lg:w-40">
        <Button
          type="button"
          disabled={acao || !editavel}
          onClick={() => void gravar(false)}
        >
          Gravar
        </Button>
        {divergentes.length > 0 && editavel && (
          <Button
            type="button"
            variant="secondary"
            disabled={acao}
            onClick={() => void gravar(true)}
          >
            Gravar com divergência
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="border-orange-500/50 text-orange-700 dark:text-orange-400"
          disabled={acao || !editavel}
          onClick={() => void cancelar()}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={acao}
          onClick={() => {
            if (
              !window.confirm(
                'A contagem continuará em andamento. Você pode retomá-la em Contagens de entrada. Sair mesmo assim?'
              )
            ) {
              return
            }
            router.push('/contagens')
          }}
        >
          Sair
        </Button>
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">Contagem de entrada</h1>
          <span className="text-sm text-muted-foreground">
            Status: <strong>{sessao.status}</strong>
          </span>
        </div>

        {mensagem && (
          <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm" role="status">
            {mensagem}
          </p>
        )}
        {erro && (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
            {erro}
          </p>
        )}
        {divergentes.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            <p className="font-medium">Itens divergentes da nota (sem revelar quantidade):</p>
            <ul className="mt-1 list-inside list-disc">
              {divergentes.map((nome) => (
                <li key={nome}>{nome}</li>
              ))}
            </ul>
            <p className="mt-2 text-muted-foreground">
              Reconte e use Gravar de novo. Se persistir, use &quot;Gravar com divergência&quot;.
            </p>
          </div>
        )}

        <section className="rounded-md border">
          <h2 className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">Entradas</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Fornecedor</th>
                  <th className="px-3 py-2 font-medium">Nº nota</th>
                  <th className="px-3 py-2 font-medium">Série</th>
                  <th className="px-3 py-2 font-medium">Emissão</th>
                </tr>
              </thead>
              <tbody>
                {sessao.entradas.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{e.nomeEmitente || '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{e.numero ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{e.serie ?? '—'}</td>
                    <td className="px-3 py-2">{formatarData(e.dataEmissao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {editavel && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <Label htmlFor="campo-bip">Bipar código de barras</Label>
              <Input
                id="campo-bip"
                ref={bipRef}
                value={codigoBip}
                disabled={acao}
                autoComplete="off"
                placeholder="Foque aqui e bipar / Enter"
                className="mt-1"
                onChange={(e) => setCodigoBip(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void enviarBip(codigoBip)
                  }
                }}
              />
            </div>
          </div>
        )}

        <section className="rounded-md border">
          <h2 className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">
            Produtos das entradas (contagem cega)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Código</th>
                  <th className="px-3 py-2 font-medium">Nome</th>
                  <th className="px-3 py-2 font-medium">Cód. original / Barras</th>
                  <th className="px-3 py-2 font-medium">Marca</th>
                  <th className="px-3 py-2 font-medium">Qtd. emb.</th>
                  <th className="px-3 py-2 font-medium">Und.</th>
                  <th className="px-3 py-2 font-medium">Qtd. Entrada</th>
                </tr>
              </thead>
              <tbody>
                {sessao.itens.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-b last:border-0 ${
                      item.statusItem === 'divergente' ? 'bg-amber-500/10' : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-mono tabular-nums">{item.sku || '—'}</td>
                    <td className="px-3 py-2 font-medium">{item.nomeExibicao}</td>
                    <td className="px-3 py-2 text-xs">
                      <div>{item.codigoOriginal || '—'}</div>
                      <div className="text-muted-foreground">{item.codigoBarras || '—'}</div>
                    </td>
                    <td className="px-3 py-2">{item.marca || '—'}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {item.qtdEmbalagemPadrao ?? '—'}
                    </td>
                    <td className="px-3 py-2">{item.unidade || 'UN'}</td>
                    <td className="px-3 py-2">
                      {editavel ? (
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          className="h-8 w-24"
                          value={Number.isFinite(item.qtdContada) ? item.qtdContada : 0}
                          disabled={acao}
                          onChange={(e) => {
                            const v = Number(e.target.value)
                            atualizarItemLocal({
                              ...item,
                              qtdContada: Number.isFinite(v) ? v : 0,
                            })
                          }}
                          onBlur={(e) => {
                            const v = Number(e.target.value)
                            void salvarQtdManual(item.id, Number.isFinite(v) && v >= 0 ? v : 0)
                          }}
                          aria-label={`Quantidade contada de ${item.nomeExibicao}`}
                        />
                      ) : (
                        <span className="tabular-nums">{item.qtdContada}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div>
          <Label htmlFor="obs-contagem">Observação</Label>
          <Input
            id="obs-contagem"
            className="mt-1"
            value={observacao}
            disabled={!editavel || acao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>
    </div>
  )
}

export default function PaginaSessaoContagem() {
  return (
    <ProtegerRota chaveDaPagina="contagens">
      <ConteudoSessaoContagem />
    </ProtegerRota>
  )
}
