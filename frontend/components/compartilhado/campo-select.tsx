import { SelectPadrao, type OpcaoSelect } from '@/components/ui/select-padrao'

type Props = {
  rotulo: string
  valor: string
  aoMudar: (valor: string) => void
  opcoes: OpcaoSelect[]
  obrigatorio?: boolean
  mensagemDeErro?: string
  disabled?: boolean
}

/** Select com rótulo para formulários de cadastro (clientes, fornecedores, etc.). */
export function CampoSelect({
  rotulo,
  valor,
  aoMudar,
  opcoes,
  obrigatorio,
  mensagemDeErro,
  disabled,
}: Props) {
  return (
    <SelectPadrao
      rotulo={rotulo}
      valor={valor}
      aoMudar={aoMudar}
      opcoes={opcoes}
      obrigatorio={obrigatorio}
      mensagemDeErro={mensagemDeErro}
      disabled={disabled}
      compacto
    />
  )
}
