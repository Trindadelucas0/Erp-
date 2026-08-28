'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { dispararDownloadArquivo } from '@/lib/disparar-download-arquivo'
import { CardPadrao } from '@/components/ui/card-padrao'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { Button } from '@/components/ui/button'
import { BadgeStatus } from '@/components/ui/badge-status'
import {
  ConteudoVisualizacaoNota,
  type VisualizacaoNota,
} from '@/components/entrada-notas/conteudo-visualizacao-nota'

type ItemNota = {
  nItem: number
  descricao: string | null
  quantidade: number | null
  valorUnitario: number | null
  produto: { nomeVenda: string; sku?: string | null } | null
}

type AchadoChegada = {
  tipo: string
  mensagem: string
  itemId: string
  nItem?: number
  produto?: string
  nomeNf?: string
  nomeSistema?: string
  similaridade?: number
  precoAtual?: number
  precoUltima?: number
  variacaoPercentual?: number
}

type ItemContagemAuditoria = {
  id: string
  produtoId: string
  sku: string | null
  nomeExibicao: string
  unidade: string | null
  unidadeNome?: string | null
  qtdEsperada: number
  qtdContada: number
  diferenca: number
  statusItem: string
}

type ResultadoContagem = {
  sessaoId: string
  status: string
  iniciadoEm: string | null
  finalizadoEm: string | null
  baixadaEm: string | null
  observacao: string | null
  multiNota: boolean
  qtdNotasSessao: number
  totais: { itens: number; ok: number; divergente: number }
  itens: ItemContagemAuditoria[]
}

type ItemBloqueadoAuditoria = {
  produtoId: string
  sku: string | null
  nomeVenda: string
  unidade: string | null
  quantidadeBloqueada: number
  status: 'bloqueado' | 'desbloqueado'
  bloqueadoEm: string | null
  desbloqueadoEm: string | null
}

type ItensBloqueadosResumo = {
  itens: ItemBloqueadoAuditoria[]
  totais: { itens: number; aindaBloqueados: number; desbloqueados: number }
}

type DetalheAuditoria = {
  id: string
  chaveNfe: string
  nomeEmitente: string | null
  documentoEmitente: string | null
  valorTotal: number | null
  dataEmissao: string | null
  statusEntrada: string
  divergenciaDesfecho?: string | null
  divergenciaResolvidaEm?: string | null
  anexoDivergencia?: { id: string; nomeArquivo: string } | null
  anexos?: Array<{ id: string; tipoAnexo: string; nomeArquivo: string; createdAt?: string }>
  divergenciaGestao?: {
    bloqueioExplicacao?: string
    bloqueioEm?: string
    desbloqueioExplicacao?: string
    desbloqueioEm?: string
  } | null
  auditoriaChegada?: {
    achados: AchadoChegada[]
    aceitoEm?: string | null
  } | null
  resultadoContagem?: ResultadoContagem | null
  itensBloqueados?: ItensBloqueadosResumo | null
  contagemBaixada?: boolean
  itens: ItemNota[]
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR')
}

function formatarMoeda(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarQtd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
}

function extrairSerieNumero(chave: string): { serie: string | null; numero: string | null } {
  const digitos = chave.replace(/\D/g, '')
  if (digitos.length !== 44) return { serie: null, numero: null }
  return {
    serie: String(Number(digitos.slice(22, 25))),
    numero: String(Number(digitos.slice(25, 34))),
  }
}

function rotuloStatusEntrada(status: string): string {
  const mapa: Record<string, string> = {
    entrada_consolidada: 'Entrada consolidada',
    entrada_contagem_ok: 'Contagem OK',
    entrada_contagem_divergente: 'Contagem divergente',
  }
  return mapa[status] ?? status
}

function rotuloTipoAnexo(tipo: string): string {
  const mapa: Record<string, string> = {
    negociacao_bloqueio: 'Negociação de bloqueio',
    negociacao_desbloqueio: 'Negociação de desbloqueio',
    ressalva_divergencia: 'Ressalva de divergência',
  }
  return mapa[tipo] ?? tipo
}

function textoDiferenca(diferenca: number): string {
  if (Math.abs(diferenca) < 1e-9) return 'Bateu'
  if (diferenca < 0) return `Faltou ${formatarQtd(Math.abs(diferenca))}`
  return `Sobrou ${formatarQtd(diferenca)}`
}

