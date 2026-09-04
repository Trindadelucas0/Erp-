'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Modal } from '@/components/ui/modal'
import { InputPadrao } from '@/components/ui/input-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { Label } from '@/components/ui/label'
import { BadgeStatus } from '@/components/ui/badge-status'
import { CabecalhoColunaOrdenavel } from '@/components/ui/cabecalho-coluna-ordenavel'
import { useOrdenacaoColunas } from '@/hooks/use-ordenacao-colunas'
import { ordenarLista } from '@/lib/ordenacao-lista'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { atributosCampoBuscaLista } from '@/lib/atributos-campo-busca-lista'
import {
  completarDoisDigitos,
  LOCAIS_WMS,
  mascaraRuaOuPosicao,
  montarCodigoEnderecoWms,
  ROTULOS_LOCAL_WMS,
  rotuloAreaWms,
  rotuloLocalWms,
  rotuloTipoWms,
} from '@/lib/endereco-wms'
import {
  mapaNomesNivel,
  opcoesSelectNivel,
  type ItemEstruturaWms,
} from '@/lib/estrutura-wms'

type ColunaEndereco = 'codigo' | 'local' | 'area' | 'tipo' | 'rua' | 'andar' | 'posicao' | 'situacao'

type EnderecoWms = {
  id: string
  codigo: string
  local: string
  area: string
  tipo: string
  rua: string
  andar: string
  posicao: string
  ativo: boolean
}

const formVazio = {
  local: '',
  area: '',
  tipo: '',
  rua: '',
  andar: '',
  posicao: '',
  ativo: true,
}

