import type { ComponentType } from 'react'
import {
  BicycleIcon,
  BusIcon,
  CarIcon,
  JeepIcon,
  MotorcycleIcon,
  TruckIcon,
  TruckTrailerIcon,
  VanIcon,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

type OpcaoIconeTipoVeiculo = {
  chave: string
  rotulo: string
  Icone: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}

/** Mesmas chaves de `ICONES_TIPO_VEICULO` em `src/modulos/tipos-veiculo/esquema-tipos-veiculo.ts`. */
export const OPCOES_ICONE_TIPO_VEICULO: readonly OpcaoIconeTipoVeiculo[] = [
  { chave: 'van', rotulo: 'Van', Icone: VanIcon },
  { chave: 'caminhao', rotulo: 'Caminhão', Icone: TruckIcon },
  { chave: 'carreta', rotulo: 'Carreta', Icone: TruckTrailerIcon },
  { chave: 'carro', rotulo: 'Carro', Icone: CarIcon },
  { chave: 'utilitario', rotulo: 'Utilitário', Icone: JeepIcon },
  { chave: 'moto', rotulo: 'Moto', Icone: MotorcycleIcon },
  { chave: 'bicicleta', rotulo: 'Bicicleta', Icone: BicycleIcon },
  { chave: 'onibus', rotulo: 'Ônibus', Icone: BusIcon },
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
