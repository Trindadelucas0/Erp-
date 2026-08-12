'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import {
  codigoCfopCompleto,
  inferirCfopDoCodigo,
  prefixoPermiteIcms,
  rotuloExibicaoCfop,
  ROTULOS_SUBTIPO_CFOP,
  SUBTIPOS_CFOP,
  type SubtipoCfop,
} from '@/lib/cfop'
import { usePermissao } from '@/hooks/use-permissao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { CabecalhoCadastroErp } from '@/components/compartilhado/cabecalho-cadastro-erp'
import {
  CampoLookupCatalogo,
  type ItemCatalogo,
} from '@/components/compartilhado/campo-lookup-catalogo'
import {
  ComboboxPlanoFinanceiro,
  type PlanoFinanceiroOpcao,
} from '@/components/contas-a-pagar/combobox-plano-financeiro'
import { SecaoFormularioErp } from '@/components/compartilhado/secao-formulario-erp'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Abas } from '@/components/ui/abas'
import { BadgeStatus } from '@/components/ui/badge-status'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Modal } from '@/components/ui/modal'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Label } from '@/components/ui/label'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CabecalhoColunaOrdenavel } from '@/components/ui/cabecalho-coluna-ordenavel'
import { useOrdenacaoColunas } from '@/hooks/use-ordenacao-colunas'
import { ordenarLista } from '@/lib/ordenacao-lista'

type ColunaCfop = 'codigo' | 'nome' | 'tipo' | 'situacao'

type Cfop = {
  id: string
  codigo: string
  nome: string
  descricao: string
  natureza: string
  abrangencia: string | null
  subtipoCfop: string | null
  aproveitarCreditoIcms: boolean
  ativo: boolean
  planoFinanceiroPadraoId?: string | null
  planoFinanceiroPadrao?: ItemCatalogo | null
}

const formVazio = {
  codigo: '',
  nome: '',
  descricao: '',
  subtipoCfop: null as SubtipoCfop | null,
  aproveitarCreditoIcms: false,
  ativo: true,
  cfopSugestaoEntrada: null as ItemCatalogo | null,
  planoFinanceiroPadraoId: '',
}

