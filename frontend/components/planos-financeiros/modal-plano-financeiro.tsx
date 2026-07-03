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
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectGrupoPlanoFinanceiro } from './select-grupo-plano-financeiro'
import { COLUNAS_FLAGS_PLANO } from './flags-plano-financeiro'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { buscarGrupoPai, type PlanoComNivel } from './util-arvore-planos'
import type { PlanoFinanceiroNo } from './arvore-planos-financeiros'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  montarCodigoPorSegmentos,
  raizDoTipoPlano,
  sufixoCodigoValido,
  validarSegmentoInformado,
  validarSegmentosCodigo,
  type PlanoCodigoNome,
} from '@/lib/plano-financeiro'

export type TipoPlanoAba = 'receita' | 'despesa' | 'resultado'

export type FormPlanoFinanceiro = {
  nome: string
  parentId: string
  mostrarNaDre: boolean
  permiteLancamentoManual: boolean
  exigeAnexoLancamento: boolean
  permiteUsoConsumo: boolean
}

const formVazio: FormPlanoFinanceiro = {
  nome: '',
  parentId: '',
  mostrarNaDre: true,
  permiteLancamentoManual: false,
  exigeAnexoLancamento: false,
  permiteUsoConsumo: false,
}

type Props = {
  aberto: boolean
  tipo: TipoPlanoAba
  modoEdicao: boolean
  planoEmEdicao: PlanoFinanceiroNo | null
  planosDisponiveis: PlanoComNivel[]
  planosParaValidacao?: PlanoCodigoNome[]
  paiPreSelecionadoId?: string | null
  aoFechar: () => void
  aoSalvo: (parentIdCriado?: string | null) => void
}

