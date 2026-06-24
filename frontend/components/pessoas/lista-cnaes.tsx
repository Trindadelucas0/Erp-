'use client'

import { BadgeStatus } from '@/components/ui/badge-status'

export type CnaeForm = {
  codigo: string
  descricao: string
  principal: boolean
}

type Props = {
  cnaes: CnaeForm[]
  somenteLeitura?: boolean
}

export function ListaCnaes({ cnaes, somenteLeitura = true }: Props) {
  if (cnaes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {somenteLeitura
          ? 'Informe o CNPJ para carregar os CNAEs automaticamente.'
          : 'Nenhum CNAE cadastrado.'}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none">CNAEs</label>
      <div className="overflow-hidden rounded-md border border-border">
        {cnaes.map((cnae) => (
          <div
            key={cnae.codigo}
            className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-0"
          >
            <div className="min-w-0 text-sm">
              <span className="font-mono font-medium">{cnae.codigo}</span>
              {cnae.descricao && (
                <span className="text-muted-foreground"> — {cnae.descricao}</span>
              )}
            </div>
            {cnae.principal && (
              <BadgeStatus variante="ativo">Principal</BadgeStatus>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
