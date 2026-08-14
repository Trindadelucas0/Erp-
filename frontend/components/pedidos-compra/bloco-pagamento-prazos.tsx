'use client'

import { useState } from 'react'
import { ModalConfirmacao } from '@/components/compartilhado/modal-confirmacao'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Label } from '@/components/ui/label'
import { classesCampoCompacto } from '@/components/ui/classes-campo'
import { cn } from '@/lib/utils'
import {
  somarParcelasManual,
  TOLERANCIA_PARCELAS,
  distribuirParcelasIguais,
  parseValorParcela,
} from '@/lib/parcelas-pagamento-pedido'
import {
  calcularDiasEntreDatas,
  calcularVencimentoPorDias,
  formatarDataBr,
} from '@/lib/prazos-pagamento'

const MENSAGEM_PRAZO_ZERO =
  'Condição de pagamento está como "0" dias o que significa que o pagamento é antes do faturamento das mercadorias. Após aprovação do pedido será gerado um contas a pagar.\n\nDeseja prosseguir?'

type PendenteZero = {
  index: number
  diasAnterior: string
  vencimentoAnterior: string
}

export type PrazoPagamento = {
  numero: number
  dias?: string
  vencimento: string
  valor?: number | string | null
}

type CreditoOpcao = { id: string; saldo: number; origem: string | null }

type Props = {
  condicaoPagamento: string
  rateioParcelas: string
  prazos: PrazoPagamento[]
  dataFaturamento: string
  totalLiquido: number
  creditoFornecedorId: string
  creditoAplicado: string
  creditos: CreditoOpcao[]
  saldoMaxCredito: number
  creditoValido: boolean
  avisoBaixaCredito: string
  disabled: boolean
  formatarMoeda: (v: number) => string
  onRateioChange: (v: string) => void
  onPrazosChange: (prazos: PrazoPagamento[]) => void
  onSelecionarCredito: (id: string) => void
  onCreditoAplicadoChange: (v: string) => void
  onLimparCredito: () => void
  onAdicionarPrazo: () => void
}

function valorExibido(
  prazo: PrazoPagamento,
  index: number,
  prazos: PrazoPagamento[],
  rateioParcelas: string,
  totalLiquido: number
): string {
  const valorNoEstado = parseValorParcela(prazo.valor)
  if (valorNoEstado != null && prazo.valor !== '' && prazo.valor != null) {
    return String(prazo.valor)
  }

  if (rateioParcelas === 'igual') {
    const comVencimento = prazos.filter((p) => p.vencimento?.trim())
    const base = comVencimento.length > 0 ? comVencimento : prazos
    const idx = base.findIndex((p) => p.numero === prazo.numero)
    if (idx < 0) return ''
    const valores = distribuirParcelasIguais(base.length, totalLiquido)
    const v = valores[idx]
    return v != null ? String(v) : ''
  }

  if (prazo.valor == null || prazo.valor === '') return ''
  return String(prazo.valor)
}

