'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { Button } from '@/components/ui/button'
import {
  ConteudoVisualizacaoNota,
  type VisualizacaoNota,
} from '@/components/entrada-notas/conteudo-visualizacao-nota'

type ItemNota = {
  nItem: number
  descricao: string | null
  quantidade: number | null
  valorUnitario: number | null
  produto: { nomeVenda: string } | null
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
  anexos?: Array<{ id: string; tipoAnexo: string; nomeArquivo: string }>
  divergenciaGestao?: {
    bloqueioExplicacao?: string
    bloqueioEm?: string
    desbloqueioExplicacao?: string
    desbloqueioEm?: string
  } | null
  auditoriaChegada?: {
    achados: Array<{ tipo: string; mensagem: string; itemId: string }>
    aceitoEm?: string | null
  } | null
  itens: ItemNota[]
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR')
}

function ConteudoDetalheAuditoria() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : ''
  const [nota, setNota] = useState<DetalheAuditoria | null>(null)
  const [xml, setXml] = useState<VisualizacaoNota | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

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
    const url = URL.createObjectURL(new Blob([resp.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = nomeArquivo
    a.click()
    URL.revokeObjectURL(url)
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

      <CardPadrao titulo="Resumo da entrada">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Fornecedor</dt>
            <dd>{nota.nomeEmitente || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Documento</dt>
            <dd>{nota.documentoEmitente || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Emissão</dt>
            <dd>{formatarData(nota.dataEmissao)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd>{nota.statusEntrada}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Chave</dt>
            <dd className="font-mono text-xs break-all">{nota.chaveNfe}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Operação:{' '}
          <Link href={`/entrada-notas/${nota.id}`} className="text-primary underline">
            abrir na Entrada de Notas
          </Link>
        </p>
      </CardPadrao>

      {xml && (
        <CardPadrao titulo="NF original">
          <ConteudoVisualizacaoNota visualizacao={xml} />
        </CardPadrao>
      )}

      <CardPadrao titulo="Itens">
        <ul className="space-y-1 text-sm">
          {(nota.itens ?? []).map((i) => (
            <li key={i.nItem}>
              #{i.nItem} · {i.produto?.nomeVenda || i.descricao || '—'}
              {i.quantidade != null ? ` · qtd ${i.quantidade}` : ''}
              {i.valorUnitario != null
                ? ` · ${i.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                : ''}
            </li>
          ))}
        </ul>
      </CardPadrao>

      {nota.auditoriaChegada && nota.auditoriaChegada.achados.length > 0 && (
        <CardPadrao titulo="Conferência de preço e nome">
          <ul className="list-disc space-y-1 pl-4 text-sm">
            {nota.auditoriaChegada.achados.map((a) => (
              <li key={`${a.tipo}-${a.itemId}`}>{a.mensagem}</li>
            ))}
          </ul>
          {nota.auditoriaChegada.aceitoEm && (
            <p className="mt-2 text-xs text-muted-foreground">
              Confirmada em {formatarData(nota.auditoriaChegada.aceitoEm)}.
            </p>
          )}
        </CardPadrao>
      )}

      {(nota.divergenciaDesfecho === 'bloqueio' || (nota.anexos?.length ?? 0) > 0) && (
        <CardPadrao titulo="Bloqueio / desbloqueio">
          {nota.divergenciaGestao?.bloqueioExplicacao && (
            <p className="text-sm">Bloqueio: {nota.divergenciaGestao.bloqueioExplicacao}</p>
          )}
          {nota.divergenciaGestao?.desbloqueioExplicacao && (
            <p className="mt-2 text-sm">Desbloqueio: {nota.divergenciaGestao.desbloqueioExplicacao}</p>
          )}
          <ul className="mt-2 space-y-1 text-sm">
            {(nota.anexos ?? []).map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => void baixarAnexo(a.id, a.nomeArquivo)}
                >
                  {a.nomeArquivo}
                </button>
                <span className="ml-2 text-xs text-muted-foreground">{a.tipoAnexo}</span>
              </li>
            ))}
          </ul>
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
