'use client'

import { InputPadrao } from '@/components/ui/input-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { TextareaPadrao } from '@/components/ui/textarea-padrao'
import { Label } from '@/components/ui/label'
import { classesCampo } from '@/components/ui/classes-campo'
import { cn } from '@/lib/utils'
import { ComboboxPessoa } from '@/components/pedidos-compra/combobox-pessoa'
import { ComboboxPlanoFinanceiro } from '@/components/contas-a-pagar/combobox-plano-financeiro'
import { AnexosContaReceber } from '@/components/contas-a-receber/anexos-conta-receber'
import {
  FormContaReceber,
  OPCOES_TIPO_CONTA_RECEBER,
  formatarMoedaBr,
  valorLiquidoForm,
} from '@/lib/contas-a-receber'

type Opcao = { id: string; nome: string; codigo?: string }

type Props = {
  form: FormContaReceber
  aoMudar: (proximo: FormContaReceber) => void
  clientes: Opcao[]
  planos: Opcao[]
  codigoExibicao?: string | null
  somenteLeitura?: boolean
  anexosSomenteLeitura?: boolean
  erro?: string | null
  contaId?: string | null
}

export function FormularioContaReceber({
  form,
  aoMudar,
  clientes,
  planos,
  codigoExibicao,
  somenteLeitura = false,
  anexosSomenteLeitura,
  erro,
  contaId = null,
}: Props) {
  function patch(parcial: Partial<FormContaReceber>) {
    aoMudar({ ...form, ...parcial })
  }

  const anexosBloqueados = anexosSomenteLeitura ?? somenteLeitura
  const liquido = valorLiquidoForm(form)

  return (
    <div className="min-w-0 space-y-4">
      {erro && (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0 space-y-2">
          <Label>Código</Label>
          <input
            className={cn(classesCampo, 'bg-muted')}
            value={codigoExibicao || 'Gerado ao gravar'}
            readOnly
            disabled
          />
        </div>

        <div className="min-w-0">
          <SelectPadrao
            rotulo="Tipo"
            valor={form.tipo}
            aoMudar={(valor) => patch({ tipo: valor as FormContaReceber['tipo'] })}
            opcoes={OPCOES_TIPO_CONTA_RECEBER}
            obrigatorio
            disabled={somenteLeitura}
          />
        </div>

        <div className="min-w-0">
          <InputPadrao
            rotulo="Nr. documento"
            value={form.numeroDocumento}
            onChange={(e) => patch({ numeroDocumento: e.target.value })}
            disabled={somenteLeitura}
          />
        </div>

        <div className="min-w-0">
          <InputPadrao
            rotulo="Valor do documento"
            value={form.valorTotal}
            onChange={(e) => patch({ valorTotal: e.target.value })}
            obrigatorio
            disabled={somenteLeitura}
            placeholder="0,00"
          />
        </div>

        <div className="min-w-0">
          <InputPadrao
            rotulo="Data de emissão"
            type="date"
            value={form.dataEmissao}
            onChange={(e) => patch({ dataEmissao: e.target.value })}
            disabled={somenteLeitura}
          />
        </div>

        <div className="min-w-0">
          <InputPadrao
            rotulo="Data de vencimento"
            type="date"
            value={form.vencimento}
            onChange={(e) => patch({ vencimento: e.target.value })}
            obrigatorio
            disabled={somenteLeitura}
          />
        </div>

        <div className="min-w-0 space-y-2">
          <Label>Valor líquido</Label>
          <input
            className={cn(classesCampo, 'bg-muted tabular-nums')}
            value={formatarMoedaBr(liquido)}
            readOnly
            disabled
          />
        </div>

        <div className="min-w-0">
          <InputPadrao
            rotulo="Comissão"
            value={form.valorComissao}
            onChange={(e) => patch({ valorComissao: e.target.value })}
            disabled={somenteLeitura}
          />
        </div>

        <div className="min-w-0">
          <InputPadrao
            rotulo="Desconto"
            value={form.valorDesconto}
            onChange={(e) => patch({ valorDesconto: e.target.value })}
            disabled={somenteLeitura}
          />
        </div>

        <div className="min-w-0">
          <InputPadrao
            rotulo="Juros"
            value={form.valorJuros}
            onChange={(e) => patch({ valorJuros: e.target.value })}
            disabled={somenteLeitura}
          />
        </div>

        <div className="min-w-0">
          <InputPadrao
            rotulo="Multa"
            value={form.valorMulta}
            onChange={(e) => patch({ valorMulta: e.target.value })}
            disabled={somenteLeitura}
          />
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <ComboboxPessoa
            rotulo="Cliente"
            pessoas={clientes}
            valor={form.pessoaId}
            aoMudar={(pessoaId) => patch({ pessoaId })}
            disabled={somenteLeitura}
            permitirVazio
            rotuloVazio="Sem cliente"
            placeholder="Digite para buscar cliente..."
          />
        </div>

        <div className="min-w-0">
          <ComboboxPlanoFinanceiro
            rotulo="Plano financeiro"
            planos={planos}
            valor={form.planoFinanceiroId}
            aoMudar={(planoFinanceiroId) => patch({ planoFinanceiroId })}
            disabled={somenteLeitura}
            permitirVazio
            rotuloVazio="Sem plano"
            placeholder="Digite código ou nome do plano..."
          />
        </div>
      </div>

      <TextareaPadrao
        rotulo="Observação"
        value={form.observacao}
        onChange={(e) => patch({ observacao: e.target.value })}
        disabled={somenteLeitura}
        className="min-h-[100px]"
      />

      <AnexosContaReceber
        contaId={contaId}
        somenteLeitura={anexosBloqueados}
      />
    </div>
  )
}