function ConteudoDetalheAuditoria() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : ''
  const [nota, setNota] = useState<DetalheAuditoria | null>(null)
  const [xml, setXml] = useState<VisualizacaoNota | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [nfAberta, setNfAberta] = useState(true)

  const carregar = useCallback(async () => {
    if (!id) return
    setCarregando(true)
    setErro('')
    try {
      const [{ data: detalhe }, xmlResp] = await Promise.all([
        clienteHttp.get<{ nota: DetalheAuditoria }>(`/entrada-notas/${id}`),
        clienteHttp
          .get<{ visualizacao: VisualizacaoNota }>(`/focus-nfe/nfe-recebidas/${id}/xml`, {
            params: { modo: 'visualizar' },
          })
          .catch(() => null),
      ])
      setNota(detalhe.nota)
      setXml(xmlResp?.data.visualizacao ?? null)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível abrir a auditoria desta nota.'))
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function baixarAnexo(anexoId: string, nomeArquivo: string) {
    const resp = await clienteHttp.get(
      `/entrada-notas/${id}/anexo-divergencia/${anexoId}/download`,
      { responseType: 'blob' }
    )
    const blob = resp.data instanceof Blob ? resp.data : new Blob([resp.data])
    dispararDownloadArquivo(blob, nomeArquivo)
  }

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Carregando auditoria…</p>
  }

  if (!nota) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{erro || 'Nota não encontrada.'}</p>
        <Button asChild variant="outline">
          <Link href="/auditoria-entradas">Voltar</Link>
        </Button>
      </div>
    )
  }

  const { serie, numero } = extrairSerieNumero(nota.chaveNfe)
  const contagem = nota.resultadoContagem ?? null
  const bloqueados = nota.itensBloqueados ?? null
  const achados = nota.auditoriaChegada?.achados ?? []
  const achadosPreco = achados.filter((a) => a.tipo === 'preco')
  const achadosNome = achados.filter((a) => a.tipo === 'nome')
  const teveBloqueio =
    nota.divergenciaDesfecho === 'bloqueio' ||
    Boolean(nota.divergenciaGestao?.bloqueioExplicacao) ||
    (bloqueados?.itens.length ?? 0) > 0 ||
    (nota.anexos?.length ?? 0) > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TituloPagina>Auditoria de entradas</TituloPagina>
        <Button asChild variant="outline" size="sm">
          <Link href="/auditoria-entradas">Voltar à lista</Link>
        </Button>
      </div>
      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <CardPadrao titulo="Veredito da entrada">
        <div className="flex flex-wrap gap-2">
          <BadgeStatus variante="sucesso">{rotuloStatusEntrada(nota.statusEntrada)}</BadgeStatus>
          {contagem?.status === 'ok' && (
            <BadgeStatus variante="sucesso">Contagem OK</BadgeStatus>
          )}
          {contagem?.status === 'divergente' && (
            <BadgeStatus variante="pendente">Contagem divergente</BadgeStatus>
          )}
          {achados.length > 0 && (
            <BadgeStatus variante="info">
              Conferência preço/nome ({achados.length})
            </BadgeStatus>
          )}
          {bloqueados && bloqueados.totais.aindaBloqueados > 0 && (
            <BadgeStatus variante="reprovado">
              {bloqueados.totais.aindaBloqueados} item(ns) bloqueado(s)
            </BadgeStatus>
          )}
          {bloqueados &&
            bloqueados.totais.aindaBloqueados === 0 &&
            bloqueados.totais.desbloqueados > 0 && (
              <BadgeStatus variante="info">
                {bloqueados.totais.desbloqueados} item(ns) desbloqueado(s)
              </BadgeStatus>
            )}
          {teveBloqueio && !bloqueados && (
            <BadgeStatus variante="reprovado">Bloqueio / anexos</BadgeStatus>
          )}
        </div>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Fornecedor</dt>
            <dd className="font-medium">{nota.nomeEmitente || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Documento</dt>
            <dd>{nota.documentoEmitente || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Nº / Série</dt>
            <dd className="tabular-nums">
              {numero ?? '—'} / {serie ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Emissão</dt>
            <dd>{formatarData(nota.dataEmissao)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Valor</dt>
            <dd className="tabular-nums">{formatarMoeda(nota.valorTotal)}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <dt className="text-muted-foreground">Chave</dt>
            <dd className="break-all font-mono text-xs">{nota.chaveNfe}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {contagem && (
            <>
              <span>
                Contagem: <strong className="tabular-nums">{contagem.totais.ok}</strong> ok
              </span>
              <span>
                Divergentes:{' '}
                <strong className="tabular-nums text-amber-700 dark:text-amber-400">
                  {contagem.totais.divergente}
                </strong>
              </span>
            </>
          )}
          <span>
            Achados chegada: <strong className="tabular-nums">{achados.length}</strong>
          </span>
          {bloqueados && (
            <span>
              Itens bloqueados:{' '}
              <strong className="tabular-nums text-destructive">
                {bloqueados.totais.aindaBloqueados}
              </strong>
              {bloqueados.totais.desbloqueados > 0 ? (
                <>
                  {' '}
                  · desbloqueados:{' '}
                  <strong className="tabular-nums">{bloqueados.totais.desbloqueados}</strong>
                </>
              ) : null}
            </span>
          )}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Operação:{' '}
          <Link href={`/entrada-notas/${nota.id}`} className="text-primary underline">
            abrir na Entrada de Notas
          </Link>
        </p>
      </CardPadrao>

      {contagem ? (
        <CardPadrao titulo="Resultado da contagem">
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>
              Status sessão:{' '}
              <strong className="text-foreground">
                {contagem.status === 'ok' ? 'OK' : 'Divergente'}
              </strong>
            </span>
            <span>Finalizada: {formatarData(contagem.finalizadoEm)}</span>
            <span>
              Baixada:{' '}
              {contagem.baixadaEm ? formatarData(contagem.baixadaEm) : '—'}
            </span>
          </div>
          {contagem.multiNota && (
            <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
              Esta sessão incluiu {contagem.qtdNotasSessao} notas — as quantidades abaixo são
              agregadas por produto na sessão.
            </p>
          )}
          {contagem.observacao && (
            <p className="mb-3 text-sm">
              <span className="text-muted-foreground">Observação: </span>
              {contagem.observacao}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Produto</th>
                  <th className="px-3 py-2 font-medium">Esperada</th>
                  <th className="px-3 py-2 font-medium">Contada</th>
                  <th className="px-3 py-2 font-medium">Diferença</th>
                  <th className="px-3 py-2 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {contagem.itens.map((item) => {
                  const divergente = item.statusItem === 'divergente'
                  return (
                    <tr
                      key={item.id}
                      className={`border-b last:border-0 ${
                        divergente ? 'bg-amber-500/10' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{item.nomeExibicao}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.sku || '—'}
                          {item.unidadeNome || item.unidade
                            ? ` · ${item.unidadeNome || item.unidade}`
                            : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatarQtd(item.qtdEsperada)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatarQtd(item.qtdContada)}</td>
                      <td className="px-3 py-2 tabular-nums font-medium">
                        {textoDiferenca(item.diferenca)}
                      </td>
                      <td className="px-3 py-2">
                        {divergente ? (
                          <BadgeStatus variante="pendente">Divergente</BadgeStatus>
                        ) : (
                          <BadgeStatus variante="sucesso">OK</BadgeStatus>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardPadrao>
      ) : (
        <CardPadrao titulo="Resultado da contagem">
          <p className="text-sm text-muted-foreground">
            Nenhuma sessão de contagem finalizada encontrada para esta nota.
          </p>
        </CardPadrao>
      )}

      {achados.length > 0 && (
        <CardPadrao titulo="Conferência de preço e nome">
          {nota.auditoriaChegada?.aceitoEm && (
            <p className="mb-3 text-xs text-muted-foreground">
              Confirmada em {formatarData(nota.auditoriaChegada.aceitoEm)}.
            </p>
          )}

          {achadosPreco.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-medium">Preço</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Produto</th>
                      <th className="px-3 py-2 font-medium">Preço atual</th>
                      <th className="px-3 py-2 font-medium">Última entrada</th>
                      <th className="px-3 py-2 font-medium">Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {achadosPreco.map((a) => (
                      <tr key={`preco-${a.itemId}`} className="border-b last:border-0 bg-amber-500/5">
                        <td className="px-3 py-2">
                          {a.nItem != null ? `#${a.nItem} · ` : ''}
                          {a.produto || '—'}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{formatarMoeda(a.precoAtual)}</td>
                        <td className="px-3 py-2 tabular-nums">{formatarMoeda(a.precoUltima)}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {a.variacaoPercentual != null
                            ? `${(a.variacaoPercentual * 100).toLocaleString('pt-BR', {
                                maximumFractionDigits: 1,
                              })}%`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {achadosNome.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">Nome</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Item</th>
                      <th className="px-3 py-2 font-medium">Nome na NF</th>
                      <th className="px-3 py-2 font-medium">Nome no sistema</th>
                    </tr>
                  </thead>
                  <tbody>
                    {achadosNome.map((a) => (
                      <tr key={`nome-${a.itemId}`} className="border-b last:border-0 bg-amber-500/5">
                        <td className="px-3 py-2">
                          {a.nItem != null ? `#${a.nItem}` : '—'}
                        </td>
                        <td className="px-3 py-2">{a.nomeNf || '—'}</td>
                        <td className="px-3 py-2">{a.nomeSistema || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {achadosPreco.length === 0 && achadosNome.length === 0 && (
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {achados.map((a) => (
                <li key={`${a.tipo}-${a.itemId}`}>{a.mensagem}</li>
              ))}
            </ul>
          )}
        </CardPadrao>
      )}

      <CardPadrao titulo="Itens da NF">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Descrição / produto</th>
                <th className="px-3 py-2 font-medium">Qtd</th>
                <th className="px-3 py-2 font-medium">Unitário</th>
              </tr>
            </thead>
            <tbody>
              {(nota.itens ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                    Nenhum item na nota.
                  </td>
                </tr>
              ) : (
                (nota.itens ?? []).map((i) => (
                  <tr key={i.nItem} className="border-b last:border-0">
                    <td className="px-3 py-2 tabular-nums">{i.nItem}</td>
                    <td className="px-3 py-2">
                      {i.produto?.nomeVenda || i.descricao || '—'}
                      {i.produto?.sku ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({i.produto.sku})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatarQtd(i.quantidade)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatarMoeda(i.valorUnitario)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardPadrao>

      {teveBloqueio && (
        <CardPadrao titulo="Bloqueio / desbloqueio">
          <ol className="space-y-3 text-sm">
            {nota.divergenciaGestao?.bloqueioExplicacao && (
              <li className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Bloqueio
                  {nota.divergenciaGestao.bloqueioEm
                    ? ` · ${formatarData(nota.divergenciaGestao.bloqueioEm)}`
                    : ''}
                </p>
                <p className="mt-1">{nota.divergenciaGestao.bloqueioExplicacao}</p>
              </li>
            )}
            {nota.divergenciaGestao?.desbloqueioExplicacao && (
              <li className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Desbloqueio
                  {nota.divergenciaGestao.desbloqueioEm
                    ? ` · ${formatarData(nota.divergenciaGestao.desbloqueioEm)}`
                    : ''}
                </p>
                <p className="mt-1">{nota.divergenciaGestao.desbloqueioExplicacao}</p>
              </li>
            )}
            {nota.divergenciaResolvidaEm && (
              <li className="text-xs text-muted-foreground">
                Divergência resolvida em {formatarData(nota.divergenciaResolvidaEm)}.
              </li>
            )}
          </ol>

          {bloqueados && bloqueados.itens.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium">Itens bloqueados no estoque</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Quantidade retida no disponível após Bloquear estoque (não circula até
                desbloquear).
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Produto</th>
                      <th className="px-3 py-2 font-medium">Qtd bloqueada</th>
                      <th className="px-3 py-2 font-medium">Bloqueado em</th>
                      <th className="px-3 py-2 font-medium">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bloqueados.itens.map((item) => (
                      <tr
                        key={item.produtoId}
                        className={`border-b last:border-0 ${
                          item.status === 'bloqueado' ? 'bg-destructive/5' : 'bg-emerald-500/5'
                        }`}
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium">{item.nomeVenda}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.sku || '—'}
                            {item.unidade ? ` · ${item.unidade}` : ''}
                          </div>
                        </td>
                        <td className="px-3 py-2 tabular-nums font-medium">
                          {formatarQtd(item.quantidadeBloqueada)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {formatarData(item.bloqueadoEm)}
                        </td>
                        <td className="px-3 py-2">
                          {item.status === 'bloqueado' ? (
                            <BadgeStatus variante="reprovado">Ainda bloqueado</BadgeStatus>
                          ) : (
                            <BadgeStatus
                              variante="sucesso"
                              title={
                                item.desbloqueadoEm
                                  ? `Desbloqueado em ${formatarData(item.desbloqueadoEm)}`
                                  : undefined
                              }
                            >
                              Desbloqueado
                            </BadgeStatus>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(nota.anexos?.length ?? 0) > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {(nota.anexos ?? []).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => void baixarAnexo(a.id, a.nomeArquivo)}
                  >
                    {a.nomeArquivo}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {rotuloTipoAnexo(a.tipoAnexo)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardPadrao>
      )}

      {xml && (
        <CardPadrao
          titulo="NF original"
          acoes={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setNfAberta((v) => !v)}
              aria-expanded={nfAberta}
            >
              {nfAberta ? 'Recolher' : 'Expandir'}
            </Button>
          }
        >
          {nfAberta ? <ConteudoVisualizacaoNota visualizacao={xml} /> : null}
        </CardPadrao>
      )}
    </div>
  )
}

export default function PaginaDetalheAuditoriaEntrada() {
  return (
    <ProtegerRota chaveDaPagina="auditoria-entradas">
      <ConteudoDetalheAuditoria />
    </ProtegerRota>
  )
}