export function ConteudoDaPaginaCfops() {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('financeiro:create')
  const podeEditar = usePermissao('financeiro:edit')

  const [lista, setLista] = useState<Cfop[]>([])
  const [carregandoLista, setCarregandoLista] = useState(true)
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [idEmEdicao, setIdEmEdicao] = useState('')
  const [form, setForm] = useState(formVazio)
  const [abaAtiva, setAbaAtiva] = useState('dados')
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [planosFinanceiros, setPlanosFinanceiros] = useState<PlanoFinanceiroOpcao[]>([])
  const { ordenacao, alternarOrdenacao } = useOrdenacaoColunas<ColunaCfop>()

  const classificacaoAtual = useMemo(
    () => inferirCfopDoCodigo(form.codigo),
    [form.codigo]
  )

  const cfopEhSaida = classificacaoAtual?.tipo === 'saida'

  useEffect(() => {
    const timer = setTimeout(() => setBuscaDebounced(busca), 300)
    return () => clearTimeout(timer)
  }, [busca])

  const carregar = useCallback(async () => {
    setCarregandoLista(true)
    try {
      const params = new URLSearchParams({ incluirInativos: 'true' })
      if (buscaDebounced.trim()) params.set('q', buscaDebounced.trim())
      const { data } = await clienteHttp.get(`/cfops?${params}`)
      setLista(data.cfops ?? [])
      setErro('')
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao carregar CFOPs.'))
    } finally {
      setCarregandoLista(false)
    }
  }, [buscaDebounced])

  const carregarPlanosFinanceiros = useCallback(async () => {
    try {
      const { data } = await clienteHttp.get('/planos-financeiros', {
        params: { tipo: 'despesa', somenteSubgrupo: 'true' },
      })
      const listaPlanos = data.planos ?? data ?? []
      setPlanosFinanceiros(
        (Array.isArray(listaPlanos) ? listaPlanos : []).map(
          (p: { id: string; nome?: string; descricao?: string; codigo: string }) => ({
            id: p.id,
            nome: p.nome ?? p.descricao ?? p.codigo,
            codigo: p.codigo,
          })
        )
      )
    } catch {
      setPlanosFinanceiros([])
    }
  }, [])

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado) return
    carregar()
    carregarPlanosFinanceiros()
  }, [carregandoSessao, estaAutenticado, carregar, carregarPlanosFinanceiros])

  function abrirNovo() {
    setForm(formVazio)
    setModoEdicao(false)
    setIdEmEdicao('')
    setAbaAtiva('dados')
    setErro('')
    setModalAberto(true)
  }

  async function abrirEdicao(cfop: Cfop) {
    try {
      const { data } = await clienteHttp.get(`/cfops/${cfop.id}`)
      const c = data.cfop
      const planoPadrao = c.planoFinanceiroPadrao as
        | { id: string; codigo?: string; descricao?: string; nome?: string }
        | null
        | undefined
      const planoId = planoPadrao?.id ?? c.planoFinanceiroPadraoId ?? ''
      if (planoPadrao?.id) {
        setPlanosFinanceiros((atuais) => {
          if (atuais.some((p) => p.id === planoPadrao.id)) return atuais
          return [
            {
              id: planoPadrao.id,
              codigo: planoPadrao.codigo,
              nome: planoPadrao.nome ?? planoPadrao.descricao ?? planoPadrao.codigo ?? '',
            },
            ...atuais,
          ]
        })
      }
      setForm({
        codigo: c.codigo,
        nome: c.nome,
        descricao: c.descricao,
        subtipoCfop: (c.subtipoCfop as SubtipoCfop | null) ?? null,
        aproveitarCreditoIcms: c.aproveitarCreditoIcms ?? false,
        ativo: c.ativo,
        cfopSugestaoEntrada: c.cfopSugestaoEntrada ?? null,
        planoFinanceiroPadraoId: planoId,
      })
      setModoEdicao(true)
      setIdEmEdicao(c.id)
      setAbaAtiva('dados')
      setErro('')
      setModalAberto(true)
    } catch {
      setErro('Erro ao carregar CFOP.')
    }
  }

  function aoMudarSubtipo(subtipo: SubtipoCfop, marcado: boolean) {
    setForm((f) => ({
      ...f,
      subtipoCfop: marcado ? subtipo : null,
    }))
  }

  async function aoSalvar(e?: FormEvent) {
    e?.preventDefault()
    setSalvando(true)
    setErro('')
    try {
      const payload = {
        nome: form.nome,
        descricao: form.descricao,
        subtipoCfop: form.subtipoCfop,
        aproveitarCreditoIcms: form.aproveitarCreditoIcms,
        cfopSugestaoEntradaId: cfopEhSaida ? form.cfopSugestaoEntrada?.id ?? null : null,
        planoFinanceiroPadraoId: !cfopEhSaida ? form.planoFinanceiroPadraoId || null : null,
      }

      if (modoEdicao) {
        await clienteHttp.put(`/cfops/${idEmEdicao}`, payload)
        setMensagem('CFOP atualizado.')
      } else {
        if (!codigoCfopCompleto(form.codigo)) {
          setErro(
            'Código deve ter 4 dígitos no formato X.XXX, começando com 1, 2, 3, 5, 6 ou 7 (ex.: 5.201)'
          )
          setSalvando(false)
          return
        }
        await clienteHttp.post('/cfops', {
          codigo: form.codigo,
          ...payload,
        })
        setMensagem('CFOP criado.')
      }
      setModalAberto(false)
      await carregar()
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao salvar CFOP'))
    } finally {
      setSalvando(false)
    }
  }

  const listaExibida = useMemo(
    () =>
      ordenarLista(lista, ordenacao, (cfop, coluna) => {
        switch (coluna) {
          case 'codigo':
            return cfop.codigo
          case 'nome':
            return cfop.nome
          case 'tipo':
            return rotuloExibicaoCfop(cfop.natureza, cfop.abrangencia, cfop.subtipoCfop)
          case 'situacao':
            return cfop.ativo ? 'Ativo' : 'Inativo'
        }
      }),
    [lista, ordenacao]
  )

  const podeSalvar = modoEdicao ? podeEditar : podeCriar

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Fiscal &gt; CFOP</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Cadastro de CFOP</h1>
      </div>

      {mensagem && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{mensagem}</p>
      )}
      {erro && !modalAberto && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
      )}

      <CardPadrao
        titulo="CFOPs"
        acoes={
          podeCriar && (
            <BotaoPrimario type="button" onClick={abrirNovo}>
              <Plus className="mr-1 size-4 inline" />
              Novo CFOP
            </BotaoPrimario>
          )
        }
      >
        <div className="mb-4 max-w-sm">
          <InputPadrao
            rotulo="Buscar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Código ou nome..."
          />
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[38%]" />
              <col className="w-[32%]" />
              <col className="w-[12%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Código" coluna="codigo" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Nome" coluna="nome" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Tipo" coluna="tipo" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Situação" coluna="situacao" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {carregandoLista && <LinhasSkeletonTabela colunas={5} />}
              {!carregandoLista && listaExibida.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum CFOP encontrado.
                  </td>
                </tr>
              )}
              {!carregandoLista &&
                listaExibida.map((cfop) => {
                  const rotuloTipo = rotuloExibicaoCfop(
                    cfop.natureza,
                    cfop.abrangencia,
                    cfop.subtipoCfop
                  )
                  return (
                    <tr key={cfop.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium font-mono">{cfop.codigo}</td>
                      <td className="max-w-0 truncate px-4 py-3" title={cfop.nome}>
                        {cfop.nome}
                      </td>
                      <td className="max-w-0 truncate px-4 py-3 text-muted-foreground" title={rotuloTipo}>
                        {rotuloTipo}
                      </td>
                      <td className="px-4 py-3">
                        <BadgeStatus variante={cfop.ativo ? 'ativo' : 'reprovado'}>
                          {cfop.ativo ? 'Ativo' : 'Inativo'}
                        </BadgeStatus>
                      </td>
                      <td className="px-2 py-3">
                        {podeEditar && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => abrirEdicao(cfop)}>
                            Editar
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </CardPadrao>

      <Modal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        titulo={modoEdicao ? 'Editar CFOP' : 'Novo CFOP'}
        largura="2xl"
        rodape={
          <div className="flex justify-end gap-2">
            <BotaoPrimario
              type="submit"
              form="form-cfop"
              disabled={salvando || !podeSalvar}
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </BotaoPrimario>
          </div>
        }
      >
        <form id="form-cfop" onSubmit={aoSalvar} className="space-y-5">
          {erro && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
          )}

          <CabecalhoCadastroErp
            codigo={form.codigo}
            nome={form.nome}
            ativo={form.ativo}
            codigoReadonly={modoEdicao}
            aoMudarCodigo={(v) => {
              const classificacao = inferirCfopDoCodigo(v)
              setForm((f) => ({
                ...f,
                codigo: v,
                aproveitarCreditoIcms: prefixoPermiteIcms(v) ? f.aproveitarCreditoIcms : false,
                cfopSugestaoEntrada:
                  classificacao?.tipo === 'saida' ? f.cfopSugestaoEntrada : null,
                planoFinanceiroPadraoId:
                  classificacao?.tipo === 'saida' ? '' : f.planoFinanceiroPadraoId,
              }))
            }}
            aoMudarNome={(v) => setForm((f) => ({ ...f, nome: v }))}
            aoMudarAtivo={(v) => setForm((f) => ({ ...f, ativo: v }))}
            ocultarAtivo
            disabled={salvando}
          />

          <Abas
            abas={[{ id: 'dados', rotulo: 'Dados principais' }]}
            abaAtiva={abaAtiva}
            aoMudar={setAbaAtiva}
          />

          {abaAtiva === 'dados' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="cfop-descricao">Descrição</Label>
                <textarea
                  id="cfop-descricao"
                  className="min-h-[120px] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  disabled={salvando}
                  placeholder="Descrição do CFOP..."
                />
              </div>

              <SecaoFormularioErp titulo="Classificação">
                {classificacaoAtual ? (
                  <p className="inline-flex rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
                    {classificacaoAtual.rotulo}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Informe o código para ver a classificação automática.
                  </p>
                )}
              </SecaoFormularioErp>

              {cfopEhSaida && (
                <CampoLookupCatalogo
                  rotulo="CFOP de sugestão na entrada de notas"
                  endpoint="/cfops"
                  queryParams="tipo=entrada"
                  valor={form.cfopSugestaoEntrada}
                  aoSelecionar={(v) => setForm((f) => ({ ...f, cfopSugestaoEntrada: v }))}
                  disabled={salvando}
                />
              )}

              {!cfopEhSaida && classificacaoAtual ? (
                <SecaoFormularioErp titulo="Financeiro">
                  <p className="mb-3 text-xs text-muted-foreground">
                    Plano aplicado automaticamente ao gerar Contas a Pagar na Entrada de Notas,
                    conforme o CFOP de entrada prevalente dos itens (maior valor na NF).
                  </p>
                  <ComboboxPlanoFinanceiro
                    rotulo="Plano financeiro padrão"
                    planos={planosFinanceiros}
                    valor={form.planoFinanceiroPadraoId}
                    aoMudar={(planoId) =>
                      setForm((f) => ({ ...f, planoFinanceiroPadraoId: planoId }))
                    }
                    disabled={salvando}
                    permitirVazio
                    obrigatorio={false}
                  />
                </SecaoFormularioErp>
              ) : null}

              <SecaoFormularioErp titulo="Características opcionais">
                <p className="mb-3 text-xs text-muted-foreground">
                  Marque no máximo uma característica, se aplicável.
                </p>
                <div className="space-y-3">
                  {SUBTIPOS_CFOP.map((subtipo) => (
                    <div key={subtipo} className="flex items-start gap-2">
                      <Checkbox
                        id={`cfop-subtipo-${subtipo}`}
                        checked={form.subtipoCfop === subtipo}
                        onCheckedChange={(checked) =>
                          aoMudarSubtipo(subtipo, checked === true)
                        }
                        disabled={salvando}
                      />
                      <Label
                        htmlFor={`cfop-subtipo-${subtipo}`}
                        className="cursor-pointer text-sm font-medium leading-snug"
                      >
                        {ROTULOS_SUBTIPO_CFOP[subtipo]}
                      </Label>
                    </div>
                  ))}
                </div>
              </SecaoFormularioErp>

              {prefixoPermiteIcms(form.codigo) && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="cfop-aproveitar-credito-icms"
                    checked={form.aproveitarCreditoIcms}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({
                        ...f,
                        aproveitarCreditoIcms: checked === true,
                      }))
                    }
                    disabled={salvando}
                  />
                  <Label
                    htmlFor="cfop-aproveitar-credito-icms"
                    className="cursor-pointer text-sm font-medium leading-snug"
                  >
                    Aproveitar crédito de ICMS na apuração e custo da entrada
                  </Label>
                </div>
              )}
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}
