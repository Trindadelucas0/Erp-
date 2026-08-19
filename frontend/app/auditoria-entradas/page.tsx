'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'
import { rotuloTipoDocumentoCurto } from '@/lib/tipo-documento-entrada'

type NotaAuditoria = {
  id: string
  chaveNfe: string
  tipoDocumento?: string | null
  nomeEmitente: string | null
  documentoEmitente: string | null
  valorTotal: number | null
  dataEmissao: string | null
  statusEntrada: string
  divergenciaDesfecho?: string | null
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

function ConteudoAuditoriaEntradas() {
  const router = useRouter()
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
      setNotas((data.notas ?? []).filter((n) => (n.tipoDocumento ?? 'nfe55') === 'nfe55'))
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível listar as entradas consolidadas.'))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return (
    <div className="space-y-4">
      <TituloPagina>Auditoria de entradas</TituloPagina>
      <p className="text-sm text-muted-foreground">
        Consulta só leitura das notas já consolidadas (NF original, contagem, conferência e
        bloqueio). Não altera o pipeline.
      </p>
      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
      <CardPadrao titulo="Entradas consolidadas">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Emissão</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Fornecedor</th>
                <th className="px-3 py-2 font-medium">Chave</th>
                <th className="px-3 py-2 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <LinhasSkeletonTabela colunas={5} linhas={6} />
              ) : notas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                    Nenhuma NFe consolidada neste filtro.
                  </td>
                </tr>
              ) : (
                notas.map((n) => (
                  <tr
                    key={n.id}
                    className="cursor-pointer border-b hover:bg-muted/40"
                    onClick={() => router.push(`/auditoria-entradas/${n.id}`)}
                  >
                    <td className="px-3 py-2">{formatarData(n.dataEmissao)}</td>
                    <td className="px-3 py-2">{rotuloTipoDocumentoCurto(n.tipoDocumento)}</td>
                    <td className="px-3 py-2">{n.nomeEmitente || '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{n.chaveNfe}</td>
                    <td className="px-3 py-2">
                      {n.valorTotal != null
                        ? n.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
