'use client'

import { BadgeStatus } from '@/components/ui/badge-status'
import { CardPadrao } from '@/components/ui/card-padrao'
import { CadastroResumo } from '@/components/entrada-notas/cadastro-resumo'
import { CfopEntradaFreteCampos } from '@/components/entrada-notas/cfop-entrada-frete'
import type { CfopOpcaoEntrada } from '@/components/entrada-notas/item-vinculo-fiscal-grid'
import { rotuloTipoDocumentoLongo } from '@/lib/tipo-documento-entrada'
import { extrairSerieNumeroChave } from '@/lib/chave-acesso-nfe'

type Props = {
  nota: {
    id: string
    chaveNfe: string
    tipoDocumento?: string | null
    nomeEmitente: string | null
    documentoEmitente: string | null
    valorTotal: number | null
    dataEmissao: string | null
    statusEntrada: string
    cfopEntrada?: { id: string; codigo: string; nome: string } | null
    recorrenciaFinanceira?: { valor: number | null; diaVencimento: number } | null
    analise?: {
      cadastro?: { status: string; avisos?: string[]; bloqueios?: string[] }
    } | null
    fornecedor?: { nome: string } | null
  }
  rotuloStatus: string
  cadastroBloqueante?: boolean
  acoesCadastro?: React.ReactNode
  cfopsEntrada?: CfopOpcaoEntrada[]
  cfopEditavel?: boolean
  acao?: boolean
  onDefinirCfop?: (cfopId: string) => void
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR')
}

function formatarMoeda(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function varianteStatus(status: string): 'sucesso' | 'pendente' | 'reprovado' | 'info' {
  if (status === 'entrada_consolidada' || status === 'pronta_para_consolidar') return 'sucesso'
  if (status === 'em_analise' || status === 'pendente') return 'pendente'
  if (status === 'com_problema' || status === 'cancelada') return 'reprovado'
  return 'info'
}

export function CardDadosNotaEntrada({
  nota,
  rotuloStatus,
  cadastroBloqueante,
  acoesCadastro,
  cfopsEntrada = [],
  cfopEditavel = false,
  acao = false,
  onDefinirCfop,
}: Props) {
  const { serie, numero } = extrairSerieNumeroChave(nota.chaveNfe)
  const cadastro = nota.analise?.cadastro

  return (
    <CardPadrao titulo="Dados da nota">
      <div className="flex flex-wrap gap-2">
        <BadgeStatus variante={varianteStatus(nota.statusEntrada)}>{rotuloStatus}</BadgeStatus>
        <BadgeStatus variante="info">{rotuloTipoDocumentoLongo(nota.tipoDocumento)}</BadgeStatus>
        {cadastro?.status === 'ok' && <BadgeStatus variante="sucesso">Cadastro OK</BadgeStatus>}
        {cadastro?.status === 'bloqueante' && (
          <BadgeStatus variante="reprovado">Cadastro pendente</BadgeStatus>
        )}
        {nota.recorrenciaFinanceira && (
          <BadgeStatus variante="sucesso">Recorrência casada</BadgeStatus>
        )}
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Fornecedor</dt>
          <dd className="font-medium">{nota.nomeEmitente || nota.fornecedor?.nome || '—'}</dd>
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
          <dd className="tabular-nums font-medium">{formatarMoeda(nota.valorTotal)}</dd>
        </div>
        {nota.cfopEntrada && (
          <div>
            <dt className="text-muted-foreground">CFOP de entrada</dt>
            <dd>
              {nota.cfopEntrada.codigo} — {nota.cfopEntrada.nome}
            </dd>
          </div>
        )}
        <div className="sm:col-span-2 lg:col-span-1">
          <dt className="text-muted-foreground">Chave</dt>
          <dd className="break-all font-mono text-xs">{nota.chaveNfe}</dd>
        </div>
      </dl>

      {nota.tipoDocumento === 'nfse' && onDefinirCfop && (
        <div className="mt-4 rounded-md border border-border/60 p-3">
          <p className="mb-2 text-sm font-medium">CFOP de entrada</p>
          <CfopEntradaFreteCampos
            cfopXml={null}
            cfopEntrada={nota.cfopEntrada ?? null}
            cfopsEntrada={cfopsEntrada}
            finalizada={!cfopEditavel}
            acao={acao}
            onDefinirCfopEntrada={onDefinirCfop}
          />
        </div>
      )}

      {cadastroBloqueante && (
        <div className="mt-4 space-y-3 rounded-md border border-amber-300/60 bg-amber-50/50 p-3 dark:border-amber-800/40 dark:bg-amber-950/20">
          <p className="text-sm font-medium">Análise de cadastro</p>
          <CadastroResumo etapa={cadastro} itens={[]} />
          {acoesCadastro}
        </div>
      )}
    </CardPadrao>
  )
}
