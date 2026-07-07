'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'

export type EnderecoEstoqueForm = {
  endereco: string
}

type Props = {
  itens: EnderecoEstoqueForm[]
  aoMudar: (itens: EnderecoEstoqueForm[]) => void
  disabled?: boolean
}

const itemVazio = (): EnderecoEstoqueForm => ({ endereco: '' })

export function ListaEnderecosEstoque({ itens, aoMudar, disabled }: Props) {
  function atualizar(index: number, valor: string) {
    const nova = [...itens]
    nova[index] = { endereco: valor }
    aoMudar(nova)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Endereços de estoque</p>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={() => aoMudar([...itens, itemVazio()])}>
            <Plus className="mr-1 size-4" />
            Adicionar
          </Button>
        )}
      </div>

      {itens.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum endereço cadastrado.</p>
      )}

      {itens.map((item, index) => (
        <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_auto]">
          <InputPadrao
            rotulo="Endereço *"
            value={item.endereco}
            onChange={(e) => atualizar(index, e.target.value)}
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
