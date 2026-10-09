'use client'

import { ChevronDown, ChevronUp, Headphones } from 'lucide-react'
import { CardFormaPagamentoTotem } from '@/components/receber-pagamento/card-forma-pagamento-totem'
import { GradeFormasTotem } from '@/components/receber-pagamento/grade-formas-totem'
import { GradeParcelasTotem } from '@/components/receber-pagamento/grade-parcelas-totem'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import {
  formaConfirmavelNoTotem,
  formaEhCartao,
  formatarMoeda,
  rotuloCondicaoPagamento,
  totalLinhaOrcamento,
  type OrcamentoRecebimento,
} from '@/lib/receber-pagamento-orcamento'
import type { FormaPagamentoUi } from '@/lib/receber-pagamento-desenvolvimento'
import {
  normalizarFormaTotemTouch,
  type FormaTotemTouch,
  type OpcoesTotemRecebimento,
} from '@/lib/receber-pagamento-totem'

type Props = {
  orcamento: OrcamentoRecebimento
  opcoes: OpcoesTotemRecebimento
  forma: FormaTotemTouch
  numeroParcelas: number | null
  modoTrocarForma: boolean
  exibirItens: boolean
  gravando: boolean
  erro: string
  podeConfirmarForma: boolean
  onTrocarModoForma: (aberto: boolean) => void
  onForma: (forma: FormaTotemTouch) => void
  onParcelas: (n: number) => void
  onToggleItens: () => void
  onConfirmar: () => void
  onChamarAtendente: () => void
  onVoltar: () => void
}

function rotuloAcaoPagamento(forma: FormaTotemTouch, gravando: boolean) {
  if (gravando) {
    return formaEhCartao(forma as FormaPagamentoUi) ? 'Aguardando…' : 'Confirmando…'
  }
  if (formaEhCartao(forma as FormaPagamentoUi)) return 'Aprovado na maquininha'
  return 'Confirmar pagamento'
}

export function PassoPagamentoTotem({
  orcamento,
  opcoes,
  forma,
  numeroParcelas,
  modoTrocarForma,
  exibirItens,
  gravando,
  erro,
  podeConfirmarForma,
  onTrocarModoForma,
  onForma,
  onParcelas,
  onToggleItens,
  onConfirmar,
  onChamarAtendente,
  onVoltar,
}: Props) {
  const creditoDisponivel = opcoes.parcelasCredito.length > 0
  const formaUi = forma as FormaPagamentoUi
  const creditoSemParcela = forma === 'cartao_credito' && !numeroParcelas

  return (
    <div className="flex flex-1 flex-col gap-5 print:hidden">
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Total do pedido</p>
        <p className="text-4xl font-bold text-primary">{formatarMoeda(orcamento.total)}</p>
        <p className="mt-2 text-base text-foreground">
          {orcamento.clienteNome}
          <span className="text-muted-foreground"> · </span>
          {orcamento.numero}
        </p>
        {orcamento.condicaoPagamento ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Condição no orçamento: {rotuloCondicaoPagamento(orcamento.condicaoPagamento)}
          </p>
        ) : null}
      </div>

      {erro ? (
        <p className="text-center text-base text-destructive" role="alert">
          {erro}
        </p>
      ) : null}

      {!modoTrocarForma ? (
        <>
          <CardFormaPagamentoTotem
            forma={forma}
            chavePix={opcoes.chavePix}
            numeroParcelas={numeroParcelas}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-12 w-full text-base"
            disabled={gravando}
            onClick={() => onTrocarModoForma(true)}
          >
            Trocar forma de pagamento
          </Button>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-lg font-semibold">Escolha a forma de pagamento</p>
          <GradeFormasTotem
            formaAtiva={forma}
            creditoDisponivel={creditoDisponivel}
            disabled={gravando}
            onSelecionar={(f) => {
              onForma(f)
              onTrocarModoForma(false)
            }}
          />
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => onTrocarModoForma(false)}
          >
            Cancelar
          </Button>
        </div>
      )}

      {forma === 'cartao_credito' && !modoTrocarForma && creditoDisponivel ? (
        <GradeParcelasTotem
          total={orcamento.total}
          parcelas={opcoes.parcelasCredito}
          selecionada={numeroParcelas}
          disabled={gravando}
          onSelecionar={onParcelas}
        />
      ) : null}

      {forma === 'cartao_credito' && !creditoDisponivel && !modoTrocarForma ? (
        <p className="text-center text-sm text-muted-foreground">
          Cadastre cartões de crédito em Configurações → Financeiro → Cartões de Pagamento.
        </p>
      ) : null}

      {!formaConfirmavelNoTotem(orcamento.condicaoPagamento, formaUi) && !modoTrocarForma ? (
        <p className="text-center text-base text-muted-foreground">
          Para dinheiro ou à vista no caixa, chame um atendente.
        </p>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        className="w-full justify-between min-h-12 text-base"
        onClick={onToggleItens}
      >
        Ver itens
        {exibirItens ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
      </Button>

      {exibirItens ? (
        <ul className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border p-4 text-base">
          {orcamento.itens.map((item) => (
            <li key={item.id} className="flex justify-between gap-2 border-b border-border/60 pb-2 last:border-0">
              <span>
                {item.descricao || item.codigo} · {item.quantidade} {item.unidade}
              </span>
              <span className="shrink-0">{formatarMoeda(totalLinhaOrcamento(item))}</span>
            </li>
          ))}
          <li className="flex justify-between pt-2 font-semibold text-primary">
            <span>Total</span>
            <span>{formatarMoeda(orcamento.total)}</span>
          </li>
        </ul>
      ) : null}

      <div className="mt-auto space-y-3 pt-2">
        {podeConfirmarForma ? (
          <BotaoPrimario
            type="button"
            className="min-h-16 w-full text-xl"
            disabled={gravando || creditoSemParcela}
            onClick={onConfirmar}
          >
            {rotuloAcaoPagamento(forma, gravando)}
          </BotaoPrimario>
        ) : (
          <BotaoPrimario
            type="button"
            className="min-h-16 w-full text-xl"
            disabled={gravando}
            onClick={onChamarAtendente}
          >
            <Headphones className="mr-2 size-6" />
            Chame um atendente
          </BotaoPrimario>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" className="min-h-12 text-base" onClick={onVoltar}>
            Voltar
          </Button>
          {podeConfirmarForma ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-12 text-base"
              disabled={gravando}
              onClick={onChamarAtendente}
            >
              Chame um atendente
            </Button>
          ) : (
            <span />
          )}
        </div>
      </div>
    </div>
  )
}
