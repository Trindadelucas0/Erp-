'use client'

import {
  formatarMoeda,
  rotuloFormaParaComprovante,
  totalLinhaOrcamento,
  type OrcamentoRecebimento,
} from '@/lib/receber-pagamento-orcamento'

type Props = {
  empresaNome: string
  orcamento: OrcamentoRecebimento
  formaPagamento?: string | null
  numeroParcelas?: number | null
  valorRecebido?: number | null
  pago?: boolean
}

export function ComprovanteRecebimento({
  empresaNome,
  orcamento,
  formaPagamento,
  numeroParcelas,
  valorRecebido,
  pago = false,
}: Props) {
  const troco =
    formaPagamento === 'dinheiro' && valorRecebido != null
      ? Math.max(0, valorRecebido - orcamento.total)
      : null

  return (
    <div className="comprovante-recebimento mx-auto max-w-lg space-y-4 p-6 text-sm text-foreground">
      <header className="border-b border-border pb-3 text-center">
        <p className="text-lg font-bold">{empresaNome}</p>
        <p className="text-muted-foreground">Comprovante de pagamento</p>
        <p className="mt-1 font-medium">Orçamento {orcamento.numero}</p>
        <p className="text-muted-foreground">{orcamento.data}</p>
      </header>

      <div>
        <p className="font-medium">{orcamento.clienteNome}</p>
        {orcamento.cnpj ? <p className="text-muted-foreground">{orcamento.cnpj}</p> : null}
      </div>

      <table className="w-full text-left">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="py-1 pr-2">Item</th>
            <th className="py-1 pr-2 text-right">Qtd</th>
            <th className="py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {orcamento.itens.map((item) => (
            <tr key={item.id} className="border-b border-border/60">
              <td className="py-1 pr-2">{item.descricao || item.codigo}</td>
              <td className="py-1 pr-2 text-right">{item.quantidade}</td>
              <td className="py-1 text-right">{formatarMoeda(totalLinhaOrcamento(item))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-1 border-t border-border pt-2">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>
            {formatarMoeda(
              orcamento.itens.reduce((soma, item) => soma + totalLinhaOrcamento(item), 0)
            )}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Desconto</span>
          <span>{formatarMoeda(orcamento.descontoTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Frete</span>
          <span>{formatarMoeda(orcamento.valorFrete)}</span>
        </div>
        <div className="flex justify-between text-base font-bold text-primary">
          <span>Total</span>
          <span>{formatarMoeda(orcamento.total)}</span>
        </div>
      </div>

      {formaPagamento ? (
        <p>
          Forma: <strong>{rotuloFormaParaComprovante(formaPagamento)}</strong>
          {formaPagamento === 'cartao_credito' && numeroParcelas && numeroParcelas > 1 ? (
            <span> · {numeroParcelas}x</span>
          ) : null}
        </p>
      ) : null}
      {valorRecebido != null && formaPagamento === 'dinheiro' ? (
        <>
          <p>Valor recebido: {formatarMoeda(valorRecebido)}</p>
          <p>Troco: {formatarMoeda(troco ?? 0)}</p>
        </>
      ) : null}

      <p className="text-center text-muted-foreground">
        {pago
          ? 'Pagamento confirmado. Seu pedido segue para separação.'
          : 'Prévia — pagamento ainda não confirmado.'}
      </p>
    </div>
  )
}
