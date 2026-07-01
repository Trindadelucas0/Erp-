'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { usePermissao } from '@/hooks/use-permissao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { CabecalhoCadastroErp } from '@/components/compartilhado/cabecalho-cadastro-erp'
import { SecaoFormularioErp } from '@/components/compartilhado/secao-formulario-erp'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Abas } from '@/components/ui/abas'
import { BadgeStatus } from '@/components/ui/badge-status'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Cfop = {
  id: string
  codigo: string
  nome: string
  descricao: string
  tipoCfop: string
  ativo: boolean
}

const TIPOS_CFOP = [
  { id: '01', rotulo: '01 - Entrada' },
  { id: '02', rotulo: '02 - Transferência' },
  { id: '03', rotulo: '03 - Conhecimento frete' },
  { id: '04', rotulo: '04 - Devolução de compra' },
  { id: '05', rotulo: '05 - Devolução de venda' },
  { id: '06', rotulo: '06 - Doação' },
]

const formVazio = {
  codigo: '',
  nome: '',
  descricao: '',
  tipoCfop: '01',
  ativo: true,
}

function ConteudoDaPagina() {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('financeiro:create')
  const podeEditar = usePermissao('financeiro:edit')
  const podeDesativar = usePermissao('financeiro:delete')

  const [lista, setLista] = useState<Cfop[]>([])
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [idEmEdicao, setIdEmEdicao] = useState('')
  const [form, setForm] = useState(formVazio)
  const [abaAtiva, setAbaAtiva] = useState('dados')
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    try {
      const params = new URLSearchParams({ incluirInativos: 'true' })
      if (busca.trim()) params.set('q', busca.trim())
      const { data } = await clienteHttp.get(`/cfops?${params}`)
      setLista(data.cfops ?? [])
    } catch {
      setErro('Erro ao carregar CFOPs.')
    }
  }, [busca])

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado) return
    carregar()
  }, [carregandoSessao, estaAutenticado, carregar])

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
      setForm({
        codigo: c.codigo,
        nome: c.nome,
        descricao: c.descricao,
        tipoCfop: c.tipoCfop,
        ativo: c.ativo,
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

  async function aoSalvar(e?: FormEvent) {
    e?.preventDefault()
    setSalvando(true)
    setErro('')
    try {
      if (modoEdicao) {
        await clienteHttp.put(`/cfops/${idEmEdicao}`, {
          nome: form.nome,
          descricao: form.descricao,
          tipoCfop: form.tipoCfop,
        })
        setMensagem('CFOP atualizado.')
      } else {
        await clienteHttp.post('/cfops', {
          codigo: form.codigo,
          nome: form.nome,
          descricao: form.descricao,
          tipoCfop: form.tipoCfop,
        })
        setMensagem('CFOP criado.')
      }
      setModalAberto(false)
      await carregar()
    } catch (err: unknown) {
      setErro(
        (err as { response?: { data?: { mensagem?: string } } })?.response?.data?.mensagem ||
          'Erro ao salvar CFOP'
      )
    } finally {
      setSalvando(false)
    }
  }

  async function aoExcluir() {
    if (!modoEdicao || !idEmEdicao) return
    if (!confirm('Desativar este CFOP?')) return
    setSalvando(true)
    try {
      await clienteHttp.patch(`/cfops/${idEmEdicao}/ativo`, { ativo: false })
      setMensagem('CFOP desativado.')
      setModalAberto(false)
      await carregar()
    } catch (err: unknown) {
      setErro(
        (err as { response?: { data?: { mensagem?: string } } })?.response?.data?.mensagem ||
          'Erro ao desativar CFOP'
      )
    } finally {
      setSalvando(false)
    }
  }

  const listaFiltrada = lista.filter((c) => {
    const t = busca.toLowerCase()
    return (
      !t ||
      c.codigo.toLowerCase().includes(t) ||
      c.nome.toLowerCase().includes(t)
    )
  })

  const podeSalvar = modoEdicao ? podeEditar : podeCriar

  return (
    <div className="space-y-6">
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
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum CFOP encontrado.
                  </td>
                </tr>
              )}
              {listaFiltrada.map((cfop) => (
                <tr key={cfop.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium font-mono">{cfop.codigo}</td>
                  <td className="max-w-0 truncate px-4 py-3" title={cfop.nome}>
                    {cfop.nome}
                  </td>
                  <td className="max-w-0 truncate px-4 py-3 text-muted-foreground" title={TIPOS_CFOP.find((t) => t.id === cfop.tipoCfop)?.rotulo}>
                    {TIPOS_CFOP.find((t) => t.id === cfop.tipoCfop)?.rotulo ?? cfop.tipoCfop}
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
              ))}
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {modoEdicao && podeDesativar && form.ativo && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive/50 text-destructive hover:bg-destructive/10"
                  onClick={aoExcluir}
                  disabled={salvando}
                >
                  Desativar
                </Button>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <BotaoPrimario
                type="submit"
                form="form-cfop"
                disabled={salvando || !podeSalvar}
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </BotaoPrimario>
            </div>
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
            aoMudarCodigo={(v) => setForm((f) => ({ ...f, codigo: v }))}
            aoMudarNome={(v) => setForm((f) => ({ ...f, nome: v }))}
            aoMudarAtivo={(v) => setForm((f) => ({ ...f, ativo: v }))}
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

              <SecaoFormularioErp titulo="Tipo de CFOP">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {TIPOS_CFOP.map((tipo) => {
                    const selecionado = form.tipoCfop === tipo.id
                    return (
                      <label
                        key={tipo.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                          selecionado
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                            : 'border-border hover:bg-muted/40',
                          salvando && 'pointer-events-none opacity-50'
                        )}
                      >
                        <input
                          type="radio"
                          name="tipoCfop"
                          value={tipo.id}
                          checked={selecionado}
                          onChange={() => setForm((f) => ({ ...f, tipoCfop: tipo.id }))}
                          disabled={salvando}
                          className="size-4 shrink-0 accent-primary"
                        />
                        <span className="text-sm font-medium leading-snug">{tipo.rotulo}</span>
                      </label>
                    )
                  })}
                </div>
              </SecaoFormularioErp>
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}

export default function PaginaCfops() {
  return (
    <ProtegerRota chaveDaPagina="cfops">
      <ConteudoDaPagina />
    </ProtegerRota>
  )
}
