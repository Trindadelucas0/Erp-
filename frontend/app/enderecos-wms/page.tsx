'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { usePermissao } from '@/hooks/use-permissao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { CardPadrao } from '@/components/ui/card-padrao'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { CampoBuscaLista } from '@/components/compartilhado/campo-busca-lista'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { textosContemTodosTermos } from '@/lib/normalizar-busca'
import {
  completarCodigoNivelWms,
  coletarIdsCaminho,
  corpoGerarEstruturaWms,
  cadastroWmsProntoParaPreview,
  FILHO_NIVEL,
  FORM_GERAR_WMS_VAZIO,
  ROTULO_NOVO_FILHO,
  type FormGerarWms,
  type ItemEstruturaWms,
  type NivelEstruturaWms,
} from '@/lib/estrutura-wms'
import { ArvoreEnderecosWms, type ApartamentoWms } from '@/components/enderecos-wms/arvore-enderecos-wms'
import { ModalNivelWms } from '@/components/enderecos-wms/modal-nivel-wms'
import { ModalGerarEstruturaWms } from '@/components/enderecos-wms/modal-gerar-estrutura-wms'

function acharNo(nos: ItemEstruturaWms[], id: string): ItemEstruturaWms | null {
  for (const no of nos) {
    if (no.id === id) return no
    const filhos = no.filhos ?? []
    const achou = acharNo(filhos, id)
    if (achou) return achou
  }
  return null
}

function breadcrumb(nos: ItemEstruturaWms[], id: string): string {
  const ids = coletarIdsCaminho(nos, id) ?? []
  const codigos: string[] = []
  let lista = nos
  for (const nid of ids) {
    const no = lista.find((n) => n.id === nid)
    if (!no) break
    codigos.push(no.codigo)
    lista = no.filhos ?? []
  }
  return codigos.join(' / ')
}

function idsQueCasam(nos: ItemEstruturaWms[], termo: string, prefixo: string[] = []): string[] {
  const ids: string[] = []
  for (const no of nos) {
    const caminho = [...prefixo, no.id]
    const filhos = no.filhos ?? []
    const bate = textosContemTodosTermos([no.codigo, no.nome], termo)
    const abaixo = idsQueCasam(filhos, termo, caminho)
    if (bate || abaixo.length) ids.push(...caminho, ...abaixo)
  }
  return [...new Set(ids)]
}

export default function PaginaEnderecosWms() {
  return (
    <ProtegerRota chaveDaPagina="enderecos-wms">
      <ConteudoEnderecosWms />
    </ProtegerRota>
  )
}

