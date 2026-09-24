'use client'

import { InputPadrao } from '@/components/ui/input-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { TextareaPadrao } from '@/components/ui/textarea-padrao'
import { Label } from '@/components/ui/label'
import { classesCampo } from '@/components/ui/classes-campo'
import { cn } from '@/lib/utils'
import { ComboboxPessoa } from '@/components/pedidos-compra/combobox-pessoa'
import { ComboboxPlanoFinanceiro } from '@/components/contas-a-pagar/combobox-plano-financeiro'
import { AnexosContaPagar } from '@/components/contas-a-pagar/anexos-conta-pagar'
import {
  ContaPagarLista,
  FormContaPagar,
  OPCOES_TIPO_CONTA,
  OPCOES_TIPO_TRIBUTO,
  formatarDataBr,
  formatarMoedaBr,
} from '@/lib/contas-a-pagar'

type Opcao = { id: string; nome: string; codigo?: string }

type Props = {
  form: FormContaPagar
  aoMudar: (proximo: FormContaPagar) => void
  fornecedores: Opcao[]
  planos: Opcao[]
  codigoExibicao?: string | null
  somenteLeitura?: boolean
  /** Independente dos campos: anexos podem ser liberados em título NFe/CT-e. */
  anexosSomenteLeitura?: boolean
  erro?: string | null
  /** Id do título gravado — necessário para anexar. */
  contaId?: string | null
  /** Parcelas do título (duplicatas da NFe) — grade só leitura quando origem entrada. */
  parcelas?: ContaPagarLista['parcelas']
  origem?: string | null
}

export function FormularioContaPagar({
  form,
  aoMudar,
  fornecedores,
  planos,
  codigoExibicao,
  somenteLeitura = false,
  anexosSomenteLeitura,
  erro,
  contaId = null,
  parcelas,
  origem = null,
}: Props) {
  function patch(parcial: Partial<FormContaPagar>) {
    aoMudar({ ...form, ...parcial })
  }

  const anexosBloqueados = anexosSomenteLeitura ?? somenteLeitura
  const listaParcelas = Array.isArray(parcelas) ? parcelas : []
  const mostrarGradeDuplicatas =
    listaParcelas.length > 1 && (origem === 'nfe' || origem === 'cte')
  const valorTotalTitulo = listaParcelas.reduce((acc, p) => acc + (p.valor ?? 0), 0)

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
            disabled={somenteLeitura || mostrarGradeDuplicatas}
          />
        </div>

        <div className="min-w-0">
          <InputPadrao
            rotulo={mostrarGradeDuplicatas ? 'Valor total' : 'Valor do documento'}
            value={
              mostrarGradeDuplicatas
                ? valorTotalTitulo.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : form.valorTotal
            }
            onChange={(e) => patch({ valorTotal: e.target.value })}
            obrigatorio
            disabled={somenteLeitura || mostrarGradeDuplicatas}
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

        {!mostrarGradeDuplicatas && (
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
        )}

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

      {mostrarGradeDuplicatas && (
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium">Duplicatas</p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Nº</th>
                  <th className="px-3 py-2 font-medium">Documento</th>
                  <th className="px-3 py-2 font-medium">Vencimento</th>
                  <th className="px-3 py-2 font-medium text-right">Valor</th>
                  <th className="px-3 py-2 font-medium text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {listaParcelas.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2 tabular-nums">{p.numeroParcela}</td>
                    <td className="px-3 py-2">{p.numeroDocumento || '—'}</td>
                    <td className="px-3 py-2">{formatarDataBr(p.vencimento)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatarMoedaBr(p.valor)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatarMoedaBr(p.saldoDevedor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <ComboboxPessoa
            rotulo="Fornecedor"
            pessoas={fornecedores}
            valor={form.pessoaId}
            aoMudar={(pessoaId) => patch({ pessoaId })}
            disabled={somenteLeitura}
            permitirVazio
            rotuloVazio="Sem fornecedor"
            placeholder="Digite para buscar fornecedor..."
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

      <AnexosContaPagar
        contaId={contaId}
        somenteLeitura={anexosBloqueados}
      />
    </div>
  )
}
