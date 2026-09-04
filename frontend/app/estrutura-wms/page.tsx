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
import { Checkbox } from '@/components/ui/checkbox'
import { Modal } from '@/components/ui/modal'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Label } from '@/components/ui/label'
import { BadgeStatus } from '@/components/ui/badge-status'
import { Abas } from '@/components/ui/abas'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  completarCodigoNivelWms,
  mascaraCodigoNivelWms,
  NIVEIS_ESTRUTURA_WMS,
  ROTULOS_NIVEL_ESTRUTURA_WMS,
  type ItemEstruturaWms,
  type NivelEstruturaWms,
} from '@/lib/estrutura-wms'

const ROTULOS_NOVO: Record<NivelEstruturaWms, string> = {
  area: 'Nova área',
  tipo: 'Novo tipo de endereço',
  rua: 'Nova rua',
  andar: 'Novo andar',
}

const ABAS = NIVEIS_ESTRUTURA_WMS.map((id) => ({
  id,
  rotulo: ROTULOS_NIVEL_ESTRUTURA_WMS[id],
}))

const formVazio = {
  codigo: '',
  nome: '',
  ativo: true,
}

export default function PaginaEstruturaWms() {
  return (
    <ProtegerRota chaveDaPagina="estrutura-wms">
      <ConteudoEstruturaWms />
    </ProtegerRota>
  )
}

function ConteudoEstruturaWms() {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('estoque:create')
  const podeEditar = usePermissao('estoque:edit')

  const [aba, setAba] = useState<NivelEstruturaWms>('area')
  const [lista, setLista] = useState<ItemEstruturaWms[]>([])
  const [carregandoLista, setCarregandoLista] = useState(true)
  const [incluirInativos, setIncluirInativos] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [idEmEdicao, setIdEmEdicao] = useState('')
  const [form, setForm] = useState(formVazio)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setCarregandoLista(true)
    try {
      const params = new URLSearchParams()
      params.set('nivel', aba)
      if (incluirInativos) params.set('incluirInativos', 'true')
      const { data } = await clienteHttp.get(`/estrutura-wms?${params}`)
      setLista(data.niveis ?? [])
      setErro('')
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao carregar a estrutura WMS.'))
    } finally {
      setCarregandoLista(false)
    }
  }, [aba, incluirInativos])

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

  function abrirEdicao(item: ItemEstruturaWms) {
    setModoEdicao(true)
    setIdEmEdicao(item.id)
    setForm({
      codigo: item.codigo,
      nome: item.nome,
      ativo: item.ativo,
    })
    setErro('')
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setErro('')
  }

  async function aoSalvar(evento: FormEvent) {
    evento.preventDefault()
    const codigo = completarCodigoNivelWms(aba, form.codigo)
    if (!codigo) {
      setErro('Preencha o código no padrão do nível.')
      return
    }
    setSalvando(true)
    setErro('')
    const payload = {
      codigo,
      nome: form.nome.trim() || codigo,
      ativo: form.ativo,
    }
    try {
      if (modoEdicao) {
        await clienteHttp.put(`/estrutura-wms/${idEmEdicao}`, payload)
        setMensagem(`${ROTULOS_NIVEL_ESTRUTURA_WMS[aba]} atualizado.`)
      } else {
        await clienteHttp.post('/estrutura-wms', { ...payload, nivel: aba })
        setMensagem(`${ROTULOS_NIVEL_ESTRUTURA_WMS[aba]} criado.`)
      }
      fecharModal()
      await carregar()
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao salvar a estrutura WMS'))
    } finally {
      setSalvando(false)
    }
  }

  const rotuloNivel = ROTULOS_NIVEL_ESTRUTURA_WMS[aba]
  const podeSalvar = modoEdicao ? podeEditar : podeCriar
  const placeholderCodigo =
    aba === 'area' || aba === 'tipo' ? 'RC' : aba === 'rua' ? '01' : '0'
  const maxLengthCodigo = aba === 'andar' ? 1 : 2
  const inputModeCodigo = aba === 'area' || aba === 'tipo' ? 'text' : 'numeric'

  return (
    <div className="min-w-0 space-y-6">
      <TituloPagina caminho="Estoque > Estrutura WMS">Estrutura WMS</TituloPagina>

      {mensagem && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{mensagem}</p>
      )}
      {erro && !modalAberto && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
      )}

      <CardPadrao
        titulo="Níveis do depósito"
        descricao="Cadastre o que existe de verdade. No endereço só se escolhe o que estiver aqui."
        acoes={
          podeCriar && (
            <BotaoPrimario type="button" onClick={abrirNovo}>
              <Plus className="mr-1 inline size-4" />
              {ROTULOS_NOVO[aba]}
            </BotaoPrimario>
          )
        }
      >
        <Abas
          abas={ABAS}
          abaAtiva={aba}
          aoMudar={(id) => setAba(id as NivelEstruturaWms)}
          className="mb-4"
        />

        <div className="mb-4 flex items-end pb-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id="incluir-inativos-estrutura-wms"
              checked={incluirInativos}
              onCheckedChange={(checked) => setIncluirInativos(checked === true)}
            />
            <Label htmlFor="incluir-inativos-estrutura-wms" className="cursor-pointer font-medium">
              Incluir inativos
            </Label>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {carregandoLista && <LinhasSkeletonTabela colunas={4} />}
              {!carregandoLista && lista.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum {rotuloNivel.toLowerCase()} cadastrado.
                  </td>
                </tr>
              )}
              {!carregandoLista &&
                lista.map((item) => (
                  <tr key={item.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono font-medium">{item.codigo}</td>
                    <td className="px-4 py-3">{item.nome}</td>
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
        titulo={modoEdicao ? `Editar ${rotuloNivel.toLowerCase()}` : ROTULOS_NOVO[aba]}
        largura="md"
        rodape={
          <div className="flex justify-end gap-2">
            <BotaoPrimario type="submit" form="form-estrutura-wms" disabled={salvando || !podeSalvar}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </BotaoPrimario>
          </div>
        }
      >
        <form id="form-estrutura-wms" onSubmit={aoSalvar} className="space-y-5">
          {erro && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
          )}

          <InputPadrao
            rotulo="Código"
            obrigatorio
            value={form.codigo}
            onChange={(e) =>
              setForm((f) => ({ ...f, codigo: mascaraCodigoNivelWms(aba, e.target.value) }))
            }
            onBlur={() =>
              setForm((f) => ({ ...f, codigo: completarCodigoNivelWms(aba, f.codigo) }))
            }
            disabled={salvando}
            inputMode={inputModeCodigo}
            maxLength={maxLengthCodigo}
            placeholder={placeholderCodigo}
            className="font-mono"
          />
          <InputPadrao
            rotulo="Nome"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            disabled={salvando}
            placeholder={
              aba === 'rua' || aba === 'andar' ? 'Opcional — usa o código se vazio' : 'Recebimento'
            }
          />

          <div className="flex items-center gap-2">
            <Checkbox
              id="estrutura-wms-ativo"
              checked={form.ativo}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, ativo: checked === true }))}
              disabled={salvando || (modoEdicao ? !podeEditar : !podeCriar)}
            />
            <Label htmlFor="estrutura-wms-ativo" className="cursor-pointer font-medium">
              Ativo
            </Label>
          </div>
        </form>
      </Modal>
    </div>
  )
}
