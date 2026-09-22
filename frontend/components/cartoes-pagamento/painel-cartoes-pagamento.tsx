'use client'

import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { usePermissao } from '@/hooks/use-permissao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { rotuloBandeira, type CodigoBandeiraCartao } from '@/lib/bandeiras-cartao'
import { FormularioCartaoPagamento } from './formulario-cartao-pagamento'
import { IconeBandeiraCartao } from './icone-bandeira-cartao'
import type { CartaoPagamentoLista } from './tipos-cartao'

export function PainelCartoesPagamento() {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('financeiro:create')
  const podeEditar = usePermissao('financeiro:edit')

  const [lista, setLista] = useState<CartaoPagamentoLista[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [modoForm, setModoForm] = useState(false)
  const [registroEmEdicao, setRegistroEmEdicao] = useState<CartaoPagamentoLista | null>(null)

  const carregar = useCallback(async (termo?: string) => {
    setCarregando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.get<{ cartoes: CartaoPagamentoLista[] }>(
        '/cartoes-pagamento',
        {
          params: {
            incluirInativos: true,
            ...(termo?.trim() ? { q: termo.trim() } : {}),
          },
        }
      )
      setLista(data.cartoes ?? [])
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível carregar os cartões'))
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
    setRegistroEmEdicao(null)
    setModoForm(true)
    setMensagem('')
    setErro('')
  }

  function abrirEdicao(item: CartaoPagamentoLista) {
    setRegistroEmEdicao(item)
    setModoForm(true)
    setMensagem('')
    setErro('')
  }

  function fecharForm() {
    setModoForm(false)
    setRegistroEmEdicao(null)
  }

  async function aposSalvar() {
    setMensagem(registroEmEdicao ? 'Cartão atualizado.' : 'Cartão cadastrado.')
    fecharForm()
    await carregar(busca)
  }

  if (modoForm) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Cartões de Pagamento</h2>
            <p className="text-sm text-muted-foreground">
              Cadastre as bandeiras de cartão, defina as taxas, prazos e condições de
              recebimento.
            </p>
          </div>
        </div>
        <FormularioCartaoPagamento
          registro={registroEmEdicao}
          aoCancelar={fecharForm}
          aoSalvo={() => void aposSalvar()}
          podeSalvar={registroEmEdicao ? podeEditar : podeCriar}
        />
      </div>
    )
  }

  return (
    <CardPadrao
      titulo="Cartões de Pagamento"
      descricao="Cadastre as bandeiras de cartão, defina as taxas, prazos e condições de recebimento."
      acoes={
        podeCriar ? (
          <BotaoPrimario type="button" onClick={abrirNovo}>
            <Plus className="h-4 w-4" />
            Novo Cartão
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
              placeholder="Buscar por nome, bandeira ou adquirente..."
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

        {mensagem && <p className="text-sm text-green-700 dark:text-green-400">{mensagem}</p>}
        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium">Cartão</th>
                <th className="px-4 py-3 font-medium">Bandeira</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Adquirente</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <LinhasSkeletonTabela colunas={6} linhas={4} />
              ) : lista.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    Nenhum cartão cadastrado.
                  </td>
                </tr>
              ) : (
                lista.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium">
                        <IconeBandeiraCartao
                          bandeira={item.bandeira as CodigoBandeiraCartao}
                        />
                        {item.nomeExibicao}
                      </div>
                    </td>
                    <td className="px-4 py-3">{rotuloBandeira(item.bandeira)}</td>
                    <td className="px-4 py-3">
                      {item.tipo === 'credito' ? 'Crédito' : 'Débito'}
                    </td>
                    <td className="px-4 py-3">{item.adquirente?.nome ?? '—'}</td>
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
