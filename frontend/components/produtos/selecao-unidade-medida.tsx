'use client'

import { useCallback, useEffect, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { SelectPadrao } from '@/components/ui/select-padrao'

export type UnidadeMedidaOpcao = {
  id: string
  sigla: string
  nome: string
}

type Props = {
  valor: string
  aoMudar: (sigla: string) => void
  disabled?: boolean
  obrigatorio?: boolean
  rotulo?: string
}

export function SelecaoUnidadeMedida({
  valor,
  aoMudar,
  disabled,
  obrigatorio,
  rotulo = 'Unidade *',
}: Props) {
  const [unidades, setUnidades] = useState<UnidadeMedidaOpcao[]>([])

  const carregar = useCallback(async () => {
    try {
      const { data } = await clienteHttp.get('/produtos/unidades-medida')
      setUnidades(data.unidades ?? [])
    } catch {
      setUnidades([])
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return (
    <SelectPadrao
      rotulo={rotulo}
      valor={valor}
      aoMudar={aoMudar}
      obrigatorio={obrigatorio}
      opcoes={unidades.map((u) => ({
        value: u.sigla,
        label: `${u.sigla} — ${u.nome}`,
      }))}
      disabled={disabled}
    />
  )
}
