'use client'

import { useCallback, useState } from 'react'
import { BadgeStatus } from '@/components/ui/badge-status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import {
  rotuloStatusContaPagar,
  rotuloTipo,
  rotuloOrigemContaPagar,
  tituloVencido,
  varianteStatusContaPagar,
} from '@/lib/contas-a-pagar'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  ConteudoVisualizacaoNota,
  type VisualizacaoNota,
} from '@/components/entrada-notas/conteudo-visualizacao-nota'

type PropsStatus = {
  status: string
  className?: string
}

export function BadgeStatusContaPagar({ status, className }: PropsStatus) {
  return (
    <BadgeStatus variante={varianteStatusContaPagar(status)} className={className}>
      {rotuloStatusContaPagar(status)}
    </BadgeStatus>
  )
}

type PropsTipo = {
  tipo: string
  className?: string
}

export function BadgeTipoContaPagar({ tipo, className }: PropsTipo) {
  const tributo = tipo === 'tributos'
  return (
    <Badge
      variant="secondary"
      className={cn(
        tributo
          ? 'bg-violet-500/15 text-violet-700 hover:bg-violet-500/15'
          : 'bg-slate-500/10 text-slate-700 hover:bg-slate-500/10',
        className
      )}
    >
      {rotuloTipo(tipo)}
    </Badge>
  )
}

type PropsOrigem = {
  origem: string
  numeroNota?: string | null
  nfeRecebidaId?: string | null
  className?: string
}

function rotuloOrigemComNumero(origem: string, numeroNota: string | null | undefined): string {
  const base = rotuloOrigemContaPagar(origem)
  if (origem === 'nfe' && numeroNota?.trim()) {
    return `${numeroNota.trim()} ${base}`
  }
  return base
}

export function BadgeOrigemContaPagar({
  origem,
  numeroNota,
  nfeRecebidaId,
  className,
}: PropsOrigem) {
  const auto = origem === 'nfe' || origem === 'cte'
  const rotulo = rotuloOrigemComNumero(origem, numeroNota)
  const podeAbrirNota = origem === 'nfe' && Boolean(nfeRecebidaId)

  const [notaAberta, setNotaAberta] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [visualizacao, setVisualizacao] = useState<VisualizacaoNota | null>(null)

  const fecharNota = useCallback(() => {
    setNotaAberta(false)
    setErro(null)
    setVisualizacao(null)
  }, [])

  async function abrirVisualizarNota(evento: React.MouseEvent) {
    evento.stopPropagation()
    if (!nfeRecebidaId || carregando) return
    setNotaAberta(true)
    setCarregando(true)
    setErro(null)
    setVisualizacao(null)
    try {
      const { data } = await clienteHttp.get<{ visualizacao: VisualizacaoNota }>(
        `/focus-nfe/nfe-recebidas/${nfeRecebidaId}/xml`,
        { params: { modo: 'visualizar' } }
      )
      setVisualizacao(data.visualizacao)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível visualizar a nota.'))
    } finally {
      setCarregando(false)
    }
  }

  const classesBadge = cn(
    auto
      ? 'border-sky-500/40 bg-sky-500/10 text-sky-800'
      : 'border-border text-muted-foreground',
    podeAbrirNota && 'cursor-pointer hover:bg-sky-500/20',
    className
  )

  return (
    <>
      {podeAbrirNota ? (
        <button
          type="button"
          className={cn(
            'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            classesBadge
          )}
          onClick={(e) => void abrirVisualizarNota(e)}
          title="Visualizar dados da NF-e"
        >
          {rotulo}
        </button>
      ) : (
        <Badge variant="outline" className={classesBadge}>
          {rotulo}
        </Badge>
      )}

      <Modal
        aberto={notaAberta}
        aoFechar={fecharNota}
        titulo="Visualizar nota"
        descricao="Documento fiscal legível (emitente, itens e totais)."
        largura="5xl"
        alturaMinimaConteudo="md"
        camada="superior"
        rodape={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={fecharNota}>
              Fechar
            </Button>
          </div>
        }
      >
        {carregando && !visualizacao && !erro ? (
          <p className="text-sm text-muted-foreground">Abrindo nota…</p>
        ) : null}
        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
        {visualizacao ? <ConteudoVisualizacaoNota visualizacao={visualizacao} /> : null}
      </Modal>
    </>
  )
}

type PropsVenc = {
  status: string
  vencimento: string | null | undefined
  dataFormatada: string
  dias?: number | null
}

export function CelulaVencimentoContaPagar({
  status,
  vencimento,
  dataFormatada,
  dias,
}: PropsVenc) {
  const vencido = tituloVencido(status, vencimento)
  return (
    <div className="min-w-0">
      <div className={cn('font-medium', vencido && 'text-destructive')}>{dataFormatada}</div>
      {dias != null && status !== 'pago' && status !== 'cancelado' && (
        <div
          className={cn(
            'text-xs',
            vencido
              ? 'font-medium text-destructive'
              : dias <= 3
                ? 'text-amber-700'
                : 'text-muted-foreground'
          )}
        >
          {vencido
            ? `${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'} em atraso`
            : dias === 0
              ? 'Vence hoje'
              : `${dias} dia${dias === 1 ? '' : 's'}`}
        </div>
      )}
    </div>
  )
}
