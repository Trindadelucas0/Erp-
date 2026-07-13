'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import { filtrarEntradaCodigoBarras } from '@/lib/validar-codigo-barras-gtin'

export type EmbalagemMasterForm = {
  quantidade: string
  codigoBarras: string
  alturaCm: string
  larguraCm: string
  comprimentoCm: string
}

type Props = {
  itens: EmbalagemMasterForm[]
  aoMudar: (itens: EmbalagemMasterForm[]) => void
  disabled?: boolean
  errosPorIndice?: Record<number, { codigoBarras?: string }>
}

const itemVazio = (): EmbalagemMasterForm => ({
  quantidade: '',
  codigoBarras: '',
  alturaCm: '',
  larguraCm: '',
  comprimentoCm: '',
})

export function ListaEmbalagensMaster({ itens, aoMudar, disabled, errosPorIndice }: Props) {
  function atualizar(index: number, campo: keyof EmbalagemMasterForm, valor: string) {
    const nova = [...itens]
    nova[index] = { ...nova[index], [campo]: valor }
    aoMudar(nova)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Embalagens master (caixa)</p>
          <p className="text-xs text-muted-foreground">
            Quantos itens vêm na caixa na venda. Usado para vender por CX no pedido de venda.
          </p>
        </div>
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
        <div key={index} className="relative grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 h-8 w-8 p-0"
              onClick={() => aoMudar(itens.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          )}

          <InputPadrao
            rotulo="Quantidade na caixa (itens)"
            value={item.quantidade}
            onChange={(e) => atualizar(index, 'quantidade', e.target.value)}
            disabled={disabled}
            placeholder="Ex.: 6 — itens por caixa"
          />
          <InputPadrao
            rotulo="Código de barras embalagem master"
            value={item.codigoBarras}
            onChange={(e) =>
              atualizar(index, 'codigoBarras', filtrarEntradaCodigoBarras(e.target.value))
            }
            disabled={disabled}
            mensagemDeErro={errosPorIndice?.[index]?.codigoBarras}
            placeholder="EAN-13 ou DUN-14"
          />
          <InputPadrao
            rotulo="Altura master (cm)"
            value={item.alturaCm}
            onChange={(e) => atualizar(index, 'alturaCm', e.target.value)}
            disabled={disabled}
          />
          <InputPadrao
            rotulo="Largura master (cm)"
            value={item.larguraCm}
            onChange={(e) => atualizar(index, 'larguraCm', e.target.value)}
            disabled={disabled}
          />
          <InputPadrao
            rotulo="Comprimento master (cm)"
            value={item.comprimentoCm}
            onChange={(e) => atualizar(index, 'comprimentoCm', e.target.value)}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  )
}