export function BlocoPagamentoPrazos({
  condicaoPagamento,
  rateioParcelas,
  prazos,
  dataFaturamento,
  totalLiquido,
  creditoFornecedorId,
  creditoAplicado,
  creditos,
  saldoMaxCredito,
  creditoValido,
  avisoBaixaCredito,
  disabled,
  formatarMoeda,
  onRateioChange,
  onPrazosChange,
  onSelecionarCredito,
  onCreditoAplicadoChange,
  onLimparCredito,
  onAdicionarPrazo,
}: Props) {
  const rateioIgual = rateioParcelas === 'igual'
  const [linhaSelecionada, setLinhaSelecionada] = useState<number | null>(null)
  const [confirmacaoZeroAberta, setConfirmacaoZeroAberta] = useState(false)
  const [pendenteZero, setPendenteZero] = useState<PendenteZero | null>(null)

  function atualizarPrazo(index: number, patch: Partial<PrazoPagamento>) {
    onPrazosChange(prazos.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  function atualizarDias(index: number, dias: string) {
    const diasLimpo = dias.replace(/\D/g, '')
    const prazoAtual = prazos[index]
    const diasAnterior = prazoAtual?.dias ?? ''
    const vencimento = calcularVencimentoPorDias(dataFaturamento, diasLimpo)

    if (diasLimpo === '0' && diasAnterior !== '0') {
      setPendenteZero({
        index,
        diasAnterior,
        vencimentoAnterior: prazoAtual?.vencimento ?? '',
      })
      setConfirmacaoZeroAberta(true)
    }

    atualizarPrazo(index, { dias: diasLimpo, vencimento })
  }

  function confirmarPrazoZero() {
    setConfirmacaoZeroAberta(false)
    setPendenteZero(null)
  }

  function cancelarPrazoZero() {
    if (pendenteZero) {
      atualizarPrazo(pendenteZero.index, {
        dias: pendenteZero.diasAnterior,
        vencimento: pendenteZero.vencimentoAnterior,
      })
    }
    setConfirmacaoZeroAberta(false)
    setPendenteZero(null)
  }

  function atualizarVencimento(index: number, vencimento: string) {
    const dias = calcularDiasEntreDatas(dataFaturamento, vencimento)
    atualizarPrazo(index, { vencimento, dias })
  }

  function atualizarValor(index: number, valor: string) {
    atualizarPrazo(index, { valor })
  }

  function removerPrazo(index: number) {
    if (prazos.length <= 1) return
    onPrazosChange(
      prazos.filter((_, i) => i !== index).map((p, i) => ({ ...p, numero: i + 1 }))
    )
    setLinhaSelecionada(null)
  }

  function aoTeclarLinha(e: React.KeyboardEvent, index: number) {
    if (e.shiftKey && (e.key === 'Delete' || e.key === 'Del')) {
      e.preventDefault()
      removerPrazo(index)
    }
  }

  return (
    <div className="min-w-0 space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">Condição de pagamento e prazos</p>

      <div className="space-y-1">
        <InputPadrao
          rotulo="Condição de pagamento"
          value={condicaoPagamento}
          onChange={() => undefined}
          disabled
          placeholder="—"
        />
        <p className="text-xs text-muted-foreground">
          Preenchida automaticamente pelos prazos do fornecedor / parcelas.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <fieldset className="space-y-1">
          <Label>Rateio das parcelas</Label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="rateio"
                value="igual"
                checked={rateioIgual}
                onChange={() => onRateioChange('igual')}
                disabled={disabled}
              />
              Igual
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="rateio"
                value="manual"
                checked={!rateioIgual}
                onChange={() => onRateioChange('manual')}
                disabled={disabled}
              />
              Manual
            </label>
          </div>
        </fieldset>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={onAdicionarPrazo}>
            Adicionar prazo
          </Button>
        )}
      </div>

      {prazos.length > 0 && (
        <>
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                  <th className="px-2 py-1.5 font-medium">Prazo</th>
                  <th className="px-2 py-1.5 font-medium">Dia</th>
                  <th className="px-2 py-1.5 font-medium">Vencimento</th>
                  <th className="px-2 py-1.5 font-medium">Valor (R$)</th>
                  {!disabled && <th className="shrink-0 px-2 py-1.5 font-medium" />}
                </tr>
              </thead>
              <tbody>
                {prazos.map((p, index) => (
                  <tr
                    key={p.numero}
                    tabIndex={disabled ? undefined : 0}
                    className={`border-b border-border outline-none ${
                      linhaSelecionada === index ? 'bg-muted/50 ring-1 ring-ring/30' : ''
                    }`}
                    onFocus={() => setLinhaSelecionada(index)}
                    onBlur={() => setLinhaSelecionada((atual) => (atual === index ? null : atual))}
                    onKeyDown={(e) => aoTeclarLinha(e, index)}
                  >
                    <td className="px-2 py-1.5">{p.numero}</td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={p.dias ?? ''}
                        onChange={(e) => atualizarDias(index, e.target.value)}
                        disabled={disabled}
                        placeholder="Dias"
                        maxLength={4}
                        className={cn(classesCampoCompacto, 'box-border max-w-full')}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      {disabled ? (
                        <span className="text-sm tabular-nums">{formatarDataBr(p.vencimento)}</span>
                      ) : (
                        <input
                          type="date"
                          value={p.vencimento}
                          onChange={(e) => atualizarVencimento(index, e.target.value)}
                          disabled={disabled}
                          className={cn(classesCampoCompacto, 'box-border max-w-full')}
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {rateioIgual ? (
                        <span className="text-sm tabular-nums">
                          {formatarMoeda(Number(valorExibido(p, index, prazos, rateioParcelas, totalLiquido)) || 0)}
                        </span>
                      ) : (
                        <input
                          type="text"
                          inputMode="decimal"
                          value={valorExibido(p, index, prazos, rateioParcelas, totalLiquido)}
                          onChange={(e) => atualizarValor(index, e.target.value)}
                          disabled={disabled}
                          placeholder="0,00"
                          className={cn(classesCampoCompacto, 'box-border max-w-full')}
                        />
                      )}
                    </td>
                    {!disabled && (
                      <td className="shrink-0 px-2 py-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 whitespace-nowrap px-2 text-xs"
                          onClick={() => removerPrazo(index)}
                          disabled={prazos.length <= 1}
                        >
                          Excluir
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            {rateioIgual
              ? 'Modo Igual: valores calculados automaticamente a partir do total líquido do pedido.'
              : 'Modo Manual: informe o valor (R$) de cada parcela. A soma deve igualar o total líquido.'}
            {!disabled && ' Tecle [Shift + Del] para excluir um prazo.'}
          </p>
          {!rateioIgual && (
            (() => {
              const somaManual = somarParcelasManual(prazos)
              const diverge =
                prazos.some((p) => p.vencimento?.trim()) &&
                Math.abs(somaManual - totalLiquido) > TOLERANCIA_PARCELAS
              return (
                <div className="space-y-1 text-sm">
                  <p className="tabular-nums">
                    Soma: <strong>{formatarMoeda(somaManual)}</strong>
                    {' · '}
                    Total líquido: <strong>{formatarMoeda(totalLiquido)}</strong>
                  </p>
                  {diverge && (
                    <p className="text-sm text-destructive">
                      Soma {formatarMoeda(somaManual)} ≠ líquido {formatarMoeda(totalLiquido)} — ajuste as
                      parcelas para finalizar.
                    </p>
                  )}
                </div>
              )
            })()
          )}
          {!dataFaturamento && (
            <p className="text-xs text-amber-600">
              Informe a data de faturamento para calcular o vencimento a partir dos dias.
            </p>
          )}
        </>
      )}

      <div className="border-t border-border pt-3">
        <p className="mb-2 text-sm font-medium">Crédito do fornecedor</p>
        {creditos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum crédito disponível para este fornecedor.</p>
        ) : (
          <ul className="mb-3 space-y-1 text-xs">
            {creditos.map((c) => {
              const selecionado = creditoFornecedorId === c.id
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    className={`w-full rounded px-2 py-1 text-left transition-colors ${
                      selecionado
                        ? 'bg-primary/15 font-medium text-primary'
                        : 'text-primary hover:bg-muted/50 hover:underline'
                    }`}
                    onClick={() => onSelecionarCredito(c.id)}
                  >
                    {formatarMoeda(c.saldo)}
                    {c.origem ? ` — ${c.origem}` : ''}
                    {selecionado ? ' (aplicado)' : ''}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {creditoFornecedorId && (
          <div className="space-y-2">
            <InputPadrao
              rotulo="Valor a aplicar (R$)"
              value={creditoAplicado}
              onChange={(e) => onCreditoAplicadoChange(e.target.value)}
              disabled={disabled}
              placeholder={`Máx. ${formatarMoeda(saldoMaxCredito)}`}
            />
            {!creditoValido && (
              <p className="text-xs text-destructive">Crédito excede saldo disponível</p>
            )}
            <p className="text-xs text-muted-foreground">{avisoBaixaCredito}</p>
            {!disabled && (
              <Button type="button" variant="ghost" size="sm" onClick={onLimparCredito}>
                Remover crédito
              </Button>
            )}
          </div>
        )}
      </div>

      <ModalConfirmacao
        aberto={confirmacaoZeroAberta}
        titulo="Pagamento antes do faturamento"
        mensagem={MENSAGEM_PRAZO_ZERO}
        textoConfirmar="Prosseguir"
        textoCancelar="Cancelar"
        aoConfirmar={confirmarPrazoZero}
        aoCancelar={cancelarPrazoZero}
      />
    </div>
  )
}

export { distribuirParcelasIguais }
