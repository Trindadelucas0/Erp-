'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { GradeRolavel } from '@/components/ui/grade-rolavel'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'
import { Abas } from '@/components/ui/abas'
import { BadgeStatus } from '@/components/ui/badge-status'
import { rotuloTipoDocumentoCurto } from '@/lib/tipo-documento-entrada'

type NotaAuditoria = {
  id: string
  chaveNfe: string
  tipoDocumento?: string | null
  nomeEmitente: string | null
  documentoEmitente: string | null
  valorTotal: number | null
  dataEmissao: string | null
  finalidadeEntrada?: string | null
  auditadaEm?: string | null
  auditadaPorNome?: string | null
  statusEntrada: string
  divergenciaDesfecho?: string | null
  divergenciaDesbloqueioEm?: string | null
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

function sinalAuditoria(nota: NotaAuditoria): {
  rotulo: string
  variante: 'sucesso' | 'reprovado' | 'info'
} {
  if (nota.divergenciaDesfecho === 'bloqueio') {
    if (nota.divergenciaDesbloqueioEm) {
      return { rotulo: 'Desbloqueado', variante: 'info' }
    }
    return { rotulo: 'Bloqueio', variante: 'reprovado' }
  }
  return { rotulo: 'OK', variante: 'sucesso' }
}

function ConteudoAuditoriaEntradas() {
  const router = useRouter()
  const [aba, setAba] = useState<'pendentes' | 'concluidas'>('pendentes')
  const [notas, setNotas] = useState<NotaAuditoria[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.get<{ notas: NotaAuditoria[] }>(
        '/focus-nfe/nfe-recebidas',
        { params: { painel: 'consolidada' } }
      )
      setNotas((data.notas ?? []).filter((n) => ['nfe55', 'nfse'].includes(n.tipoDocumento ?? 'nfe55')))
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível listar as entradas consolidadas.'))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const visiveis = notas.filter((n) => Boolean(n.auditadaEm) === (aba === 'concluidas'))
  const colunas = aba === 'concluidas' ? 9 : 7

  return (
    <div className="space-y-4">
      <TituloPagina>Auditoria de entradas</TituloPagina>
      <p className="text-sm text-muted-foreground">
        Confira as entradas consolidadas e conclua a auditoria.
      </p>
      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
      <Abas abas={[{ id: 'pendentes', rotulo: 'Pendentes' }, { id: 'concluidas', rotulo: 'Concluídas' }]}
        abaAtiva={aba} aoMudar={(id) => setAba(id as 'pendentes' | 'concluidas')} />
      <CardPadrao titulo="Entradas consolidadas">
        <GradeRolavel>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Emissão</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Fornecedor</th>
                <th className="px-3 py-2 font-medium">Chave</th>
                <th className="px-3 py-2 font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Sinal</th>
                <th className="px-3 py-2 font-medium">Ações</th>
                {aba === 'concluidas' && <><th className="px-3 py-2 font-medium">Auditada em</th><th className="px-3 py-2 font-medium">Auditada por</th></>}
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <LinhasSkeletonTabela colunas={colunas} linhas={6} />
              ) : visiveis.length === 0 ? (
                <tr>
                  <td colSpan={colunas} className="px-3 py-6 text-muted-foreground">
                    {aba === 'pendentes' ? 'Nenhuma entrada pendente de auditoria.' : 'Nenhuma auditoria concluída.'}
                  </td>
                </tr>
              ) : (
                visiveis.map((n) => {
                  const sinal = sinalAuditoria(n)
                  return (
                    <tr
                      key={n.id}
                      className="cursor-pointer border-b hover:bg-muted/40"
                      onClick={() => router.push(`/auditoria-entradas/${n.id}`)}
                    >
                      <td className="px-3 py-2">{formatarData(n.dataEmissao)}</td>
                      <td className="px-3 py-2">{rotuloTipoDocumentoCurto(n.tipoDocumento)}</td>
                      <td className="px-3 py-2">{n.nomeEmitente || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{n.chaveNfe}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {n.valorTotal != null
                          ? n.valorTotal.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })
                          : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <BadgeStatus variante={sinal.variante}>{sinal.rotulo}</BadgeStatus>
                      </td>
                      <td className="px-3 py-2">
                        {n.tipoDocumento === 'nfe55' && n.finalidadeEntrada === 'revenda' ? <button
                          type="button"
                          className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/auditoria-entradas/${n.id}/precificacao`)
                          }}
                        >
                          Precificar
                        </button> : '—'}
                      </td>
                      {aba === 'concluidas' && <><td className="px-3 py-2">{n.auditadaEm ? new Date(n.auditadaEm).toLocaleString('pt-BR') : '—'}</td><td className="px-3 py-2">{n.auditadaPorNome || '—'}</td></>}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </GradeRolavel>
      </CardPadrao>
      <p className="text-xs text-muted-foreground">
        Painel operacional:{' '}
        <Link href="/entrada-notas?painel=consolidada" className="text-primary underline">
          Entradas consolidadas
        </Link>
      </p>
    </div>
  )
}

export default function PaginaAuditoriaEntradas() {
  return (
    <ProtegerRota chaveDaPagina="auditoria-entradas">
      <ConteudoAuditoriaEntradas />
    </ProtegerRota>
  )
}