function planoParaForm(plano: PlanoFinanceiroNo): FormPlanoFinanceiro {
  return {
    nome: plano.nome,
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

function InputSegmentoCodigo({
  id,
  valor,
  aoMudar,
  invalido,
  desabilitado,
}: {
  id: string
  valor: string
  aoMudar: (valor: string) => void
  invalido?: boolean
  desabilitado?: boolean
}) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      min={0}
      max={99}
      maxLength={2}
      value={valor}
      onChange={(e) => aoMudar(e.target.value.replace(/\D/g, '').slice(0, 2))}
      placeholder="0–99"
      className={`w-16 text-center ${invalido ? 'border-destructive' : ''}`}
      aria-invalid={invalido}
      required
      disabled={desabilitado}
    />
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
  planosParaValidacao = [],
  paiPreSelecionadoId,
  aoFechar,
  aoSalvo,
}: Props) {
  const { perfil } = useSessaoDoUsuario()
  const [form, setForm] = useState<FormPlanoFinanceiro>(formVazio)
  const [segmentoGrupo, setSegmentoGrupo] = useState('')
  const [segmentoSubgrupo, setSegmentoSubgrupo] = useState('')
  const [erroCodigo, setErroCodigo] = useState('')
  const [carregandoCodigo, setCarregandoCodigo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const idBase = useId()
  const parentIdRequisicaoRef = useRef<string | null>(null)

  const nomeEmpresaAtiva = useMemo(() => {
    if (typeof window === 'undefined' || !perfil) return undefined
    const empresaAtivaId = localStorage.getItem('empresaAtivaId')
    return perfil.empresas.find((e) => e.company.id === empresaAtivaId)?.company.name
  }, [perfil])

  useEffect(() => {
    if (!aberto) return

    async function carregarEdicao() {
      if (modoEdicao && planoEmEdicao) {
        try {
          const { data } = await clienteHttp.get(`/planos-financeiros/${planoEmEdicao.id}`)
          setForm(planoParaForm(data.plano))
        } catch {
          setForm(planoParaForm(planoEmEdicao))
        }
      } else {
        setForm({
          ...formVazio,
          parentId: paiPreSelecionadoId ?? '',
        })
        setSegmentoGrupo('')
        setSegmentoSubgrupo('')
        setErroCodigo('')
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

        const novoGrupo = String(data.segmentoGrupo ?? '')
        const novoSubgrupo =
          data.segmentoSubgrupo !== null && data.segmentoSubgrupo !== undefined
            ? String(data.segmentoSubgrupo)
            : ''
        setSegmentoGrupo(novoGrupo)
        setSegmentoSubgrupo(novoSubgrupo)
        setErroCodigo(
          validarCodigoAtual(novoGrupo, novoSubgrupo, Boolean(parentIdAtual))
        )
      } catch {
        if (parentIdRequisicaoRef.current === parentIdAtual) {
          setSegmentoGrupo('')
          setSegmentoSubgrupo('')
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

  const temPai = Boolean(form.parentId)
  const raizTipo = raizDoTipoPlano(tipo)

  const codigoCompleto = useMemo(() => {
    if (!sufixoCodigoValido(Number(segmentoGrupo))) return ''
    if (temPai) {
      if (!sufixoCodigoValido(Number(segmentoSubgrupo))) return ''
      return montarCodigoPorSegmentos(tipo, Number(segmentoGrupo), Number(segmentoSubgrupo))
    }
    return montarCodigoPorSegmentos(tipo, Number(segmentoGrupo))
  }, [tipo, segmentoGrupo, segmentoSubgrupo, temPai])

  function validarCodigoAtual(grupo: string, subgrupo: string, comPai: boolean): string {
    return validarSegmentosCodigo({
      tipo,
      segmentoGrupo: grupo,
      segmentoSubgrupo: subgrupo,
      temPai: comPai,
      codigoPai: grupoPaiSelecionado?.codigo ?? null,
      planosParaValidacao,
      nomeEmpresa: nomeEmpresaAtiva,
    })
  }

  function aoMudarSegmentoGrupo(valor: string) {
    setSegmentoGrupo(valor)
    setErroCodigo(validarCodigoAtual(valor, segmentoSubgrupo, temPai))
  }

  function aoMudarSegmentoSubgrupo(valor: string) {
    setSegmentoSubgrupo(valor)
    setErroCodigo(validarCodigoAtual(segmentoGrupo, valor, temPai))
  }

  async function aoSalvar(evento: FormEvent) {
    evento.preventDefault()

    if (!modoEdicao) {
      const erroValidacao = validarCodigoAtual(segmentoGrupo, segmentoSubgrupo, temPai)
      if (erroValidacao) {
        setErroCodigo(erroValidacao)
        return
      }
    }

    setSalvando(true)
    setErro('')

    const parentIdSalvo = form.parentId || null

    try {
      const corpoBase = {
        nome: form.nome,
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
          segmentoGrupoCodigo: Number(segmentoGrupo),
          ...(parentIdSalvo
            ? { segmentoSubgrupoCodigo: Number(segmentoSubgrupo) }
            : {}),
        })
        aoSalvo(parentIdSalvo)
      }
      aoFechar()
    } catch (e: unknown) {
      setErro(extrairMensagemApi(e, 'Erro ao salvar plano financeiro'))
    } finally {
      setSalvando(false)
    }
  }

  const tituloTipo =
    tipo === 'receita' ? 'receita' : tipo === 'despesa' ? 'despesa' : 'resultado'

  const descricaoModal = modoEdicao
    ? 'Altere o nome e as opções. Para mudar de grupo, arraste na lista.'
    : 'Informe o nome, escolha o grupo e defina o número da sequência. A ordem na lista pode renumerar os códigos ao arrastar.'

  const opcoesAvancadasAbertas = modoEdicao && temOpcoesNaoPadrao(form)
  const codigoInvalido =
    !modoEdicao &&
    (carregandoCodigo ||
      Boolean(erroCodigo) ||
      Boolean(validarSegmentoInformado(segmentoGrupo)) ||
      (temPai && Boolean(validarSegmentoInformado(segmentoSubgrupo))))

  const conteudoPainelResumoCriacao =
    codigoCompleto || !carregandoCodigo ? (
      grupoPaiSelecionado ? (
        <p className="text-muted-foreground">
          Ficará em:{' '}
          <strong className="text-foreground">
            {grupoPaiSelecionado.codigo} - {grupoPaiSelecionado.nome}
          </strong>
          {codigoCompleto && (
            <>
              {' → código '}
              <strong className="text-foreground">{codigoCompleto}</strong>
            </>
          )}
        </p>
      ) : (
        <p className="text-muted-foreground">
          Ficará no <strong className="text-foreground">1º nível</strong>
          {codigoCompleto && (
            <>
              {' → código '}
              <strong className="text-foreground">{codigoCompleto}</strong>
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
          <BotaoPrimario
            type="submit"
            form="form-plano-financeiro"
            disabled={salvando || codigoInvalido}
          >
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
          descricao="Nome exibido na árvore de contas e nos relatórios."
        >
          <InputPadrao
            rotulo="Nome da conta"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            placeholder="Ex.: Materiais de escritório"
            required
          />

          {!modoEdicao && (
            <div className="space-y-2">
              <Label>Código da conta</Label>
              <div className="flex flex-wrap items-center gap-2">
                {temPai ? (
                  <span className="inline-flex h-10 min-w-[2rem] items-center justify-center text-sm font-medium text-foreground">
                    {raizTipo}
                  </span>
                ) : (
                  <Input
                    value={raizTipo}
                    readOnly
                    disabled
                    className="w-16 text-center bg-muted"
                    aria-label="Raiz do tipo"
                  />
                )}
                <span className="text-muted-foreground">.</span>
                <InputSegmentoCodigo
                  id={`${idBase}-segmento-grupo`}
                  valor={segmentoGrupo}
                  aoMudar={aoMudarSegmentoGrupo}
                  invalido={Boolean(erroCodigo)}
                  desabilitado={carregandoCodigo && !segmentoGrupo}
                />
                {temPai && (
                  <>
                    <span className="text-muted-foreground">.</span>
                    <InputSegmentoCodigo
                      id={`${idBase}-segmento-subgrupo`}
                      valor={segmentoSubgrupo}
                      aoMudar={aoMudarSegmentoSubgrupo}
                      invalido={Boolean(erroCodigo)}
                      desabilitado={carregandoCodigo && !segmentoSubgrupo}
                    />
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Informe os números da sequência (0 a 99) em cada parte do código.
              </p>
              {erroCodigo && <p className="text-sm text-destructive">{erroCodigo}</p>}
            </div>
          )}
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
            carregando={!modoEdicao && carregandoCodigo && !codigoCompleto}
            opaco={!modoEdicao && carregandoCodigo && Boolean(codigoCompleto)}
          >
            {modoEdicao ? conteudoPainelResumoEdicao : conteudoPainelResumoCriacao}
          </ModalPainelResumo>
        </ModalSecao>

        <ModalSecao numero={3} titulo="Opções do plano">
          <ModalConfiguracoesAvancadas abertoPorPadrao={opcoesAvancadasAbertas}>
            {COLUNAS_FLAGS_PLANO.map((coluna) => (
              <CampoCheckbox
                key={coluna.chave}
                id={`${idBase}-${coluna.chave}`}
                rotulo={coluna.rotulo}
                valor={form[coluna.chave]}
                aoMudar={(v) => setForm((f) => ({ ...f, [coluna.chave]: v }))}
              />
            ))}
          </ModalConfiguracoesAvancadas>
        </ModalSecao>
      </form>
    </Modal>
  )
}
