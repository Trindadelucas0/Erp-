'use client'

import { InputPadrao } from '@/components/ui/input-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { TextareaPadrao } from '@/components/ui/textarea-padrao'
import { Label } from '@/components/ui/label'
import {
  FormContaPagar,
  OPCOES_TIPO_CONTA,
  OPCOES_TIPO_TRIBUTO,
} from '@/lib/contas-a-pagar'

type Opcao = { id: string; nome: string; codigo?: string }

type Props = {
  form: FormContaPagar
  aoMudar: (proximo: FormContaPagar) => void
  fornecedores: Opcao[]
  planos: Opcao[]
  codigoExibicao?: string | null
  somenteLeitura?: boolean
  erro?: string | null
}

export function FormularioContaPagar({
  form,
  aoMudar,
  fornecedores,
  planos,
  codigoExibicao,
  somenteLeitura = false,
  erro,
}: Props) {
  function patch(parcial: Partial<FormContaPagar>) {
    aoMudar({ ...form, ...parcial })
  }

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
            className="flex h-9 w-full max-w-full rounded-md border border-input bg-muted px-3 text-sm"
            value={codigoExibicao || 'Gerado ao gravar'}
            readOnly
            disabled
          />
        </div>

        <div className="min-w-0">
          <SelectPadrao
            rotulo="Tipo"
            valor={form.tipo}
            aoMudar={(valor) =>
              patch({
                tipo: valor as FormContaPagar['tipo'],
                tipoTributo: valor === 'tributos' ? form.tipoTributo : '',
                codigoReceita: valor === 'tributos' ? form.codigoReceita : '',
                numeroReferencia: valor === 'tributos' ? form.numeroReferencia : '',
              })
            }
            opcoes={OPCOES_TIPO_CONTA}
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

        <div className="min-w-0">
          <InputPadrao
            rotulo="Imposto retido"
            value={form.valorImpostoRetido}
            onChange={(e) => patch({ valorImpostoRetido: e.target.value })}
            disabled={somenteLeitura}
          />
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <SelectPadrao
            rotulo="Fornecedor"
            valor={form.pessoaId}
            aoMudar={(pessoaId) => patch({ pessoaId })}
            opcoes={[
              { value: '', label: '— Sem fornecedor —' },
              ...fornecedores.map((f) => ({ value: f.id, label: f.nome })),
            ]}
            disabled={somenteLeitura}
          />
        </div>

        <div className="min-w-0">
          <SelectPadrao
            rotulo="Plano financeiro"
            valor={form.planoFinanceiroId}
            aoMudar={(planoFinanceiroId) => patch({ planoFinanceiroId })}
            opcoes={[
              { value: '', label: '— Sem plano —' },
              ...planos.map((p) => ({
                value: p.id,
                label: p.codigo ? `${p.codigo} ${p.nome}` : p.nome,
              })),
            ]}
            disabled={somenteLeitura}
          />
        </div>
      </div>

      {form.tipo === 'tributos' && (
        <div className="min-w-0 space-y-3 rounded-md border border-border p-3">
          <p className="text-sm font-medium">Dados do tributo</p>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="min-w-0">
              <SelectPadrao
                rotulo="Tipo de tributo"
                valor={form.tipoTributo}
                aoMudar={(tipoTributo) =>
                  patch({ tipoTributo: tipoTributo as FormContaPagar['tipoTributo'] })
                }
                opcoes={[
                  { value: '', label: 'Selecione' },
                  ...OPCOES_TIPO_TRIBUTO,
                ]}
                obrigatorio
                disabled={somenteLeitura}
              />
            </div>
            <div className="min-w-0">
              <InputPadrao
                rotulo="Cód. receita"
                value={form.codigoReceita}
                onChange={(e) => patch({ codigoReceita: e.target.value })}
                disabled={somenteLeitura}
              />
            </div>
            <div className="min-w-0">
              <InputPadrao
                rotulo="Número da referência"
                value={form.numeroReferencia}
                onChange={(e) => patch({ numeroReferencia: e.target.value })}
                disabled={somenteLeitura}
              />
            </div>
          </div>
        </div>
      )}

      <TextareaPadrao
        rotulo="Observação"
        value={form.observacao}
        onChange={(e) => patch({ observacao: e.target.value })}
        disabled={somenteLeitura}
        className="min-h-[100px]"
      />
    </div>
  )
}
