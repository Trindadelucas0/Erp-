'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Search, Star } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { usePermissao } from '@/hooks/use-permissao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  rotuloAmbienteParametro,
  rotuloBancoParametro,
  type ParametroBoletoListaItem,
} from '@/lib/parametros-boleto'
import { FormularioParametrosBoleto } from './formulario-parametros-boleto'

export function PainelParametrosBoleto() {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('financeiro:create')
  const podeEditar = usePermissao('financeiro:edit')

  const [lista, setLista] = useState<ParametroBoletoListaItem[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [modoForm, setModoForm] = useState(false)
  const [registroEmEdicaoId, setRegistroEmEdicaoId] = useState<string | null>(null)

  const carregar = useCallback(async (termo?: string) => {
    setCarregando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.get<{ parametros: ParametroBoletoListaItem[] }>(
        '/parametros-boleto',
        {
          params: {
            incluirInativos: true,
            ...(termo?.trim() ? { q: termo.trim() } : {}),
          },
        }
      )
      setLista(data.parametros ?? [])
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível carregar os parâmetros de boleto.'))
      setLista([])
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (!estaAutenticado || carregandoSessao) return
    void carregar()
  }, [estaAutenticado, carregandoSessao, carregar])

  const temPadrao = useMemo(() => lista.some((p) => p.padrao && p.ativo), [lista])

  function abrirNovo() {
    setRegistroEmEdicaoId(null)
    setModoForm(true)
    setMensagem('')
    setErro('')
  }

  function abrirEdicao(item: ParametroBoletoListaItem) {
    setRegistroEmEdicaoId(item.id)
    setModoForm(true)
    setMensagem('')
    setErro('')
  }

  function fecharForm() {
    setModoForm(false)
    setRegistroEmEdicaoId(null)
  }

  async function aposSalvar() {
    setMensagem(registroEmEdicaoId ? 'Parâmetro atualizado.' : 'Parâmetro cadastrado.')
    fecharForm()
    await carregar(busca)
  }

  async function alternarAtivo(item: ParametroBoletoListaItem) {
    if (!podeEditar) return
    setErro('')
    setMensagem('')
    try {
      await clienteHttp.patch(`/parametros-boleto/${item.id}/ativo`, {
        ativo: !item.ativo,
      })
      await carregar(busca)
      if (item.padrao && item.ativo) {
        setMensagem('Parâmetro desativado. Verifique se ainda há um padrão ativo.')
      } else {
        setMensagem(item.ativo ? 'Parâmetro desativado.' : 'Parâmetro ativado.')
      }
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível alterar a situação.'))
    }
  }

  async function marcarComoPadrao(item: ParametroBoletoListaItem) {
    if (!podeEditar || item.padrao) return
    setErro('')
    setMensagem('')
    try {
      await clienteHttp.patch(`/parametros-boleto/${item.id}/padrao`)
      await carregar(busca)
      setMensagem('Parâmetro definido como padrão da empresa.')
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível definir como padrão.'))
    }
  }

  if (modoForm) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Parâmetros de Boleto</h2>
          <p className="text-sm text-muted-foreground">
            Defina os limites, encargos e a integração com o banco para emissão de boletos no
            sistema.
          </p>
        </div>
        <FormularioParametrosBoleto
          registroId={registroEmEdicaoId}
          aoCancelar={fecharForm}
          aoSalvo={() => void aposSalvar()}
          podeSalvar={registroEmEdicaoId ? podeEditar : podeCriar}
        />
      </div>
    )
  }

  return (
    <CardPadrao
      titulo="Parâmetros de Boleto"
      descricao="Cadastre vários conjuntos de limites e credenciais; marque um como padrão da empresa."
      acoes={
        podeCriar ? (
          <BotaoPrimario type="button" onClick={abrirNovo}>
            <Plus className="h-4 w-4" />
            Novo parâmetro
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
              placeholder="Buscar por nome…"
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

        {!carregando && lista.length > 0 && !temPadrao && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            Nenhum parâmetro padrão ativo. Defina um padrão para facilitar a emissão futura.
          </p>
        )}

        {mensagem && <p className="text-sm text-green-700 dark:text-green-400">{mensagem}</p>}
        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Banco</th>
                <th className="px-4 py-3 font-medium">Ambiente</th>
                <th className="px-4 py-3 font-medium">Padrão</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <LinhasSkeletonTabela colunas={6} linhas={4} />
              ) : lista.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <p className="text-muted-foreground">Nenhum parâmetro de boleto cadastrado.</p>
                    {podeCriar && (
                      <Button type="button" variant="link" className="mt-2" onClick={abrirNovo}>
                        Cadastrar o primeiro parâmetro
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                lista.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                    onClick={() => {
                      if (podeEditar) abrirEdicao(item)
                    }}
                  >
                    <td className="px-4 py-3 font-medium">{item.nome}</td>
                    <td className="px-4 py-3">{rotuloBancoParametro(item.banco)}</td>
                    <td className="px-4 py-3">{rotuloAmbienteParametro(item.ambiente)}</td>
                    <td className="px-4 py-3">
                      {item.padrao ? (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
                          Sim
                        </span>
                      ) : (
                        '—'
                      )}
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
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-2">
                        {podeEditar && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => abrirEdicao(item)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </Button>
                            {!item.padrao && item.ativo && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => void marcarComoPadrao(item)}
                              >
                                <Star className="h-3.5 w-3.5" />
                                Padrão
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => void alternarAtivo(item)}
                            >
                              {item.ativo ? 'Desativar' : 'Ativar'}
                            </Button>
                          </>
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
