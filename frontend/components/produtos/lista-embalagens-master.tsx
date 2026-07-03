'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'

export type EmbalagemMasterForm = {
  quantidade: string
  codigoBarras: string
  descricao: string
}

type Props = {
  itens: EmbalagemMasterForm[]
  aoMudar: (itens: EmbalagemMasterForm[]) => void
  disabled?: boolean
}

const itemVazio = (): EmbalagemMasterForm => ({
  quantidade: '',
  codigoBarras: '',
  descricao: '',
})

export function ListaEmbalagensMaster({ itens, aoMudar, disabled }: Props) {
  function atualizar(index: number, campo: keyof EmbalagemMasterForm, valor: string) {
    const nova = [...itens]
    nova[index] = { ...nova[index], [campo]: valor }
    aoMudar(nova)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Embalagens master</p>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={() => aoMudar([...itens, itemVazio()])}>
            <Plus className="mr-1 size-4" />
            Adicionar
          </Button>
        )}
      </div>

      {itens.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma embalagem master cadastrada.</p>
      )}

      {itens.map((item, index) => (
        <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <InputPadrao
            rotulo="Qtd por master"
            value={item.quantidade}
            onChange={(e) => atualizar(index, 'quantidade', e.target.value)}
            disabled={disabled}
          />
          <InputPadrao
            rotulo="Cód. barras master"
            value={item.codigoBarras}
            onChange={(e) => atualizar(index, 'codigoBarras', e.target.value)}
            disabled={disabled}
          />
          <InputPadrao
            rotulo="Descrição"
            value={item.descricao}
            onChange={(e) => atualizar(index, 'descricao', e.target.value)}
            disabled={disabled}
          />
          {!disabled && (
            <div className="flex items-end pb-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => aoMudar(itens.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
