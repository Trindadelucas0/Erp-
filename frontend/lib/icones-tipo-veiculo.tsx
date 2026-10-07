import type { ComponentType } from 'react'
import { CarIcon, JeepIcon, MotorcycleIcon, TruckIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

type OpcaoIconeTipoVeiculo = {
  chave: string
  rotulo: string
  Icone: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}

/** Mesmas chaves de `ICONES_TIPO_VEICULO` em `src/modulos/tipos-veiculo/esquema-tipos-veiculo.ts`. */
export const OPCOES_ICONE_TIPO_VEICULO: readonly OpcaoIconeTipoVeiculo[] = [
  { chave: 'caminhao', rotulo: 'Caminhão', Icone: TruckIcon },
  { chave: 'carro', rotulo: 'Carro', Icone: CarIcon },
  { chave: 'utilitario', rotulo: 'Pick up', Icone: JeepIcon },
  { chave: 'moto', rotulo: 'Moto', Icone: MotorcycleIcon },
]

type Props = {
  icone: string | null | undefined
  className?: string
}

export function IconeTipoVeiculo({ icone, className }: Props) {
  const opcao = OPCOES_ICONE_TIPO_VEICULO.find((o) => o.chave === icone)
  if (!opcao) {
    return <TruckIcon aria-hidden className={cn('shrink-0 text-muted-foreground', className)} />
  }
  const { Icone } = opcao
  return <Icone aria-hidden className={cn('shrink-0', className)} />
}