const opcoesLocal = LOCAIS_WMS.map((c) => ({
  value: c,
  label: `${c} — ${ROTULOS_LOCAL_WMS[c]}`,
}))

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

  const [lista, setLista] = useState<EnderecoWms[]>([])
  const [niveis, setNiveis] = useState<ItemEstruturaWms[]>([])
  const [carregandoLista, setCarregandoLista] = useState(true)
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [filtroLocal, setFiltroLocal] = useState('')
  const [filtroArea, setFiltroArea] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [incluirInativos, setIncluirInativos] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [idEmEdicao, setIdEmEdicao] = useState('')
  const [form, setForm] = useState(formVazio)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const { ordenacao, alternarOrdenacao } = useOrdenacaoColunas<ColunaEndereco>()

  useEffect(() => {
    const timer = setTimeout(() => setBuscaDebounced(busca), 300)
    return () => clearTimeout(timer)
  }, [busca])

  const carregarNiveis = useCallback(async () => {
    try {
      const { data } = await clienteHttp.get('/estrutura-wms?incluirInativos=true')
      setNiveis(data.niveis ?? [])
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao carregar a estrutura WMS.'))
    }
  }, [])

  const carregar = useCallback(async () => {
    setCarregandoLista(true)
    try {
      const params = new URLSearchParams()
      if (incluirInativos) params.set('incluirInativos', 'true')
      if (buscaDebounced.trim()) params.set('q', buscaDebounced.trim())
      if (filtroLocal) params.set('local', filtroLocal)
      if (filtroArea) params.set('area', filtroArea)
      if (filtroTipo) params.set('tipo', filtroTipo)
      const { data } = await clienteHttp.get(`/enderecos-wms?${params}`)
      setLista(data.enderecos ?? [])
      setErro('')
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao carregar endereços WMS.'))
    } finally {
      setCarregandoLista(false)
    }
  }, [buscaDebounced, filtroLocal, filtroArea, filtroTipo, incluirInativos])

  useEffect(() => {
    if (!estaAutenticado || carregandoSessao) return
    void carregarNiveis()
  }, [estaAutenticado, carregandoSessao, carregarNiveis])

  useEffect(() => {
    if (!estaAutenticado || carregandoSessao) return
    void carregar()
  }, [estaAutenticado, carregandoSessao, carregar])

  function abrirNovo() {
    setModoEdicao(false)
    setIdEmEdicao('')
    setForm(formVazio)
    setErro('')
    setModalAberto(true)
  }

  function abrirEdicao(item: EnderecoWms) {
    setModoEdicao(true)
    setIdEmEdicao(item.id)
    setForm({
      local: item.local,
      area: item.area,
      tipo: item.tipo,
      rua: item.rua,
      andar: item.andar,
      posicao: item.posicao,
      ativo: item.ativo,
    })
    setErro('')
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setErro('')
  }

  const codigoPreview = useMemo(() => montarCodigoEnderecoWms(form), [form])

  async function aoSalvar(evento: FormEvent) {
    evento.preventDefault()
    if (!codigoPreview) {
      setErro('Preencha Local, Área, Tipo, Rua, Andar e Posição no padrão A-RC-CH-20-2-05.')
      return
    }
    setSalvando(true)
    setErro('')
    const payload = {
      local: form.local,
      area: form.area,
      tipo: form.tipo,
      rua: form.rua,
      andar: form.andar,
      posicao: completarDoisDigitos(form.posicao),
      ativo: form.ativo,
    }
    try {
      if (modoEdicao) {
        await clienteHttp.put(`/enderecos-wms/${idEmEdicao}`, payload)
        setMensagem('Endereço atualizado.')
      } else {
        await clienteHttp.post('/enderecos-wms', payload)
        setMensagem('Endereço criado.')
      }
      fecharModal()
      await carregar()
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao salvar endereço WMS'))
    } finally {
      setSalvando(false)
    }
  }

  const nomesArea = useMemo(() => mapaNomesNivel(niveis, 'area'), [niveis])
  const nomesTipo = useMemo(() => mapaNomesNivel(niveis, 'tipo'), [niveis])
  const opcoesFiltroArea = useMemo(
    () => opcoesSelectNivel(niveis, 'area', { incluirInativos: true }),
    [niveis]
  )
  const opcoesFiltroTipo = useMemo(
    () => opcoesSelectNivel(niveis, 'tipo', { incluirInativos: true }),
    [niveis]
  )
  const opcoesFormArea = useMemo(
    () => opcoesSelectNivel(niveis, 'area', { codigoAtual: form.area }),
    [niveis, form.area]
  )
  const opcoesFormTipo = useMemo(
    () => opcoesSelectNivel(niveis, 'tipo', { codigoAtual: form.tipo }),
    [niveis, form.tipo]
  )
  const opcoesFormRua = useMemo(
    () => opcoesSelectNivel(niveis, 'rua', { codigoAtual: form.rua }),
    [niveis, form.rua]
  )
  const opcoesFormAndar = useMemo(
    () => opcoesSelectNivel(niveis, 'andar', { codigoAtual: form.andar }),
    [niveis, form.andar]
  )

  const listaExibida = useMemo(
    () =>
      ordenarLista(lista, ordenacao, (item, coluna) => {
        switch (coluna) {
          case 'codigo':
            return item.codigo
          case 'local':
            return rotuloLocalWms(item.local)
          case 'area':
            return rotuloAreaWms(item.area, nomesArea)
          case 'tipo':
            return rotuloTipoWms(item.tipo, nomesTipo)
          case 'rua':
            return item.rua
          case 'andar':
            return item.andar
          case 'posicao':
            return item.posicao
          case 'situacao':
            return item.ativo ? 'Ativo' : 'Inativo'
        }
      }),
    [lista, ordenacao, nomesArea, nomesTipo]
  )

  const podeSalvar = modoEdicao ? podeEditar : podeCriar

  return (
    <div className="min-w-0 space-y-6">
      <TituloPagina caminho="Estoque > Endereços WMS">Endereços WMS</TituloPagina>

      {mensagem && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{mensagem}</p>
      )}
      {erro && !modalAberto && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
      )}

      <CardPadrao
        titulo="Endereços do depósito"
        acoes={
          podeCriar && (
            <BotaoPrimario type="button" onClick={abrirNovo}>
              <Plus className="mr-1 inline size-4" />
              Novo endereço
            </BotaoPrimario>
          )
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <InputPadrao
            rotulo="Buscar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Código, RC, recebimento…"
            {...atributosCampoBuscaLista('busca-lista-enderecos-wms')}
          />
          <SelectPadrao
            rotulo="Local"
            valor={filtroLocal}
            aoMudar={setFiltroLocal}
            opcoes={opcoesLocal}
            placeholder="Todos"
          />
          <SelectPadrao
            rotulo="Área"
            valor={filtroArea}
            aoMudar={setFiltroArea}
            opcoes={opcoesFiltroArea}
            placeholder="Todas"
          />
          <SelectPadrao
            rotulo="Tipo"
            valor={filtroTipo}
            aoMudar={setFiltroTipo}
            opcoes={opcoesFiltroTipo}
            placeholder="Todos"
          />
          <div className="flex items-end pb-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="incluir-inativos-wms"
                checked={incluirInativos}
                onCheckedChange={(checked) => setIncluirInativos(checked === true)}
              />
              <Label htmlFor="incluir-inativos-wms" className="cursor-pointer font-medium">
                Incluir inativos
              </Label>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Código" coluna="codigo" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Local" coluna="local" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Área" coluna="area" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Tipo" coluna="tipo" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Rua" coluna="rua" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Andar" coluna="andar" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Posição" coluna="posicao" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Situação" coluna="situacao" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {carregandoLista && <LinhasSkeletonTabela colunas={9} />}
              {!carregandoLista && listaExibida.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum endereço cadastrado.
                  </td>
                </tr>
              )}
              {!carregandoLista &&
                listaExibida.map((item) => (
                  <tr key={item.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono font-medium">{item.codigo}</td>
                    <td className="px-4 py-3" title={rotuloLocalWms(item.local)}>
                      {item.local}
                    </td>
                    <td className="px-4 py-3" title={rotuloAreaWms(item.area, nomesArea)}>
                      {item.area}
                    </td>
                    <td className="px-4 py-3" title={rotuloTipoWms(item.tipo, nomesTipo)}>
                      {item.tipo}
                    </td>
                    <td className="px-4 py-3 font-mono">{item.rua}</td>
                    <td className="px-4 py-3 font-mono">{item.andar}</td>
                    <td className="px-4 py-3 font-mono">{item.posicao}</td>
                    <td className="px-4 py-3">
                      <BadgeStatus variante={item.ativo ? 'ativo' : 'inativo'}>
                        {item.ativo ? 'Ativo' : 'Inativo'}
                      </BadgeStatus>
                    </td>
                    <td className="px-2 py-3">
                      {podeEditar && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => abrirEdicao(item)}>
                          Editar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </CardPadrao>

      <Modal
        aberto={modalAberto}
        aoFechar={fecharModal}
        titulo={modoEdicao ? 'Editar endereço WMS' : 'Novo endereço WMS'}
        largura="2xl"
        rodape={
          <div className="flex justify-end gap-2">
            <BotaoPrimario type="submit" form="form-endereco-wms" disabled={salvando || !podeSalvar}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </BotaoPrimario>
          </div>
        }
      >
        <form id="form-endereco-wms" onSubmit={aoSalvar} className="space-y-5">
          {erro && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
          )}

          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Código (montado automaticamente)</p>
            <p className="font-mono text-lg font-semibold tracking-wide">
              {codigoPreview ?? 'A-RC-CH-20-2-05'}
            </p>
            {!codigoPreview && (
              <p className="mt-1 text-xs text-muted-foreground">
                Escolha os seis campos. O código não é digitado.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SelectPadrao
              rotulo="Local"
              valor={form.local}
              aoMudar={(v) => setForm((f) => ({ ...f, local: v }))}
              opcoes={opcoesLocal}
              placeholder="Selecione"
              obrigatorio
              disabled={salvando}
            />
            <SelectPadrao
              rotulo="Área"
              valor={form.area}
              aoMudar={(v) => setForm((f) => ({ ...f, area: v }))}
              opcoes={opcoesFormArea}
              placeholder="Selecione"
              obrigatorio
              disabled={salvando}
            />
            <SelectPadrao
              rotulo="Tipo de endereço"
              valor={form.tipo}
              aoMudar={(v) => setForm((f) => ({ ...f, tipo: v }))}
              opcoes={opcoesFormTipo}
              placeholder="Selecione"
              obrigatorio
              disabled={salvando}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <SelectPadrao
                rotulo="Rua"
                valor={form.rua}
                aoMudar={(v) => setForm((f) => ({ ...f, rua: v }))}
                opcoes={opcoesFormRua}
                placeholder="Selecione"
                obrigatorio
                disabled={salvando}
              />
              {opcoesFormRua.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Cadastre ruas em{' '}
                  <Link href="/estrutura-wms" className="underline underline-offset-2">
                    Estrutura WMS
                  </Link>
                  .
                </p>
              )}
            </div>
            <div className="space-y-1">
              <SelectPadrao
                rotulo="Andar"
                valor={form.andar}
                aoMudar={(v) => setForm((f) => ({ ...f, andar: v }))}
                opcoes={opcoesFormAndar}
                placeholder="Selecione"
                obrigatorio
                disabled={salvando}
              />
              {opcoesFormAndar.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Cadastre andares em{' '}
                  <Link href="/estrutura-wms" className="underline underline-offset-2">
                    Estrutura WMS
                  </Link>
                  .
                </p>
              )}
            </div>
            <InputPadrao
              rotulo="Posição"
              obrigatorio
              value={form.posicao}
              onChange={(e) =>
                setForm((f) => ({ ...f, posicao: mascaraRuaOuPosicao(e.target.value) }))
              }
              onBlur={() => setForm((f) => ({ ...f, posicao: completarDoisDigitos(f.posicao) }))}
              disabled={salvando}
              inputMode="numeric"
              maxLength={2}
              placeholder="05"
              className="font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="endereco-wms-ativo"
              checked={form.ativo}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, ativo: checked === true }))}
              disabled={salvando || (modoEdicao ? !podeEditar : !podeCriar)}
            />
            <Label htmlFor="endereco-wms-ativo" className="cursor-pointer font-medium">
              Ativo
            </Label>
          </div>
        </form>
      </Modal>
    </div>
  )
}
