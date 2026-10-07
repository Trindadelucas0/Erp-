'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Search } from 'lucide-react'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import {
  formatarMoedaInput,
  parseNumeroBr,
} from '@/components/cartoes-pagamento/tipos-cartao'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputPadrao } from '@/components/ui/input-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'
import { usePermissao } from '@/hooks/use-permissao'
import { formatarMoedaBr } from '@/lib/contas-a-pagar'
import {
  type ContaEmpresaLista,
  type TipoContaEmpresa,
  formatarAgenciaExibicao,
  formatarContaExibicao,
  OPCOES_BANCO_CONTA,
  OPCOES_TIPO_CONTA,
  rotuloTipoConta,
} from '@/lib/contas-empresa'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { rotuloBancoParametro } from '@/lib/parametros-boleto'
import { clienteHttp } from '@/services/api'

type FormConta = {
  nome: string
  tipo: TipoContaEmpresa
  banco: string
  agencia: string
  digitoAgencia: string
  conta: string
  digitoConta: string
  limiteChequeEspecial: string
  ativo: boolean
}

function formVazio(): FormConta {
  return {
    nome: '',
    tipo: 'bancaria',
    banco: '',
    agencia: '',
    digitoAgencia: '',
    conta: '',
    digitoConta: '',
    limiteChequeEspecial: '',
    ativo: true,
  }
}

function contaParaForm(item: ContaEmpresaLista): FormConta {
  return {
    nome: item.nome,
    tipo: item.tipo === 'caixa' ? 'caixa' : 'bancaria',
    banco: item.banco ?? '',
    agencia: item.agencia ?? '',
    digitoAgencia: item.digitoAgencia ?? '',
    conta: item.conta ?? '',
    digitoConta: item.digitoConta ?? '',
    limiteChequeEspecial:
      item.limiteChequeEspecial != null && Number.isFinite(item.limiteChequeEspecial)
        ? formatarMoedaInput(item.limiteChequeEspecial)
        : '',
    ativo: item.ativo,
  }
}

function montarPayload(form: FormConta) {
  const base = {
    nome: form.nome.trim(),
    tipo: form.tipo,
    ativo: form.ativo,
  }

  if (form.tipo === 'caixa') {
    return base
  }

  const limiteTexto = form.limiteChequeEspecial.trim()
  let limiteChequeEspecial: number | null = null
  if (limiteTexto) {
    const n = parseNumeroBr(limiteTexto)
    if (Number.isFinite(n)) limiteChequeEspecial = n
  }

  return {
    ...base,
    banco: form.banco || null,
    agencia: form.agencia.trim() || null,
    digitoAgencia: form.digitoAgencia.trim().toUpperCase() || null,
    conta: form.conta.trim() || null,
    digitoConta: form.digitoConta.trim().toUpperCase() || null,
    limiteChequeEspecial,
  }
}