function ConteudoEnderecosWms() {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('estoque:create')
  const podeEditar = usePermissao('estoque:edit')

  const [arvore, setArvore] = useState<ItemEstruturaWms[]>([])
  const [aps, setAps] = useState<Record<string, ApartamentoWms[]>>({})
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativo' | 'bloqueado' | 'inativo'>('todos')
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  const [modalNivel, setModalNivel] = useState(false)
  const [editando, setEditando] = useState(false)
  const [nivelForm, setNivelForm] = useState<NivelEstruturaWms | 'apartamento'>('local')
  const [parentId, setParentId] = useState<string | null>(null)
  const [idEdicao, setIdEdicao] = useState('')
  const [codigo, setCodigo] = useState('')
  const [nome, setNome] = useState('')
  const [status, setStatus] = useState('ativo')
  const [tipoEndereco, setTipoEndereco] = useState('CH')
  const [hierarquia, setHierarquia] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroModal, setErroModal] = useState('')

  const [modalGerar, setModalGerar] = useState(false)
  const [formGerar, setFormGerar] = useState<FormGerarWms>(FORM_GERAR_WMS_VAZIO)
  const [preview, setPreview] = useState<{ total: number; exemplos: string[] } | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const { data } = await clienteHttp.get('/estrutura-wms?incluirInativos=true')
      setArvore(data.arvore ?? [])
      setErro('')
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao carregar a estrutura WMS.'))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (!estaAutenticado || carregandoSessao) return
    void carregar()
  }, [estaAutenticado, carregandoSessao, carregar])

  useEffect(() => {
    if (!busca.trim()) return
    setExpandidos((prev) => {
      const prox = new Set(prev)
      for (const id of idsQueCasam(arvore, busca)) prox.add(id)
      return prox
    })
  }, [busca, arvore])

  async function carregarAps(andarId: string) {
    try {
      const { data } = await clienteHttp.get(
        `/enderecos-wms?andarId=${encodeURIComponent(andarId)}&incluirInativos=true`
      )
      setAps((prev) => ({ ...prev, [andarId]: data.enderecos ?? [] }))
    } catch {
      setAps((prev) => ({ ...prev, [andarId]: [] }))
    }
  }

  function aoAlternarExpansao(id: string) {
    setExpandidos((prev) => {
      const prox = new Set(prev)
      if (prox.has(id)) prox.delete(id)
      else {
        prox.add(id)
        const no = acharNo(arvore, id)
        if (no?.nivel === 'andar') void carregarAps(id)
      }
      return prox
    })
  }

  function abrirNovoLocal() {
    setEditando(false)
    setNivelForm('local')
    setParentId(null)
    setIdEdicao('')
    setCodigo('')
    setNome('')
    setStatus('ativo')
    setHierarquia('')
    setErroModal('')
    setModalNivel(true)
  }

  function aoNovoFilho(no: ItemEstruturaWms) {
    const filho = FILHO_NIVEL[no.nivel as NivelEstruturaWms]
    if (!filho) return
    setEditando(false)
    setNivelForm(filho)
    setParentId(no.id)
    setIdEdicao('')
    setCodigo('')
    setNome('')
    setStatus('ativo')
    setTipoEndereco('CH')
    setHierarquia(breadcrumb(arvore, no.id))
    setErroModal('')
    setModalNivel(true)
  }

  function aoEditarNo(no: ItemEstruturaWms) {
    setEditando(true)
    setNivelForm(no.nivel as NivelEstruturaWms)
    setParentId(no.parentId ?? null)
    setIdEdicao(no.id)
    setCodigo(no.codigo)
    setNome(no.nome)
    setStatus(no.status ?? (no.ativo ? 'ativo' : 'inativo'))
    setHierarquia(breadcrumb(arvore, no.id))
    setErroModal('')
    setModalNivel(true)
  }

  function aoEditarAp(ap: ApartamentoWms) {
    setEditando(true)
    setNivelForm('apartamento')
    setParentId(ap.andarId)
    setIdEdicao(ap.id)
    setCodigo(ap.codigo)
    setNome('')
    setStatus(ap.status)
    setTipoEndereco(ap.tipoEndereco)
    setHierarquia(ap.codigoCompleto)
    setErroModal('')
    setModalNivel(true)
  }

  async function aoSalvarNivel(evento: FormEvent) {
    evento.preventDefault()
    const codigoOk = completarCodigoNivelWms(nivelForm, codigo)
    if (!codigoOk) {
      setErroModal('Preencha o código.')
      return
    }
    setSalvando(true)
    setErroModal('')
    try {
      if (nivelForm === 'apartamento') {
        if (editando) {
          await clienteHttp.put(`/enderecos-wms/${idEdicao}`, {
            codigo: codigoOk,
            tipoEndereco,
            status,
          })
        } else {
          await clienteHttp.post('/enderecos-wms', {
            andarId: parentId,
            codigo: codigoOk,
            tipoEndereco,
            status,
          })
        }
        if (parentId) await carregarAps(parentId)
      } else if (editando) {
        await clienteHttp.put(`/estrutura-wms/${idEdicao}`, {
          codigo: codigoOk,
          nome: nome.trim() || codigoOk,
          status,
        })
        await carregar()
      } else {
        await clienteHttp.post('/estrutura-wms', {
          parentId: parentId || undefined,
          nivel: parentId ? undefined : 'local',
          codigo: codigoOk,
          nome: nome.trim() || codigoOk,
          status,
        })
        await carregar()
      }
      setModalNivel(false)
      setMensagem('Registro salvo.')
    } catch (err: unknown) {
      setErroModal(extrairMensagemApi(err, 'Não foi possível salvar.'))
    } finally {
      setSalvando(false)
    }
  }

  async function aoStatusNo(no: ItemEstruturaWms, novo: string) {
    try {
      await clienteHttp.put(`/estrutura-wms/${no.id}`, {
        codigo: no.codigo,
        nome: no.nome,
        status: novo,
      })
      await carregar()
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Não foi possível alterar a situação.'))
    }
  }

  async function aoStatusAp(ap: ApartamentoWms, novo: string) {
    try {
      await clienteHttp.put(`/enderecos-wms/${ap.id}`, {
        codigo: ap.codigo,
        tipoEndereco: ap.tipoEndereco,
        status: novo,
      })
      await carregarAps(ap.andarId)
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Não foi possível alterar a situação.'))
    }
  }

  async function aoMoverNo(id: string, alvoId: string, posicao: 'antes' | 'depois' | 'dentro') {
    try {
      await clienteHttp.patch(`/estrutura-wms/${id}/mover`, { alvoId, posicao })
      await carregar()
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Não foi possível mover.'))
    }
  }

  async function aoMoverAp(id: string, alvoId: string, posicao: 'antes' | 'depois') {
    try {
      await clienteHttp.patch(`/enderecos-wms/${id}/mover`, { alvoId, posicao })
      const ap = Object.values(aps).flat().find((a) => a.id === id)
      if (ap) await carregarAps(ap.andarId)
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Não foi possível mover.'))
    }
  }

  const locais = useMemo(() => arvore.filter((n) => n.nivel === 'local'), [arvore])
  const areas = useMemo(() => {
    if (formGerar.novoLocal) return []
    const local = locais.find((l) => l.id === formGerar.localId)
    return local?.filhos ?? []
  }, [locais, formGerar.localId, formGerar.novoLocal])
  const ruas = useMemo(() => {
    if (formGerar.novaArea) return []
    const area = areas.find((a) => a.id === formGerar.areaId)
    return area?.filhos ?? []
  }, [areas, formGerar.areaId, formGerar.novaArea])

  useEffect(() => {
    if (!modalGerar) return
    if (!cadastroWmsProntoParaPreview(formGerar)) {
      setPreview(null)
      return
    }
    const corpo = corpoGerarEstruturaWms(formGerar)
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await clienteHttp.post('/estrutura-wms/gerar-preview', corpo)
        setPreview({ total: data.total, exemplos: data.exemplos ?? [] })
        setErroModal('')
      } catch (err: unknown) {
        setErroModal(extrairMensagemApi(err, 'Não foi possível calcular a prévia.'))
        setPreview(null)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [modalGerar, formGerar])

  async function aoPreviewGerar(evento: FormEvent) {
    evento.preventDefault()
  }

  async function aoConfirmarGerar() {
    setSalvando(true)
    setErroModal('')
    try {
      const { data } = await clienteHttp.post('/estrutura-wms/gerar', corpoGerarEstruturaWms(formGerar))
      const ids: string[] = data.idsParaExpandir ?? []
      const andares: string[] = data.andarIds ?? []
      setModalGerar(false)
      setPreview(null)
      setMensagem(
        `${data.criados} endereço${data.criados === 1 ? '' : 's'} criado${data.criados === 1 ? '' : 's'}, ${data.pulados} já existiam.`
      )
      setExpandidos(new Set(ids))
      await carregar()
      await Promise.all(andares.map((id) => carregarAps(id)))
    } catch (err: unknown) {
      setErroModal(extrairMensagemApi(err, 'Não foi possível gerar.'))
    } finally {
      setSalvando(false)
    }
  }

  function abrirCadastrarEnderecos() {
    const localRaiz = arvore.find((n) => n.nivel === 'local')
    const inicial: FormGerarWms = { ...FORM_GERAR_WMS_VAZIO, localId: localRaiz?.id ?? '' }
    if (inicial.localId) {
      const primeiraArea = localRaiz?.filhos?.find((f) => f.nivel === 'area') ?? localRaiz?.filhos?.[0]
      if (primeiraArea) inicial.areaId = primeiraArea.id
    } else {
      inicial.novoLocal = true
    }
    setFormGerar(inicial)
    setPreview(null)
    setErroModal('')
    setModalGerar(true)
  }

  return (
    <div className="min-w-0 space-y-6">
      <TituloPagina caminho="Logística > Endereços WMS">Endereços WMS</TituloPagina>
      <p className="text-sm text-muted-foreground">
        Formato: <span className="font-mono">LOCAL-ÁREA-RUA-BLOCO-ANDAR-AP</span> (ex.:{' '}
        <span className="font-mono">A-RC-20-01-2-05</span>). Use <strong>Cadastrar endereços</strong>{' '}
        para um apartamento ou uma faixa. O tipo (PP/CX/CH/BC) fica no apartamento.
      </p>
      {mensagem && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{mensagem}</p>
      )}
      {erro && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
      )}

      <CardPadrao
        titulo="Estrutura do depósito"
        acoes={
          <div className="flex flex-wrap gap-2">
            {podeCriar && (
              <>
                <BotaoPrimario type="button" onClick={abrirCadastrarEnderecos}>
                  <Plus className="mr-1 inline size-4" />
                  Cadastrar endereços
                </BotaoPrimario>
                <Button type="button" variant="outline" onClick={abrirNovoLocal}>
                  Novo local
                </Button>
              </>
            )}
          </div>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <CampoBuscaLista
            rotulo="Buscar"
            nomeCampo="busca-lista-enderecos-wms"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Código, RC, 20-01…"
          />
          <SelectPadrao
            rotulo="Situação"
            valor={filtroStatus}
            aoMudar={(v) => setFiltroStatus(v as typeof filtroStatus)}
            opcoes={[
              { value: 'todos', label: 'Todos' },
              { value: 'ativo', label: 'Ativo' },
              { value: 'bloqueado', label: 'Bloqueado' },
              { value: 'inativo', label: 'Inativo' },
            ]}
          />
        </div>
        {carregando ? (
          <LinhasSkeletonTabela colunas={4} linhas={6} />
        ) : (
          <ArvoreEnderecosWms
            arvore={arvore}
            apartamentosPorAndar={aps}
            busca={busca}
            filtroStatus={filtroStatus}
            podeEditar={podeEditar}
            podeCriar={podeCriar}
            expandidos={expandidos}
            aoAlternarExpansao={aoAlternarExpansao}
            aoEditarNo={aoEditarNo}
            aoEditarAp={aoEditarAp}
            aoNovoFilho={aoNovoFilho}
            aoStatusNo={aoStatusNo}
            aoStatusAp={aoStatusAp}
            aoMoverNo={aoMoverNo}
            aoMoverAp={aoMoverAp}
          />
        )}
      </CardPadrao>

      <ModalNivelWms
        aberto={modalNivel}
        titulo={
          editando
            ? 'Editar'
            : nivelForm === 'apartamento'
              ? 'Novo apartamento'
              : nivelForm === 'local'
                ? 'Novo local'
                : ROTULO_NOVO_FILHO[acharNo(arvore, parentId ?? '')?.nivel ?? 'local'] ?? 'Novo'
        }
        nivel={nivelForm}
        hierarquia={hierarquia}
        codigo={codigo}
        nome={nome}
        status={status}
        tipoEndereco={tipoEndereco}
        salvando={salvando}
        erro={erroModal}
        aoMudarCodigo={setCodigo}
        aoMudarNome={setNome}
        aoMudarStatus={setStatus}
        aoMudarTipo={setTipoEndereco}
        aoFechar={() => setModalNivel(false)}
        aoSalvar={aoSalvarNivel}
      />

      <ModalGerarEstruturaWms
        aberto={modalGerar}
        form={formGerar}
        locais={locais}
        areas={areas}
        ruas={ruas}
        total={preview?.total}
        exemplos={preview?.exemplos}
        salvando={salvando}
        erro={erroModal}
        aoMudar={(f) => {
          setFormGerar(f)
          setPreview(null)
        }}
        aoFechar={() => setModalGerar(false)}
        aoPreview={aoPreviewGerar}
        aoConfirmar={aoConfirmarGerar}
      />
    </div>
  )
}
