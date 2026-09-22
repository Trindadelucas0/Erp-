'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Search } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { usePermissao } from '@/hooks/use-permissao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputPadrao } from '@/components/ui/input-padrao'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import type { AdquirenteLista } from '@/components/cartoes-pagamento/tipos-cartao'

export function PainelAdquirentes() {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('financeiro:create')
  const podeEditar = usePermissao('financeiro:edit')

  const [lista, setLista] = useState<AdquirenteLista[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async (termo?: string) => {
    setCarregando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.get<{ adquirentes: AdquirenteLista[] }>(
        '/adquirentes',
        {
          params: {
            incluirInativos: true,
            ...(termo?.trim() ? { q: termo.trim() } : {}),
          },
        }
      )
      setLista(data.adquirentes ?? [])
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível carregar as adquirentes'))
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
    setAtivo(true)
    setMostrarForm(true)
    setErro('')
    setMensagem('')
  }

  function abrirEdicao(item: AdquirenteLista) {
    setEditandoId(item.id)
    setNome(item.nome)
    setAtivo(item.ativo)
    setMostrarForm(true)
    setErro('')
    setMensagem('')
  }

  function fecharForm() {
    setMostrarForm(false)
    setEditandoId(null)
    setNome('')
  }

  async function salvar() {
    setErro('')
    setMensagem('')
    setSalvando(true)
    try {
      if (editandoId) {
        await clienteHttp.put(`/adquirentes/${editandoId}`, {
          nome: nome.trim(),
          ativo,
        })
        setMensagem('Adquirente atualizada.')
      } else {
        await clienteHttp.post('/adquirentes', {
          nome: nome.trim(),
          ativo,
        })
        setMensagem('Adquirente cadastrada.')
      }
      fecharForm()
      await carregar(busca)
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Erro ao salvar adquirente'))
    } finally {
      setSalvando(false)
    }
  }

  async function alternarAtivo(item: AdquirenteLista) {
    if (!podeEditar) return
    setErro('')
    try {
      await clienteHttp.patch(`/adquirentes/${item.id}/ativo`, { ativo: !item.ativo })
      await carregar(busca)
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Erro ao alterar situação'))
    }
  }

  return (
    <CardPadrao
      titulo="Adquirentes"
      descricao="Cadastre as operadoras (Stone, Cielo, Rede…) usadas nos cartões de pagamento."
      acoes={
        podeCriar ? (
          <BotaoPrimario type="button" onClick={abrirNovo}>
            <Plus className="h-4 w-4" />
            Nova adquirente
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
              placeholder="Buscar adquirente..."
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

        {mostrarForm && (podeCriar || podeEditar) && (
          <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-2">
            <InputPadrao
              rotulo="Nome *"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Stone"
              maxLength={80}
            />
            <div className="flex items-end gap-3 pb-1">
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
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={fecharForm}>
                Cancelar
              </Button>
              <BotaoPrimario
                type="button"
                disabled={salvando || nome.trim().length < 2}
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
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <LinhasSkeletonTabela colunas={3} linhas={4} />
              ) : lista.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                    Nenhuma adquirente cadastrada.
                  </td>
                </tr>
              ) : (
                lista.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{item.nome}</td>
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
                      <div className="flex flex-wrap gap-2">
                        {podeEditar && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => abrirEdicao(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                        )}
                        {podeEditar && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void alternarAtivo(item)}
                          >
                            {item.ativo ? 'Desativar' : 'Ativar'}
                          </Button>
                        )}
                      </div>
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
