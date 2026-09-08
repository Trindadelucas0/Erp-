'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { InputPadrao } from '@/components/ui/input-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'

type ParametrizacaoCustos = {
  id: string | null
  competencia: string
  pis: number | null
  cofins: number | null
  impRendaSupSimples: number | null
  contribuicaoSocial: number | null
  custoFixo: number | null
  comissao: number | null
  jurosMensaisCustoFinanOperac: number | null
  aliquotaCbs: number | null
  aliquotaIbs: number | null
  totalVenda: number
}

function competenciaAtual(): string {
  const agora = new Date()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  return `${agora.getFullYear()}-${mes}`
}

function textoPercentual(valor: number | null): string {
  if (valor == null || !Number.isFinite(valor)) return ''
  return String(valor)
}

function parsePercentual(texto: string): number | null {
  const t = texto.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function formatarTotal(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 4, minimumFractionDigits: 0 })
}

export function PainelParametrizacaoCustos() {
  const [competencia, setCompetencia] = useState(competenciaAtual)
  const [form, setForm] = useState({
    pis: '',
    cofins: '',
    impRendaSupSimples: '',
    contribuicaoSocial: '',
    custoFixo: '',
    comissao: '',
    jurosMensaisCustoFinanOperac: '',
    aliquotaCbs: '',
    aliquotaIbs: '',
  })
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  const totalVenda = useMemo(() => {
    const campos = [
      form.pis,
      form.cofins,
      form.impRendaSupSimples,
      form.contribuicaoSocial,
      form.custoFixo,
      form.comissao,
    ]
    return campos.reduce((soma, texto) => {
      const n = parsePercentual(texto)
      return n != null ? soma + n : soma
    }, 0)
  }, [form])

  const carregar = useCallback(async (comp: string) => {
    setCarregando(true)
    setErro('')
    setMensagem('')
    try {
      const { data } = await clienteHttp.get<{ parametrizacao: ParametrizacaoCustos }>(
        '/configuracoes/parametrizacao-custos',
        { params: { competencia: comp } }
      )
      const p = data.parametrizacao
      setForm({
        pis: textoPercentual(p.pis),
        cofins: textoPercentual(p.cofins),
        impRendaSupSimples: textoPercentual(p.impRendaSupSimples),
        contribuicaoSocial: textoPercentual(p.contribuicaoSocial),
        custoFixo: textoPercentual(p.custoFixo),
        comissao: textoPercentual(p.comissao),
        jurosMensaisCustoFinanOperac: textoPercentual(p.jurosMensaisCustoFinanOperac),
        aliquotaCbs: textoPercentual(p.aliquotaCbs),
        aliquotaIbs: textoPercentual(p.aliquotaIbs),
      })
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível carregar a parametrização de custos.'))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar(competencia)
  }, [carregar, competencia])

  function alterarCampo(campo: keyof typeof form, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  async function gravar() {
    setSalvando(true)
    setErro('')
    setMensagem('')
    try {
      await clienteHttp.put('/configuracoes/parametrizacao-custos', {
        competencia,
        pis: parsePercentual(form.pis),
        cofins: parsePercentual(form.cofins),
        impRendaSupSimples: parsePercentual(form.impRendaSupSimples),
        contribuicaoSocial: parsePercentual(form.contribuicaoSocial),
        custoFixo: parsePercentual(form.custoFixo),
        comissao: parsePercentual(form.comissao),
        jurosMensaisCustoFinanOperac: parsePercentual(form.jurosMensaisCustoFinanOperac),
        aliquotaCbs: parsePercentual(form.aliquotaCbs),
        aliquotaIbs: parsePercentual(form.aliquotaIbs),
      })
      setMensagem('Parametrização gravada.')
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível gravar a parametrização.'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <CardPadrao
      titulo="Parametrização de custos"
      descricao="Percentuais da empresa ativa, por competência (mês/ano). Nesta fase não entram no custo da Auditoria nem na formação de preço de venda."
    >
      <div className="space-y-6">
        <div className="max-w-xs">
          <InputPadrao
            rotulo="Competência"
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            disabled={carregando || salvando}
          />
        </div>

        {erro && (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {erro}
          </p>
        )}
        {mensagem && (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
            {mensagem}
          </p>
        )}

        <fieldset disabled={carregando || salvando} className="space-y-4">
          <div>
            <h3 className="mb-3 text-sm font-medium">Venda</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InputPadrao
                rotulo="PIS"
                inputMode="decimal"
                value={form.pis}
                onChange={(e) => alterarCampo('pis', e.target.value)}
              />
              <InputPadrao
                rotulo="COFINS"
                inputMode="decimal"
                value={form.cofins}
                onChange={(e) => alterarCampo('cofins', e.target.value)}
              />
              <InputPadrao
                rotulo="Imp. renda / Sup. SIMPLES"
                inputMode="decimal"
                value={form.impRendaSupSimples}
                onChange={(e) => alterarCampo('impRendaSupSimples', e.target.value)}
              />
              <InputPadrao
                rotulo="Contribuição social"
                inputMode="decimal"
                value={form.contribuicaoSocial}
                onChange={(e) => alterarCampo('contribuicaoSocial', e.target.value)}
              />
              <InputPadrao
                rotulo="Custo fixo"
                inputMode="decimal"
                value={form.custoFixo}
                onChange={(e) => alterarCampo('custoFixo', e.target.value)}
              />
              <InputPadrao
                rotulo="Comissão"
                inputMode="decimal"
                value={form.comissao}
                onChange={(e) => alterarCampo('comissao', e.target.value)}
              />
              <InputPadrao
                rotulo="Total"
                value={`${formatarTotal(totalVenda)}%`}
                readOnly
                disabled
              />
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium">Fora do total da venda</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InputPadrao
                rotulo="Juros mensais p/ custo finan. operac."
                inputMode="decimal"
                value={form.jurosMensaisCustoFinanOperac}
                onChange={(e) => alterarCampo('jurosMensaisCustoFinanOperac', e.target.value)}
              />
              <InputPadrao
                rotulo="Alíquota CBS"
                inputMode="decimal"
                value={form.aliquotaCbs}
                onChange={(e) => alterarCampo('aliquotaCbs', e.target.value)}
              />
              <InputPadrao
                rotulo="Alíquota IBS"
                inputMode="decimal"
                value={form.aliquotaIbs}
                onChange={(e) => alterarCampo('aliquotaIbs', e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        <BotaoPrimario type="button" onClick={() => void gravar()} disabled={carregando || salvando}>
          {salvando ? 'Gravando…' : 'Gravar'}
        </BotaoPrimario>
      </div>
    </CardPadrao>
  )
}