function ConteudoContas() {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('financeiro:create')
  const podeEditar = usePermissao('financeiro:edit')

  const [lista, setLista] = useState<ContaEmpresaLista[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState<FormConta>(formVazio())
  const [salvando, setSalvando] = useState(false)

  const ehBancaria = form.tipo === 'bancaria'

  const carregar = useCallback(async (termo?: string) => {
    setCarregando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.get<{ contas: ContaEmpresaLista[] }>('/contas', {
        params: {
          incluirInativos: true,
          ...(termo?.trim() ? { q: termo.trim() } : {}),
        },
      })
      setLista(data.contas ?? [])
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível carregar as contas'))
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
    setForm(formVazio())
    setMostrarForm(true)
    setErro('')
    setMensagem('')
  }

  function abrirEdicao(item: ContaEmpresaLista) {
    setEditandoId(item.id)
    setForm(contaParaForm(item))
    setMostrarForm(true)
    setErro('')
    setMensagem('')
  }

  function fecharForm() {
    setMostrarForm(false)
    setEditandoId(null)
    setForm(formVazio())
  }

  async function salvar() {
    setErro('')
    setMensagem('')
    setSalvando(true)
    try {
      const payload = montarPayload(form)
      if (editandoId) {
        await clienteHttp.put(`/contas/${editandoId}`, payload)
        setMensagem('Conta atualizada.')
      } else {
        await clienteHttp.post('/contas', payload)
        setMensagem('Conta cadastrada.')
      }
      fecharForm()
      await carregar(busca)
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Erro ao salvar conta'))
    } finally {
      setSalvando(false)
    }
  }

  async function alternarAtivo(item: ContaEmpresaLista) {
    if (!podeEditar) return
    setErro('')
    try {
      await clienteHttp.patch(`/contas/${item.id}/ativo`, { ativo: !item.ativo })
      await carregar(busca)
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Erro ao alterar situação'))
    }
  }

  const podeSalvar =
    form.nome.trim().length >= 2 &&
    (!ehBancaria ||
      (form.banco.length > 0 && form.agencia.trim().length > 0 && form.conta.trim().length > 0))

  return (
    <CardPadrao
      titulo="Contas"
      descricao="Contas bancárias e caixas desta empresa."
      acoes={
        podeCriar ? (
          <BotaoPrimario type="button" onClick={abrirNovo}>
            <Plus className="h-4 w-4" />
            Nova conta
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
              placeholder="Buscar conta..."
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
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex.: Itaú matriz"
              maxLength={80}
            />
            <SelectPadrao
              rotulo="Tipo *"
              valor={form.tipo}
              aoMudar={(v) =>
                setForm((f) => ({ ...f, tipo: v as TipoContaEmpresa }))
              }
              opcoes={OPCOES_TIPO_CONTA}
            />
            {ehBancaria && (
              <>
                <SelectPadrao
                  rotulo="Banco *"
                  valor={form.banco}
                  aoMudar={(v) => setForm((f) => ({ ...f, banco: v }))}
                  opcoes={OPCOES_BANCO_CONTA}
                  placeholder="Selecione o banco"
                />
                <div className="grid grid-cols-[1fr_auto] gap-2 sm:col-span-2">
                  <InputPadrao
                    rotulo="Agência *"
                    value={form.agencia}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, agencia: e.target.value.replace(/\D/g, '') }))
                    }
                    maxLength={5}
                    inputMode="numeric"
                  />
                  <InputPadrao
                    rotulo="Dígito agência"
                    value={form.digitoAgencia}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        digitoAgencia: e.target.value.slice(0, 1).toUpperCase(),
                      }))
                    }
                    maxLength={1}
                    className="w-20"
                  />
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2 sm:col-span-2">
                  <InputPadrao
                    rotulo="CC *"
                    value={form.conta}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, conta: e.target.value.replace(/\D/g, '') }))
                    }
                    maxLength={12}
                    inputMode="numeric"
                  />
                  <InputPadrao
                    rotulo="Dígito conta"
                    value={form.digitoConta}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        digitoConta: e.target.value.slice(0, 1).toUpperCase(),
                      }))
                    }
                    maxLength={1}
                    className="w-20"
                  />
                </div>
                <InputPadrao
                  rotulo="Limite de cheque especial"
                  value={form.limiteChequeEspecial}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, limiteChequeEspecial: e.target.value }))
                  }
                  placeholder="0,00"
                />
              </>
            )}
            <div className="flex items-end gap-3 pb-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
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
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Banco</th>
                <th className="px-4 py-3 font-medium">Agência</th>
                <th className="px-4 py-3 font-medium">CC</th>
                <th className="px-4 py-3 font-medium">Limite</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <LinhasSkeletonTabela colunas={8} linhas={4} />
              ) : lista.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                    Nenhuma conta cadastrada.
                  </td>
                </tr>
              ) : (
                lista.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{item.nome}</td>
                    <td className="px-4 py-3">{rotuloTipoConta(item.tipo)}</td>
                    <td className="px-4 py-3">
                      {item.tipo === 'caixa' ? '—' : rotuloBancoParametro(item.banco)}
                    </td>
                    <td className="px-4 py-3">
                      {item.tipo === 'caixa'
                        ? '—'
                        : formatarAgenciaExibicao(item.agencia, item.digitoAgencia)}
                    </td>
                    <td className="px-4 py-3">
                      {item.tipo === 'caixa'
                        ? '—'
                        : formatarContaExibicao(item.conta, item.digitoConta)}
                    </td>
                    <td className="px-4 py-3">
                      {item.limiteChequeEspecial != null
                        ? formatarMoedaBr(item.limiteChequeEspecial)
                        : '—'}
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

export default function PaginaContas() {
  return (
    <ProtegerRota chaveDaPagina="contas">
      <ConteudoContas />
    </ProtegerRota>
  )
}
