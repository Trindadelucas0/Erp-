'use client'

import type { ReactNode } from 'react'
import { BadgeStatus } from '@/components/ui/badge-status'
import { cn } from '@/lib/utils'
import type { StatusConferenciaAnexo } from '@/components/pedidos-compra/modal-conferencia-ia'

export type VarianteBadgeConferencia = 'ativo' | 'pendente' | 'reprovado' | 'sucesso'

export type RotuloStatusConferencia = {
  texto: string
  variante: VarianteBadgeConferencia
}

/** Contexto ERP: distingue "aguardando" vs "já conferido com IA". Portal: pendente = Em conferência. */
export function rotuloStatusConferencia(
  status: StatusConferenciaAnexo,
  opcoes?: { conferidoEm?: string | null; contexto?: 'erp' | 'portal' }
): RotuloStatusConferencia {
  const contexto = opcoes?.contexto ?? 'erp'

  if (status === 'aprovado') {
    return { texto: 'Aprovado', variante: 'sucesso' }
  }
  if (status === 'ajuste_solicitado') {
    return { texto: 'Ajuste solicitado', variante: 'reprovado' }
  }

  if (contexto === 'portal') {
    return { texto: 'Em conferência', variante: 'pendente' }
  }

  if (opcoes?.conferidoEm) {
    return { texto: 'Conferido com IA', variante: 'pendente' }
  }
  return { texto: 'Aguardando conferência', variante: 'pendente' }
}

export type AnexoComOrigem = {
  id: string
  nomeArquivo: string
  enviadoEm: string
  tipoAnexo: 'documento_fornecedor' | 'relatorio_conferencia_ia'
  anexoOrigemId: string | null
  tamanhoBytes?: number
  statusConferencia?: StatusConferenciaAnexo
}

export type DocumentoComRelatorios<T extends AnexoComOrigem> = {
  documento: T
  relatorios: T[]
}

function ordenarDocumentosPorDestaque<T extends AnexoComOrigem>(a: T, b: T): number {
  const aAprovado = a.statusConferencia === 'aprovado' ? 0 : 1
  const bAprovado = b.statusConferencia === 'aprovado' ? 0 : 1
  if (aAprovado !== bAprovado) return aAprovado - bAprovado
  return new Date(b.enviadoEm).getTime() - new Date(a.enviadoEm).getTime()
}

export function organizarAnexosPorDocumento<T extends AnexoComOrigem>(
  anexos: T[]
): { documentos: DocumentoComRelatorios<T>[]; relatoriosAvulsos: T[] } {
  const documentos = anexos
    .filter((a) => a.tipoAnexo === 'documento_fornecedor')
    .sort(ordenarDocumentosPorDestaque)

  const relatorios = anexos.filter((a) => a.tipoAnexo === 'relatorio_conferencia_ia')
  const idsDocumento = new Set(documentos.map((d) => d.id))

  const porOrigem = new Map<string, T[]>()
  const relatoriosAvulsos: T[] = []

  for (const relatorio of relatorios) {
    const origemId = relatorio.anexoOrigemId
    if (origemId && idsDocumento.has(origemId)) {
      const lista = porOrigem.get(origemId) ?? []
      lista.push(relatorio)
      porOrigem.set(origemId, lista)
    } else {
      relatoriosAvulsos.push(relatorio)
    }
  }

  for (const lista of porOrigem.values()) {
    lista.sort((a, b) => new Date(b.enviadoEm).getTime() - new Date(a.enviadoEm).getTime())
  }

  relatoriosAvulsos.sort(
    (a, b) => new Date(b.enviadoEm).getTime() - new Date(a.enviadoEm).getTime()
  )

  return {
    documentos: documentos.map((documento) => ({
      documento,
      relatorios: porOrigem.get(documento.id) ?? [],
    })),
    relatoriosAvulsos,
  }
}

export function formatarDataHoraDocumento(iso: string): string {
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

type CardDocumentoFornecedorProps = {
  nomeArquivo: string
  metadados: string
  status: RotuloStatusConferencia
  /** Documento aprovado fica em destaque (borda/fundo) e sobe na lista. */
  destaque?: boolean
  acoes?: ReactNode
  /** Painel expandido (ex.: aprovar com senha / solicitar ajuste) abaixo das ações. */
  painelDecisao?: ReactNode
  motivoAjuste?: string | null
  historicoRelatorios?: ReactNode
}

export function CardDocumentoFornecedor({
  nomeArquivo,
  metadados,
  status,
  destaque = false,
  acoes,
  painelDecisao,
  motivoAjuste,
  historicoRelatorios,
}: CardDocumentoFornecedorProps) {
  const aprovado = destaque || status.variante === 'sucesso'

  return (
    <div
      className={cn(
        'space-y-2 rounded-lg border p-3 text-sm',
        aprovado
          ? 'border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20'
          : 'border-border bg-card'
      )}
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground" title={nomeArquivo}>
          {nomeArquivo}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{metadados}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <BadgeStatus variante={status.variante}>{status.texto}</BadgeStatus>
        {acoes ? <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div> : null}
      </div>

      {painelDecisao}

      {motivoAjuste ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Motivo do ajuste: {motivoAjuste}
        </p>
      ) : null}

      {historicoRelatorios}
    </div>
  )
}
