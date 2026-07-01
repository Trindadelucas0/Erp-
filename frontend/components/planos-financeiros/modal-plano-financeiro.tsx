'use client'

import { FormEvent, useEffect, useId, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { Modal } from '@/components/ui/modal'
import { InputPadrao } from '@/components/ui/input-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import type { PlanoFinanceiroNo } from './arvore-planos-financeiros'

export type TipoPlanoAba = 'receita' | 'despesa'

export type FormPlanoFinanceiro = {
  nome: string
  classificacao: string
  parentId: string
  mostrarNaDre: boolean
  permiteLancamentoManual: boolean
  exigeAnexoLancamento: boolean
  permiteUsoConsumo: boolean
}

const formVazio: FormPlanoFinanceiro = {
  nome: '',
  classificacao: '',
  parentId: '',
  mostrarNaDre: true,
  permiteLancamentoManual: false,
  exigeAnexoLancamento: false,
  permiteUsoConsumo: false,
}

const OPCOES_CLASSIFICACAO = [
  { value: '', label: 'Selecione a classificação da conta' },
  { value: 'Custo Fixo', label: 'Custo Fixo' },
  { value: 'Custo Variável', label: 'Custo Variável' },
  { value: 'Despesa Fixa', label: 'Despesa Fixa' },
  { value: 'Despesa Variável', label: 'Despesa Variável' },
  { value: 'Contas de ativo', label: 'Contas de ativo' },
  { value: 'Receita operacional', label: 'Receita operacional' },
  { value: 'Receita financeira', label: 'Receita financeira' },
]

type Props = {
  aberto: boolean
  tipo: TipoPlanoAba
  modoEdicao: boolean
  planoEmEdicao: PlanoFinanceiroNo | null
  planosDisponiveis: PlanoFinanceiroNo[]
  aoFechar: () => void
  aoSalvo: () => void
}

function planoParaForm(plano: PlanoFinanceiroNo): FormPlanoFinanceiro {
  return {
    nome: plano.nome,
    classificacao: plano.classificacao ?? '',
    parentId: plano.parentId ?? '',
    mostrarNaDre: plano.mostrarNaDre,
    permiteLancamentoManual: plano.permiteLancamentoManual ?? false,
    exigeAnexoLancamento: plano.exigeAnexoLancamento ?? false,
    permiteUsoConsumo: plano.permiteUsoConsumo ?? false,
  }
}

function CampoCheckbox({
  id,
  rotulo,
  valor,
  aoMudar,
}: {
  id: string
  rotulo: string
  valor: boolean
  aoMudar: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={valor}
        onCheckedChange={(checked) => aoMudar(checked === true)}
      />
      <label htmlFor={id} className="cursor-pointer text-sm font-medium leading-none">
        {rotulo}
      </label>
    </div>
  )
}

export function ModalPlanoFinanceiro({
  aberto,
  tipo,
  modoEdicao,
  planoEmEdicao,
  planosDisponiveis,
  aoFechar,
  aoSalvo,
}: Props) {
  const [form, setForm] = useState<FormPlanoFinanceiro>(formVazio)
  const [codigoSugerido, setCodigoSugerido] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const idBase = useId()

  useEffect(() => {
    if (!aberto) return

    async function carregarEdicao() {
      if (modoEdicao && planoEmEdicao) {
        try {
          const { data } = await clienteHttp.get(`/planos-financeiros/${planoEmEdicao.id}`)
          setForm(planoParaForm(data.plano))
          setCodigoSugerido(data.plano.codigo)
        } catch {
          setForm(planoParaForm(planoEmEdicao))
          setCodigoSugerido(planoEmEdicao.codigo)
        }
      } else {
        setForm(formVazio)
        setCodigoSugerido('')
      }
      setErro('')
    }

    carregarEdicao()
  }, [aberto, modoEdicao, planoEmEdicao])

  useEffect(() => {
    if (!aberto || modoEdicao) return

    async function carregarCodigo() {
      try {
        const params = new URLSearchParams({ tipo })
        if (form.parentId) params.set('parentId', form.parentId)
        const { data } = await clienteHttp.get(`/planos-financeiros/proximo-codigo?${params}`)
        setCodigoSugerido(data.codigo)
      } catch {
        setCodigoSugerido('')
      }
    }

    carregarCodigo()
  }, [aberto, modoEdicao, tipo, form.parentId])

  async function aoSalvar(evento: FormEvent) {
    evento.preventDefault()
    setSalvando(true)
    setErro('')

    try {
      const corpoBase = {
        nome: form.nome,
        classificacao: form.classificacao || undefined,
        mostrarNaDre: form.mostrarNaDre,
        permiteLancamentoManual: form.permiteLancamentoManual,
        exigeAnexoLancamento: form.exigeAnexoLancamento,
        permiteUsoConsumo: form.permiteUsoConsumo,
      }

      if (modoEdicao && planoEmEdicao) {
        await clienteHttp.put(`/planos-financeiros/${planoEmEdicao.id}`, corpoBase)
      } else {
        await clienteHttp.post('/planos-financeiros', {
          ...corpoBase,
          tipo,
          parentId: form.parentId || null,
          codigo: codigoSugerido || undefined,
        })
      }
      aoSalvo()
      aoFechar()
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { mensagem?: string } } })?.response?.data?.mensagem ||
        'Erro ao salvar plano financeiro'
      setErro(msg)
    } finally {
      setSalvando(false)
    }
  }

  const tituloTipo = tipo === 'receita' ? 'receita' : 'despesa'
  const opcoesPai = [
    { value: '', label: 'Nenhum (grupo de primeiro nível)' },
    ...planosDisponiveis.map((p) => ({
      value: p.id,
      label: `${p.codigo} - ${p.nome}`,
    })),
  ]

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={modoEdicao ? 'Editar plano financeiro' : `Nova categoria de ${tituloTipo}`}
      largura="xl"
      rodape={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <BotaoPrimario type="submit" form="form-plano-financeiro" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar plano'}
          </BotaoPrimario>
        </div>
      }
    >
      <form id="form-plano-financeiro" onSubmit={aoSalvar} className="space-y-4">
        {erro && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
        )}

        <p className="text-sm font-semibold text-foreground">Dados do plano</p>

        {!modoEdicao && codigoSugerido && (
          <p className="text-sm text-muted-foreground">
            Código gerado: <span className="font-medium text-foreground">{codigoSugerido}</span>
          </p>
        )}

        {modoEdicao && planoEmEdicao && (
          <p className="text-sm text-muted-foreground">
            Código: <span className="font-medium text-foreground">{planoEmEdicao.codigo}</span>
          </p>
        )}

        <InputPadrao
          rotulo="Nome da conta"
          value={form.nome}
          onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          placeholder="Digite aqui o nome da conta"
          required
        />

        <SelectPadrao
          rotulo="Tipo de classificação"
          valor={form.classificacao}
          aoMudar={(v) => setForm((f) => ({ ...f, classificacao: v }))}
          opcoes={OPCOES_CLASSIFICACAO}
        />

        {!modoEdicao && (
          <SelectPadrao
            rotulo="Vincular ao grupo"
            valor={form.parentId}
            aoMudar={(v) => setForm((f) => ({ ...f, parentId: v }))}
            opcoes={opcoesPai}
          />
        )}

        <Separator />

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Configurações</p>
          <CampoCheckbox
            id={`${idBase}-dre`}
            rotulo="Mostrar na DRE"
            valor={form.mostrarNaDre}
            aoMudar={(v) => setForm((f) => ({ ...f, mostrarNaDre: v }))}
          />
          <CampoCheckbox
            id={`${idBase}-manual`}
            rotulo="Permite lançamento manual"
            valor={form.permiteLancamentoManual}
            aoMudar={(v) => setForm((f) => ({ ...f, permiteLancamentoManual: v }))}
          />
          <CampoCheckbox
            id={`${idBase}-anexo`}
            rotulo="Exige anexo no lançamento financeiro"
            valor={form.exigeAnexoLancamento}
            aoMudar={(v) => setForm((f) => ({ ...f, exigeAnexoLancamento: v }))}
          />
          <CampoCheckbox
            id={`${idBase}-consumo`}
            rotulo="Permite utilização para uso e consumo"
            valor={form.permiteUsoConsumo}
            aoMudar={(v) => setForm((f) => ({ ...f, permiteUsoConsumo: v }))}
          />
        </div>
      </form>
    </Modal>
  )
}
