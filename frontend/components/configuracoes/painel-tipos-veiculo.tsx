'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Search } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputPadrao } from '@/components/ui/input-padrao'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { IconeTipoVeiculo, OPCOES_ICONE_TIPO_VEICULO } from '@/lib/icones-tipo-veiculo'
import { cn } from '@/lib/utils'

export type TipoVeiculoLista = {
  id: string
  nome: string
  pesoMaximoKg: number
  icone: string | null
  ativo: boolean
}

const formatadorPeso = new Intl.NumberFormat('pt-BR')

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, '').slice(0, 6)
}

type Props = {
  podeAlterar: boolean
}

export function PainelTiposVeiculo({ podeAlterar }: Props) {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()

  const [lista, setLista] = useState<TipoVeiculoLista[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [peso, setPeso] = useState('')
  const [icone, setIcone] = useState<string | null>(null)
  const [ativo, setAtivo] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const pesoNumero = Number(peso)
  const podeSalvar = nome.trim().length >= 2 && Number.isInteger(pesoNumero) && pesoNumero > 0

  const carregar = useCallback(async (termo?: string) => {
    setCarregando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.get<{ tiposVeiculo: TipoVeiculoLista[] }>(
        '/tipos-veiculo',
        {
          params: {
            incluirInativos: true,
            ...(termo?.trim() ? { q: termo.trim() } : {}),
          },
        }
      )
      setLista(data.tiposVeiculo ?? [])
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível carregar os tipos de veículo'))
      setLista([])
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (!estaAutenticado || carregandoSessao) return
    void carregar()
  }, [estaAutenticado, carregandoSessao, carregar])

  function abrirNovo() {
    setEditandoId(null)
    setNome('')
    setPeso('')
    setIcone(null)
    setAtivo(true)
    setMostrarForm(true)
    setErro('')
    setMensagem('')
  }

  function abrirEdicao(item: TipoVeiculoLista) {
    setEditandoId(item.id)
    setNome(item.nome)
    setPeso(String(item.pesoMaximoKg))
    setIcone(item.icone)
    setAtivo(item.ativo)
    setMostrarForm(true)
    setErro('')
    setMensagem('')
  }

  function fecharForm() {
    setMostrarForm(false)
    setEditandoId(null)
    setNome('')
    setPeso('')
    setIcone(null)
  }

  async function salvar() {
    if (!podeSalvar) return
    setErro('')
    setMensagem('')
    setSalvando(true)
    const corpo = { nome: nome.trim(), pesoMaximoKg: pesoNumero, icone, ativo }
    try {
      if (editandoId) {
        await clienteHttp.put(`/tipos-veiculo/${editandoId}`, corpo)
      } else {
        await clienteHttp.post('/tipos-veiculo', corpo)
      }
      setMensagem('Tipo de veículo salvo.')
      fecharForm()
      await carregar(busca)
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Erro ao salvar tipo de veículo'))
    } finally {
      setSalvando(false)
    }
  }

  async function alternarAtivo(item: TipoVeiculoLista) {
    if (!podeAlterar) return
    setErro('')
    setMensagem('')
    try {
      await clienteHttp.patch(`/tipos-veiculo/${item.id}/ativo`, { ativo: !item.ativo })
      await carregar(busca)
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Erro ao alterar situação'))
    }
  }

  return (
    <CardPadrao
      titulo="Tipos de Veículos"
      descricao="Nome, peso máximo e se o tipo pode ser escolhido na transportadora."
      acoes={
        podeAlterar ? (
          <BotaoPrimario type="button" onClick={abrirNovo}>
            <Plus className="h-4 w-4" />
            Novo tipo de veículo
          </BotaoPrimario>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void carregar(busca)
              }}
            />
          </div>
          <Button type="button" variant="outline" onClick={() => void carregar(busca)}>
            Buscar
          </Button>
        </div>

        {mostrarForm && podeAlterar && (
          <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-2">
            <InputPadrao
              rotulo="Nome"
              obrigatorio
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Van, Caminhão 3/4, Carro de Passeio"
              maxLength={80}
            />
            <InputPadrao
              rotulo="Peso máximo (kg)"
              id="peso-maximo-kg"
              obrigatorio
              value={peso}
              onChange={(e) => setPeso(somenteDigitos(e.target.value))}
              placeholder="Ex.: 1500"
              inputMode="numeric"
            />
            <fieldset className="space-y-1.5 sm:col-span-2">
              <legend className="text-sm font-medium">Ícone</legend>
              <div className="flex flex-wrap gap-2">
                {OPCOES_ICONE_TIPO_VEICULO.map(({ chave, rotulo, Icone }) => {
                  const marcado = icone === chave
                  return (
                    <button
                      key={chave}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() => setIcone(marcado ? null : chave)}
                      className={cn(
                        'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                        marcado
                          ? 'border-primary bg-primary/10 font-medium text-primary'
                          : 'border-border hover:bg-muted'
                      )}
                    >
                      <Icone aria-hidden className="h-5 w-5" />
                      {rotulo}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Opcional. Clique no ícone marcado para limpar.
              </p>
            </fieldset>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                Ativo
              </label>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={fecharForm}>
                Cancelar
              </Button>
              <BotaoPrimario
                type="button"
                disabled={salvando || !podeSalvar}
                onClick={() => void salvar()}
              >
                {salvando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </BotaoPrimario>
            </div>
          </div>
        )}

        {mensagem && <p className="text-sm text-green-700 dark:text-green-400">{mensagem}</p>}
        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 text-right font-medium">Peso máximo (kg)</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <LinhasSkeletonTabela colunas={4} linhas={4} />
              ) : lista.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    Nenhum tipo de veículo cadastrado.
                  </td>
                </tr>
              ) : (
                lista.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">
                      <span className="flex items-center gap-2">
                        <IconeTipoVeiculo icone={item.icone} className="h-5 w-5" />
                        {item.nome}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatadorPeso.format(item.pesoMaximoKg)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          item.ativo
                            ? 'text-green-700 dark:text-green-400'
                            : 'text-muted-foreground'
                        }
                      >
                        {item.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {podeAlterar && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => abrirEdicao(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void alternarAtivo(item)}
                          >
                            {item.ativo ? 'Desativar' : 'Ativar'}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </CardPadrao>
  )
}
