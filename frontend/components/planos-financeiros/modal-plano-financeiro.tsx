'use client'

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { Modal } from '@/components/ui/modal'
import {
  ModalConfiguracoesAvancadas,
  ModalFaixaErro,
  ModalPainelResumo,
  ModalSecao,
} from '@/components/ui/modal-layout'
import { InputPadrao } from '@/components/ui/input-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectGrupoPlanoFinanceiro } from './select-grupo-plano-financeiro'
import { buscarGrupoPai, type PlanoComNivel } from './util-arvore-planos'
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
  planosDisponiveis: PlanoComNivel[]
  paiPreSelecionadoId?: string | null
  aoFechar: () => void
  aoSalvo: (parentIdCriado?: string | null) => void
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

function temOpcoesNaoPadrao(form: FormPlanoFinanceiro): boolean {
  return (
    !form.mostrarNaDre ||
    form.permiteLancamentoManual ||
    form.exigeAnexoLancamento ||
    form.permiteUsoConsumo
  )
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
  paiPreSelecionadoId,
  aoFechar,
  aoSalvo,
}: Props) {
  const [form, setForm] = useState<FormPlanoFinanceiro>(formVazio)
  const [codigoSugerido, setCodigoSugerido] = useState('')
  const [carregandoCodigo, setCarregandoCodigo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const idBase = useId()
  const parentIdRequisicaoRef = useRef<string | null>(null)

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
        setForm({
          ...formVazio,
          parentId: paiPreSelecionadoId ?? '',
        })
        setCodigoSugerido('')
      }
      setCarregandoCodigo(!modoEdicao)
      setErro('')
    }

    carregarEdicao()
  }, [aberto, modoEdicao, planoEmEdicao, paiPreSelecionadoId])

  useEffect(() => {
    if (!aberto || modoEdicao) return

    const parentIdAtual = form.parentId || null
    parentIdRequisicaoRef.current = parentIdAtual
    setCarregandoCodigo(true)

    async function carregarCodigo() {
      try {
        const params = new URLSearchParams({ tipo })
        if (parentIdAtual) params.set('parentId', parentIdAtual)
        const { data } = await clienteHttp.get(`/planos-financeiros/proximo-codigo?${params}`)

        if (parentIdRequisicaoRef.current !== parentIdAtual) return

        setCodigoSugerido(data.codigo)
      } catch {
        if (parentIdRequisicaoRef.current === parentIdAtual) {
          setCodigoSugerido('')
        }
      } finally {
        if (parentIdRequisicaoRef.current === parentIdAtual) {
          setCarregandoCodigo(false)
        }
      }
    }

    carregarCodigo()
  }, [aberto, modoEdicao, tipo, form.parentId])

  const grupoPaiSelecionado = useMemo(
    () => buscarGrupoPai(planosDisponiveis, form.parentId || null),
    [planosDisponiveis, form.parentId]
  )

  const grupoPaiEdicao = useMemo(() => {
    if (!modoEdicao) return undefined
    const parentId = form.parentId || planoEmEdicao?.parentId || null
    return buscarGrupoPai(planosDisponiveis, parentId)
  }, [modoEdicao, form.parentId, planoEmEdicao?.parentId, planosDisponiveis])

  async function aoSalvar(evento: FormEvent) {
    evento.preventDefault()
    setSalvando(true)
    setErro('')

    const parentIdSalvo = form.parentId || null

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
        aoSalvo()
      } else {
        await clienteHttp.post('/planos-financeiros', {
          ...corpoBase,
          tipo,
          parentId: parentIdSalvo,
          codigo: codigoSugerido || undefined,
        })
        aoSalvo(parentIdSalvo)
      }
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

  const descricaoModal = modoEdicao
    ? 'Altere o nome e as opções. Para mudar de grupo, arraste na lista.'
    : 'Preencha o nome e escolha em qual grupo a conta ficará. O código é gerado automaticamente.'

  const opcoesAvancadasAbertas = modoEdicao && temOpcoesNaoPadrao(form)

  const conteudoPainelResumoCriacao =
    codigoSugerido || !carregandoCodigo ? (
      grupoPaiSelecionado ? (
        <p className="text-muted-foreground">
          Ficará em:{' '}
          <strong className="text-foreground">
            {grupoPaiSelecionado.codigo} - {grupoPaiSelecionado.nome}
          </strong>
          {codigoSugerido && (
            <>
              {' → código '}
              <strong className="text-foreground">{codigoSugerido}</strong>
            </>
          )}
        </p>
      ) : (
        <p className="text-muted-foreground">
          Ficará no <strong className="text-foreground">1º nível</strong>
          {codigoSugerido && (
            <>
              {' → código '}
              <strong className="text-foreground">{codigoSugerido}</strong>
            </>
          )}
        </p>
      )
    ) : null

  const conteudoPainelResumoEdicao = (
    <div className="space-y-1">
      <p className="text-muted-foreground">
        Local atual:{' '}
        <strong className="text-foreground">
          {grupoPaiEdicao
            ? `${grupoPaiEdicao.codigo} - ${grupoPaiEdicao.nome}`
            : '1º nível (sem grupo pai)'}
        </strong>
        {planoEmEdicao && (
          <>
            {' — código '}
            <strong className="text-foreground">{planoEmEdicao.codigo}</strong>
          </>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        Para mover para outro grupo, arraste o plano na lista.
      </p>
    </div>
  )

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={modoEdicao ? 'Editar plano financeiro' : `Nova categoria de ${tituloTipo}`}
      descricao={descricaoModal}
      largura="xl"
      alturaMinimaConteudo="md"
      manterPosicao
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
      <form id="form-plano-financeiro" onSubmit={aoSalvar} className="space-y-5">
        <ModalFaixaErro mensagem={erro} />

        <ModalSecao
          numero={1}
          titulo="Identifique a conta"
          descricao="Nome e classificação usados na DRE e nos relatórios."
        >
          <InputPadrao
            rotulo="Nome da conta"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            placeholder="Ex.: Materiais de escritório"
            required
          />

          <SelectPadrao
            rotulo="Tipo de classificação"
            valor={form.classificacao}
            aoMudar={(v) => setForm((f) => ({ ...f, classificacao: v }))}
            opcoes={OPCOES_CLASSIFICACAO}
          />
        </ModalSecao>

        <ModalSecao
          numero={2}
          titulo="Onde fica na estrutura"
          descricao={
            modoEdicao
              ? 'Posição atual na árvore de contas.'
              : 'Escolha o grupo pai ou deixe no 1º nível.'
          }
        >
          {!modoEdicao && (
            <SelectGrupoPlanoFinanceiro
              rotulo="Criar dentro do grupo"
              valor={form.parentId}
              aoMudar={(v) => setForm((f) => ({ ...f, parentId: v }))}
              planos={planosDisponiveis}
            />
          )}

          <ModalPainelResumo
            carregando={!modoEdicao && carregandoCodigo && !codigoSugerido}
            opaco={!modoEdicao && carregandoCodigo && Boolean(codigoSugerido)}
          >
            {modoEdicao ? conteudoPainelResumoEdicao : conteudoPainelResumoCriacao}
          </ModalPainelResumo>
        </ModalSecao>

        <ModalSecao numero={3} titulo="Opções do plano">
          <ModalConfiguracoesAvancadas abertoPorPadrao={opcoesAvancadasAbertas}>
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
          </ModalConfiguracoesAvancadas>
        </ModalSecao>
      </form>
    </Modal>
  )
}
