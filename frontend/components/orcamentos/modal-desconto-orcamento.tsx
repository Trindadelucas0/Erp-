'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { formatarMoeda } from '@/lib/pedido-compra-shared'
import type { ItemOrcamentoLayout } from '@/lib/orcamento-layout'

type Props = {
  aberto: boolean
  itens: ItemOrcamentoLayout[]
  selecionados: string[]
  aoFechar: () => void
  aoAplicar: (percentual: number, itemIds: string[] | null) => Promise<void>
}

export function ModalDescontoOrcamento({ aberto, itens, selecionados, aoFechar, aoAplicar }: Props) {
  const [abrangencia, setAbrangencia] = useState('inteiro')
  const [percentual, setPercentual] = useState(0)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const alvos = abrangencia === 'selecionados' ? itens.filter((i) => selecionados.includes(i.id)) : itens
  const impacto = useMemo(
    () =>
      alvos.reduce(
        (soma, item) => soma + item.quantidade * item.precoUnitario * (percentual / 100),
        0
      ),
    [alvos, percentual]
  )

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md space-y-4 rounded-lg border bg-card p-5 shadow-xl" role="dialog" aria-modal>
        <div>
          <h2 className="text-lg font-semibold">Aplicar descontos</h2>
          <p className="text-sm text-muted-foreground">O novo percentual substitui o anterior.</p>
        </div>
        <InputPadrao rotulo="Tipo" name="tipo-desconto" value="Percentual" readOnly />
        <SelectPadrao
          rotulo="Abrangência"
          valor={abrangencia}
          aoMudar={setAbrangencia}
          opcoes={[
            { value: 'inteiro', label: 'Orçamento inteiro' },
            { value: 'selecionados', label: `Itens selecionados (${selecionados.length})` },
          ]}
        />
        <InputPadrao
          rotulo="Valor do desconto (%)"
          name="percentual-desconto"
          type="number"
          min={0}
          max={100}
          value={String(percentual)}
          onChange={(e) => setPercentual(Number(e.target.value))}
        />
        <div className="rounded-md border p-3 text-sm">
          Impacto financeiro: <strong>{formatarMoeda(impacto)}</strong>
        </div>
        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={aoFechar} disabled={ocupado}>Cancelar</Button>
          <Button
            type="button"
            disabled={ocupado}
            onClick={async () => {
              if (percentual < 0 || percentual > 100) return setErro('Informe um percentual entre 0 e 100.')
              if (abrangencia === 'selecionados' && selecionados.length === 0) return setErro('Selecione ao menos um item.')
              setOcupado(true)
              try {
                await aoAplicar(percentual, abrangencia === 'selecionados' ? selecionados : null)
                aoFechar()
              } finally {
                setOcupado(false)
              }
            }}
          >
            Aplicar desconto
          </Button>
        </div>
      </div>
    </div>
  )
}
