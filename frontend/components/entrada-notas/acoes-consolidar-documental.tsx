'use client'

import { BotaoPrimario } from '@/components/ui/botao-primario'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Label } from '@/components/ui/label'

type Props = {
  senha: string
  onSenhaChange: (v: string) => void
  onConsolidar: () => void
  desabilitado?: boolean
  acao?: boolean
  financeiroCompleto?: boolean
  cadastroBloqueante?: boolean
  finalizada?: boolean
}

export function AcoesConsolidarDocumental({
  senha,
  onSenhaChange,
  onConsolidar,
  desabilitado,
  acao,
  financeiroCompleto,
  cadastroBloqueante,
  finalizada,
}: Props) {
  if (finalizada) {
    return (
      <CardPadrao titulo="Entrada consolidada">
        <p className="text-sm text-muted-foreground">
          Documento consolidado — sem movimentação de estoque. Títulos em Contas a pagar.
        </p>
      </CardPadrao>
    )
  }

  const podeConsolidar =
    !desabilitado && !acao && !cadastroBloqueante && financeiroCompleto && senha.trim().length > 0

  return (
    <CardPadrao titulo="Consolidar entrada">
      <p className="mb-3 text-sm text-muted-foreground">
        Despesa/serviço — não movimenta estoque e não vai para contagem física. Informe a senha de
        gerente para consolidar e gerar os títulos a pagar.
      </p>

      {cadastroBloqueante && (
        <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
          Resolva o cadastro do fornecedor antes de consolidar.
        </p>
      )}

      {!financeiroCompleto && !cadastroBloqueante && (
        <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
          Salve a prévia financeira com plano e vencimento em todas as parcelas antes de consolidar.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="senha-consolidar-nfse">Senha gerente</Label>
          <input
            id="senha-consolidar-nfse"
            type="password"
            className="mt-1 block w-full max-w-xs min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
            value={senha}
            disabled={desabilitado || acao}
            onChange={(e) => onSenhaChange(e.target.value)}
          />
        </div>
        <BotaoPrimario type="button" disabled={!podeConsolidar} onClick={onConsolidar}>
          Consolidar (documental)
        </BotaoPrimario>
      </div>
    </CardPadrao>
  )
}
