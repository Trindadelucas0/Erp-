'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Label } from '@/components/ui/label'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { classesSelectCompacto } from '@/components/ui/select'
import {
  ehNomePadraoBandeira,
  PRAZOS_DIAS_TAXA_CARTAO,
  sugerirNomeExibicao,
  type CodigoBandeiraCartao,
  type TipoCartaoPagamento,
} from '@/lib/bandeiras-cartao'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { SelectBandeiraCartao } from './select-bandeira-cartao'
import {
  formatarMoedaInput,
  formatarPercentualBr,
  parseNumeroBr,
  type AdquirenteLista,
  type CartaoPagamentoLista,
  type TaxaCartaoForm,
} from './tipos-cartao'

type Props = {
  registro: CartaoPagamentoLista | null
  aoCancelar: () => void
  aoSalvo: () => void
  podeSalvar: boolean
}

function taxaVazia(numeroParcelas: number): TaxaCartaoForm {
  return {
    numeroParcelas,
    taxaPercentual: '0,00',
    prazoDias: 30,
    valorFixo: '0,00',
  }
}

export function FormularioCartaoPagamento({
  registro,
  aoCancelar,
  aoSalvo,
  podeSalvar,
}: Props) {
  const [bandeira, setBandeira] = useState<CodigoBandeiraCartao | ''>(
    (registro?.bandeira as CodigoBandeiraCartao) || ''
  )
  const [tipo, setTipo] = useState<TipoCartaoPagamento>(
    (registro?.tipo as TipoCartaoPagamento) || 'credito'
  )
  const [nomeExibicao, setNomeExibicao] = useState(registro?.nomeExibicao ?? '')
  const [nomeManual, setNomeManual] = useState(Boolean(registro?.nomeExibicao))
  const [ativo, setAtivo] = useState(registro?.ativo ?? true)
  const [adquirenteId, setAdquirenteId] = useState(registro?.adquirenteId ?? '')
  const [permitirParcelamento, setPermitirParcelamento] = useState(
    registro?.tipo === 'debito' ? false : (registro?.permitirParcelamento ?? true)
  )
  const [taxas, setTaxas] = useState<TaxaCartaoForm[]>(() => {
    if (registro?.taxas?.length) {
      return registro.taxas.map((t) => ({
        numeroParcelas: t.numeroParcelas,
        taxaPercentual: formatarPercentualBr(t.taxaPercentual),
        prazoDias: t.prazoDias,
        valorFixo: formatarMoedaInput(t.valorFixo),
      }))
    }
    return [taxaVazia(1)]
  })
  const [adquirentes, setAdquirentes] = useState<AdquirenteLista[]>([])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await clienteHttp.get<{ adquirentes: AdquirenteLista[] }>(
          '/adquirentes',
          { params: { incluirInativos: true } }
        )
        const todos = data.adquirentes ?? []
        const ativos = todos.filter((a) => a.ativo)
        const atual = registro?.adquirenteId
          ? todos.find((a) => a.id === registro.adquirenteId)
          : null
        const lista =
          atual && !atual.ativo ? [...ativos, atual] : ativos.length ? ativos : todos
        setAdquirentes(lista)
      } catch {
        setAdquirentes([])
      }
    })()
  }, [registro?.adquirenteId])

  const opcoesAdquirente = useMemo(
    () =>
      adquirentes.map((a) => ({
        value: a.id,
        label: a.ativo ? a.nome : `${a.nome} (inativo)`,
      })),
    [adquirentes]
  )

  function aplicarBandeira(nova: CodigoBandeiraCartao) {
    setBandeira(nova)
    if (!nomeManual || ehNomePadraoBandeira(nomeExibicao) || !nomeExibicao.trim()) {
      setNomeExibicao(sugerirNomeExibicao(nova, tipo))
      setNomeManual(false)
    }
  }

  function aplicarTipo(novo: TipoCartaoPagamento) {
    setTipo(novo)
    if (novo === 'debito') {
      setPermitirParcelamento(false)
      setTaxas((atual) => {
        const primeira = atual[0] ?? taxaVazia(1)
        return [{ ...primeira, numeroParcelas: 1 }]
      })
    } else {
      setPermitirParcelamento(true)
    }
    if (bandeira && (!nomeManual || ehNomePadraoBandeira(nomeExibicao) || !nomeExibicao.trim())) {
      setNomeExibicao(sugerirNomeExibicao(bandeira, novo))
      setNomeManual(false)
    }
  }

  function atualizarTaxa(indice: number, patch: Partial<TaxaCartaoForm>) {
    setTaxas((atual) => atual.map((t, i) => (i === indice ? { ...t, ...patch } : t)))
  }

  function adicionarParcela() {
    const max = taxas.reduce((acc, t) => Math.max(acc, t.numeroParcelas), 0)
    setTaxas((atual) => [...atual, taxaVazia(max + 1)])
  }

  function removerParcela(indice: number) {
    setTaxas((atual) => (atual.length <= 1 ? atual : atual.filter((_, i) => i !== indice)))
  }

  async function salvar() {
    setErro('')
    if (!bandeira) {
      setErro('Selecione a bandeira')
      return
    }
    if (!adquirenteId) {
      setErro('Selecione a adquirente')
      return
    }
    if (nomeExibicao.trim().length < 2) {
      setErro('Informe o nome para exibição')
      return
    }

    const taxasPayload = []
    for (const t of taxas) {
      const taxaPercentual = parseNumeroBr(t.taxaPercentual)
      const valorFixo = parseNumeroBr(t.valorFixo)
      if (!Number.isFinite(taxaPercentual) || taxaPercentual < 0) {
        setErro('Taxa (%) inválida')
        return
      }
      if (!Number.isFinite(valorFixo) || valorFixo < 0) {
        setErro('Valor fixo inválido')
        return
      }
      taxasPayload.push({
        numeroParcelas: t.numeroParcelas,
        taxaPercentual,
        prazoDias: t.prazoDias,
        valorFixo,
      })
    }

    const body = {
      bandeira,
      tipo,
      nomeExibicao: nomeExibicao.trim(),
      ativo,
      adquirenteId,
      permitirParcelamento: tipo === 'debito' ? false : permitirParcelamento,
      taxas: taxasPayload,
    }

    setSalvando(true)
    try {
      if (registro) {
        await clienteHttp.put(`/cartoes-pagamento/${registro.id}`, body)
      } else {
        await clienteHttp.post('/cartoes-pagamento', body)
      }
      aoSalvo()
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível salvar o cartão'))
    } finally {
      setSalvando(false)
    }
  }

  const mostrarParcelamento = tipo === 'credito'

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-4 sm:p-6">
      <section className="space-y-4">
        <h3 className="text-base font-semibold">Dados do Cartão</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectBandeiraCartao
            valor={bandeira}
            aoMudar={aplicarBandeira}
            obrigatorio
            disabled={!podeSalvar}
          />
          <div className="space-y-1.5">
            <Label>
              Tipo <span className="text-destructive">*</span>
            </Label>
            <div className="flex rounded-md border border-border p-1">
              {(['credito', 'debito'] as const).map((opcao) => (
                <button
                  key={opcao}
                  type="button"
                  disabled={!podeSalvar}
                  onClick={() => aplicarTipo(opcao)}
                  className={`flex-1 rounded px-3 py-2 text-sm font-medium transition-colors ${
                    tipo === opcao
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {opcao === 'credito' ? 'Crédito' : 'Débito'}
                </button>
              ))}
            </div>
          </div>
          <InputPadrao
            rotulo="Nome para exibição *"
            value={nomeExibicao}
            disabled={!podeSalvar}
            onChange={(e) => {
              setNomeExibicao(e.target.value)
              setNomeManual(true)
            }}
            placeholder="Ex.: Mastercard Crédito"
            maxLength={80}
          />
          <div className="flex items-end justify-between gap-3 pb-1">
            <label className="flex items-center gap-2 text-sm font-medium">
              Ativo
              <button
                type="button"
                role="switch"
                aria-checked={ativo}
                disabled={!podeSalvar}
                onClick={() => setAtivo((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  ativo ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    ativo ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </label>
          </div>
          <div className="sm:col-span-2">
            <SelectPadrao
              rotulo="Adquirente / Operadora"
              valor={adquirenteId}
              aoMudar={setAdquirenteId}
              opcoes={opcoesAdquirente}
              placeholder="Selecionar..."
              obrigatorio
              disabled={!podeSalvar}
            />
            {opcoesAdquirente.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Cadastre uma adquirente na seção Adquirentes antes de salvar o cartão.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="border-b border-border">
          <div className="inline-flex border-b-2 border-primary px-1 pb-2 text-sm font-semibold text-primary">
            % Taxas
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {mostrarParcelamento ? 'Parcelamento (crédito)' : 'Taxa (débito)'}
            </p>
            {mostrarParcelamento && (
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={permitirParcelamento}
                  disabled={!podeSalvar}
                  onChange={(e) => {
                    const marcado = e.target.checked
                    setPermitirParcelamento(marcado)
                    if (!marcado) {
                      setTaxas((atual) => {
                        const primeira = atual.find((t) => t.numeroParcelas === 1) ?? atual[0]
                        return [
                          {
                            ...(primeira ?? taxaVazia(1)),
                            numeroParcelas: 1,
                          },
                        ]
                      })
                    }
                  }}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                Permitir parcelamento
              </label>
            )}
          </div>
          {mostrarParcelamento && permitirParcelamento && podeSalvar && (
            <Button type="button" variant="outline" size="sm" onClick={adicionarParcela}>
              <Plus className="h-4 w-4" />
              Adicionar parcela
            </Button>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 font-medium">Nº de parcelas</th>
                <th className="px-3 py-2 font-medium">Taxa (%)</th>
                <th className="px-3 py-2 font-medium">Prazo em dias</th>
                <th className="px-3 py-2 font-medium">Valor fixo por transação (R$)</th>
                <th className="px-3 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {taxas.map((t, indice) => (
                <tr key={`${t.numeroParcelas}-${indice}`} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={1}
                      max={48}
                      value={t.numeroParcelas}
                      disabled={!podeSalvar || tipo === 'debito' || !permitirParcelamento}
                      onChange={(e) =>
                        atualizarTaxa(indice, {
                          numeroParcelas: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="w-20"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="relative">
                      <Input
                        value={t.taxaPercentual}
                        disabled={!podeSalvar}
                        onChange={(e) =>
                          atualizarTaxa(indice, { taxaPercentual: e.target.value })
                        }
                        className="pr-8"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={t.prazoDias}
                      disabled={!podeSalvar}
                      onChange={(e) =>
                        atualizarTaxa(indice, { prazoDias: Number(e.target.value) })
                      }
                      className={classesSelectCompacto}
                    >
                      {PRAZOS_DIAS_TAXA_CARTAO.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        R$
                      </span>
                      <Input
                        value={t.valorFixo}
                        disabled={!podeSalvar}
                        onChange={(e) => atualizarTaxa(indice, { valorFixo: e.target.value })}
                        className="pl-8"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {podeSalvar && (tipo === 'credito' && permitirParcelamento) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removerParcela(indice)}
                        disabled={taxas.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={aoCancelar}>
          Cancelar
        </Button>
        {podeSalvar && (
          <BotaoPrimario type="button" disabled={salvando} onClick={() => void salvar()}>
            {salvando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar
              </>
            )}
          </BotaoPrimario>
        )}
      </div>
    </div>
  )
}
