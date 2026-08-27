'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, MoreHorizontal, Plus, Search } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { usePermissao } from '@/hooks/use-permissao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatarMoedaBr } from '@/lib/contas-a-pagar'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { ModalRecorrenciaFinanceira } from './modal-recorrencia-financeira'
import type { RecorrenciaFinanceiraLista } from './tipos-recorrencia'

export function PainelRecorrenciasFinanceiras() {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('financeiro:create')
  const podeEditar = usePermissao('financeiro:edit')

  const [lista, setLista] = useState<RecorrenciaFinanceiraLista[]>([])
  const [fornecedores, setFornecedores] = useState<Array<{ id: string; nome: string }>>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [registroEmEdicao, setRegistroEmEdicao] = useState<RecorrenciaFinanceiraLista | null>(
    null
  )
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null)

  const carregar = useCallback(async (termo?: string) => {
    setCarregando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.get<{ recorrencias: RecorrenciaFinanceiraLista[] }>(
        '/recorrencias-financeiras',
        {
          params: {
            incluirInativos: true,
            ...(termo?.trim() ? { q: termo.trim() } : {}),
          },
        }
      )
      setLista(data.recorrencias ?? [])
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível carregar as recorrências'))
      setLista([])
    } finally {
      setCarregando(false)
    }
  }, [])

  const carregarFornecedores = useCallback(async () => {
    try {
      const { data } = await clienteHttp.get<{
        fornecedores?: Array<{ id: string; nome: string }>
      }>('/fornecedores')
      setFornecedores(
        (data.fornecedores ?? []).map((f) => ({ id: f.id, nome: f.nome })).sort((a, b) =>
          a.nome.localeCompare(b.nome, 'pt-BR')
        )
      )
    } catch {
      setFornecedores([])
    }
  }, [])

  useEffect(() => {
    if (!estaAutenticado || carregandoSessao) return
    void carregarFornecedores()
  }, [estaAutenticado, carregandoSessao, carregarFornecedores])

  useEffect(() => {
    if (!estaAutenticado || carregandoSessao) return
    const t = setTimeout(() => {
      void carregar(busca)
    }, 300)
    return () => clearTimeout(t)
  }, [busca, estaAutenticado, carregandoSessao, carregar])

  function abrirNovo() {
    setModoEdicao(false)
    setRegistroEmEdicao(null)
    setModalAberto(true)
    setMenuAbertoId(null)
  }

  function abrirEditar(reg: RecorrenciaFinanceiraLista) {
    setModoEdicao(true)
    setRegistroEmEdicao(reg)
    setModalAberto(true)
    setMenuAbertoId(null)
  }

  async function alternarAtivo(reg: RecorrenciaFinanceiraLista) {
    setMenuAbertoId(null)
    setMensagem('')
    setErro('')
    try {
      await clienteHttp.patch(`/recorrencias-financeiras/${reg.id}/ativo`, {
        ativo: !reg.ativo,
      })
      setMensagem(reg.ativo ? 'Recorrência desabilitada.' : 'Recorrência habilitada.')
      await carregar(busca)
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível alterar a situação'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Recorrência</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre fornecedor, produto/serviço e valor. Quando a nota chegar com o mesmo valor, a
            Entrada consolida sozinha.
          </p>
        </div>
        {podeCriar && (
          <BotaoPrimario type="button" onClick={abrirNovo}>
            <Plus className="size-4" />
            Adicionar recorrência
          </BotaoPrimario>
        )}
      </div>

      <CardPadrao titulo="Regras ativas" descricao="Lista de recorrências de serviços e consumo.">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar fornecedor ou produto…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        {mensagem && <p className="mb-2 text-sm text-emerald-700 dark:text-emerald-400">{mensagem}</p>}
        {erro && (
          <p className="mb-2 text-sm text-destructive" role="alert">
            {erro}
          </p>
        )}

        {carregando ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : lista.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma recorrência cadastrada.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border-2 border-border">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">Fornecedor</th>
                  <th className="px-3 py-2 font-medium">Produto / serviço</th>
                  <th className="px-3 py-2 font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Situação</th>
                  <th className="w-12 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {lista.map((reg) => (
                  <tr key={reg.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      {reg.fornecedor?.nomeFantasia || reg.fornecedor?.nome || '—'}
                    </td>
                    <td className="px-3 py-2">
                      {reg.produto?.sku ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {reg.produto.sku}{' '}
                        </span>
                      ) : null}
                      {reg.produto?.nomeVenda || '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatarMoedaBr(reg.valor)}</td>
                    <td className="px-3 py-2">
                      {reg.ativo ? (
                        <span className="text-emerald-700 dark:text-emerald-400">Habilitado</span>
                      ) : (
                        <span className="text-muted-foreground">Desabilitado</span>
                      )}
                    </td>
                    <td className="relative px-2 py-2 text-right">
                      {podeEditar && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label="Ações"
                            onClick={() =>
                              setMenuAbertoId((id) => (id === reg.id ? null : reg.id))
                            }
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                          {menuAbertoId === reg.id && (
                            <div className="absolute right-2 z-20 mt-1 min-w-[10rem] rounded-md border border-border bg-popover p-1 shadow-md">
                              <button
                                type="button"
                                className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                                onClick={() => abrirEditar(reg)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                                onClick={() => void alternarAtivo(reg)}
                              >
                                {reg.ativo ? 'Desabilitar' : 'Habilitar'}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardPadrao>

      <ModalRecorrenciaFinanceira
        aberto={modalAberto}
        modoEdicao={modoEdicao}
        registro={registroEmEdicao}
        fornecedores={fornecedores}
        aoFechar={() => setModalAberto(false)}
        aoSalvo={() => {
          setMensagem(modoEdicao ? 'Recorrência atualizada.' : 'Recorrência cadastrada.')
          void carregar(busca)
        }}
      />
    </div>
  )
}
