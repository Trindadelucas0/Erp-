'use client'

import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Label } from '@/components/ui/label'
import { distribuirParcelasIguais } from '@/lib/parcelas-pagamento-pedido'

export type PrazoPagamento = {
  numero: number
  vencimento: string
  valor?: number | string | null
}

type CreditoOpcao = { id: string; saldo: number; origem: string | null }

type Props = {
  condicaoPagamento: string
  rateioParcelas: string
  prazos: PrazoPagamento[]
  totalLiquido: number
  creditoFornecedorId: string
  creditoAplicado: string
  creditos: CreditoOpcao[]
  saldoMaxCredito: number
  creditoValido: boolean
  avisoBaixaCredito: string
  disabled: boolean
  formatarMoeda: (v: number) => string
  onCondicaoChange: (v: string) => void
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
  if (rateioParcelas === 'igual') {
    const comVencimento = prazos.filter((p) => p.vencimento?.trim())
    if (!prazo.vencimento?.trim()) return ''
    const idx = comVencimento.findIndex((p) => p.numero === prazo.numero)
    if (idx < 0) return ''
    const n = comVencimento.length || prazos.length
    const valores = distribuirParcelasIguais(n, totalLiquido)
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
  totalLiquido,
  creditoFornecedorId,
  creditoAplicado,
  creditos,
  saldoMaxCredito,
  creditoValido,
  avisoBaixaCredito,
  disabled,
  formatarMoeda,
  onCondicaoChange,
  onRateioChange,
  onPrazosChange,
  onSelecionarCredito,
  onCreditoAplicadoChange,
  onLimparCredito,
  onAdicionarPrazo,
}: Props) {
  const rateioIgual = rateioParcelas === 'igual'

  function atualizarVencimento(index: number, vencimento: string) {
    const novos = prazos.map((p, i) => (i === index ? { ...p, vencimento } : p))
    onPrazosChange(novos)
  }

  function atualizarValor(index: number, valor: string) {
    const novos = prazos.map((p, i) => (i === index ? { ...p, valor } : p))
    onPrazosChange(novos)
  }

  function removerPrazo(index: number) {
    if (prazos.length <= 1) return
    onPrazosChange(
      prazos.filter((_, i) => i !== index).map((p, i) => ({ ...p, numero: i + 1 }))
    )
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <p className="text-sm font-medium">Condição de pagamento e prazos</p>

      <InputPadrao
        rotulo="Condição de pagamento"
        value={condicaoPagamento}
        onChange={(e) => onCondicaoChange(e.target.value)}
        disabled={disabled}
        placeholder="Ex.: 30/60/90 dias"
      />

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
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium w-16">Prazo</th>
                  <th className="px-3 py-2 font-medium">Dia vencimento</th>
                  <th className="px-3 py-2 font-medium">Valor (R$)</th>
                  {!disabled && <th className="px-2 py-2" />}
                </tr>
              </thead>
              <tbody>
                {prazos.map((p, index) => (
                  <tr key={p.numero} className="border-b border-border">
                    <td className="px-3 py-2">{p.numero}</td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={p.vencimento}
                        onChange={(e) => atualizarVencimento(index, e.target.value)}
                        disabled={disabled}
                        className="flex h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
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
                          className="flex h-8 w-full min-w-[7rem] rounded-md border border-input bg-transparent px-2 text-sm"
                        />
                      )}
                    </td>
                    {!disabled && (
                      <td className="px-2 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
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
          </p>
        </>
      )}

      <div className="border-t border-border pt-4">
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
    </div>
  )
}

export { distribuirParcelasIguais }
