'use client'

/**
 * Painel de aprovação de clientes — Etapa 2 (admin).
 */
import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { usePermissao } from '@/hooks/use-permissao'
import { BadgeStatus } from '@/components/ui/badge-status'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Modal } from '@/components/ui/modal'
import { SelectPadrao } from '@/components/ui/select-padrao'
import {
  mascaraCnpj,
  mascaraCpf,
  mascaraTelefone,
} from '@/lib/documentos'
import {
  TIPOS_DE_CLIENTE,
  rotuloStatusAprovacao,
  varianteBadgeAprovacao,
} from '@/lib/status-cliente'
import { montarLinkDeAssinatura } from '@/lib/url-publica'

type ClientePendente = {
  id: string
  tipo: 'PF' | 'PJ'
  nome: string
  cpf?: string | null
  cnpj?: string | null
  nomeFantasia?: string | null
  email?: string | null
  telefone?: string | null
  cidade?: string | null
  estado?: string | null
  statusAprovacao?: string
  aceitaNFe55?: boolean
  createdAt?: string
}

type Usuario = {
  id: string
  name: string
  email: string
  active: boolean
}

type FormAprovacao = {
  tipoCliente: string
  limiteCredito: string
  condicaoPagamento: string
  vendedorId: string
  calculaComissao: boolean
  motivoReprovacao: string
}

const FORM_APROVACAO_VAZIO: FormAprovacao = {
  tipoCliente: '',
  limiteCredito: '0',
  condicaoPagamento: '',
  vendedorId: '',
  calculaComissao: false,
  motivoReprovacao: '',
}

function extrairErro(erro: unknown, padrao: string): string {
  if (erro && typeof erro === 'object' && 'response' in erro) {
    const res = (erro as { response?: { data?: { message?: string } } }).response
    if (res?.data?.message) return res.data.message
  }
  return padrao
}

function formatarDocumento(c: ClientePendente) {
  if (c.tipo === 'PF' && c.cpf) return mascaraCpf(c.cpf)
  if (c.tipo === 'PJ' && c.cnpj) return mascaraCnpj(c.cnpj)
  return '—'
}

function ConteudoAprovacao() {
  const podeAprovar = usePermissao('clientes:approve')
  const [pendentes, setPendentes] = useState<ClientePendente[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const [clienteSelecionado, setClienteSelecionado] = useState<ClientePendente | null>(null)
  const [form, setForm] = useState<FormAprovacao>(FORM_APROVACAO_VAZIO)
  const [modoReprovar, setModoReprovar] = useState(false)
  const [processando, setProcessando] = useState(false)

  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(false)
  const [linkAssinatura, setLinkAssinatura] = useState('')
  const [nomeClienteAprovado, setNomeClienteAprovado] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const [resPendentes, resUsuarios] = await Promise.all([
        clienteHttp.get('/clientes/pendentes'),
        clienteHttp.get('/users'),
      ])
      setPendentes(resPendentes.data.clientes ?? [])
      setUsuarios((resUsuarios.data.usuarios ?? []).filter((u: Usuario) => u.active))
    } catch (e) {
      setErro(extrairErro(e, 'Erro ao carregar pendentes'))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (podeAprovar) carregar()
  }, [podeAprovar, carregar])

  function abrirAnalise(cliente: ClientePendente) {
    setClienteSelecionado(cliente)
    setForm(FORM_APROVACAO_VAZIO)
    setModoReprovar(false)
    setErro('')
  }

  function fecharAnalise() {
    setClienteSelecionado(null)
    setModoReprovar(false)
    setForm(FORM_APROVACAO_VAZIO)
  }

  async function aoSubmeter(evento: FormEvent) {
    evento.preventDefault()
    if (!clienteSelecionado) return

    setProcessando(true)
    setErro('')
    setSucesso('')

    try {
      if (modoReprovar) {
        await clienteHttp.patch(`/clientes/${clienteSelecionado.id}/aprovacao`, {
          acao: 'reprovar',
          motivoReprovacao: form.motivoReprovacao,
        })
        setSucesso(`Cadastro de ${clienteSelecionado.nome} reprovado.`)
        fecharAnalise()
        await carregar()
      } else {
        const { data } = await clienteHttp.patch(
          `/clientes/${clienteSelecionado.id}/aprovacao`,
          {
            acao: 'aprovar',
            tipoCliente: form.tipoCliente,
            limiteCredito: parseFloat(form.limiteCredito.replace(',', '.')) || 0,
            condicaoPagamento: form.condicaoPagamento,
            vendedorId: form.vendedorId || undefined,
            calculaComissao: form.calculaComissao,
          }
        )

        const token = data.tokenAssinatura as string
        setLinkAssinatura(montarLinkDeAssinatura(token))
        setNomeClienteAprovado(clienteSelecionado.nome)
        setModalAssinaturaAberto(true)
        fecharAnalise()
        await carregar()
      }
    } catch (e) {
      setErro(extrairErro(e, 'Erro ao processar aprovação'))
    } finally {
      setProcessando(false)
    }
  }

  function copiarLink() {
    if (linkAssinatura) {
      navigator.clipboard.writeText(linkAssinatura)
      setSucesso('Link copiado para a área de transferência.')
    }
  }

  if (!podeAprovar) {
    return (
      <CardPadrao titulo="Aprovação de clientes" descricao="Acesso restrito">
        <p className="text-sm text-muted-foreground">
          Você não tem permissão para aprovar cadastros de clientes.
        </p>
        <Link href="/clientes" className="mt-4 inline-block text-sm text-primary underline">
          Voltar para clientes
        </Link>
      </CardPadrao>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Aprovação de clientes</h1>
          <p className="text-sm text-muted-foreground">
            Analise cadastros pendentes e defina classificação comercial
          </p>
        </div>
        <Link href="/clientes">
          <Button type="button" variant="outline" size="sm">
            ← Voltar para clientes
          </Button>
        </Link>
      </div>

      {erro && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
      )}
      {sucesso && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{sucesso}</p>
      )}

      <CardPadrao
        titulo="Cadastros pendentes"
        descricao={`${pendentes.length} aguardando análise`}
      >
        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : pendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cadastro pendente de aprovação.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium">Nome</th>
                  <th className="px-4 py-3 text-left font-medium">Documento</th>
                  <th className="px-4 py-3 text-left font-medium">Contato</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pendentes.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">{c.tipo}</td>
                    <td className="px-4 py-3 font-medium">{c.nome}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {formatarDocumento(c)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.email || (c.telefone ? mascaraTelefone(c.telefone) : '—')}
                    </td>
                    <td className="px-4 py-3">
                      <BadgeStatus variante={varianteBadgeAprovacao(c.statusAprovacao)}>
                        {rotuloStatusAprovacao(c.statusAprovacao)}
                      </BadgeStatus>
                    </td>
                    <td className="px-4 py-3">
                      <Button type="button" size="sm" onClick={() => abrirAnalise(c)}>
                        Analisar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardPadrao>

      <Modal
        aberto={!!clienteSelecionado}
        aoFechar={fecharAnalise}
        titulo={clienteSelecionado ? `Analisar: ${clienteSelecionado.nome}` : ''}
        descricao="Defina os dados comerciais ou reprove o cadastro"
        largura="lg"
        rodape={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={fecharAnalise} disabled={processando}>
              Cancelar
            </Button>
            {!modoReprovar ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setModoReprovar(true)}
                  disabled={processando}
                >
                  Reprovar
                </Button>
                <BotaoPrimario type="submit" form="form-aprovacao" disabled={processando}>
                  {processando ? 'Processando...' : 'Aprovar cadastro'}
                </BotaoPrimario>
              </>
            ) : (
              <Button type="submit" form="form-aprovacao" variant="destructive" disabled={processando}>
                {processando ? 'Processando...' : 'Confirmar reprovação'}
              </Button>
            )}
          </div>
        }
      >
        {clienteSelecionado && (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
              <p><strong>Tipo:</strong> {clienteSelecionado.tipo}</p>
              <p><strong>Documento:</strong> {formatarDocumento(clienteSelecionado)}</p>
              {clienteSelecionado.nomeFantasia && (
                <p><strong>Fantasia:</strong> {clienteSelecionado.nomeFantasia}</p>
              )}
              <p>
                <strong>Local:</strong>{' '}
                {clienteSelecionado.cidade && clienteSelecionado.estado
                  ? `${clienteSelecionado.cidade} / ${clienteSelecionado.estado}`
                  : '—'}
              </p>
              <p>
                <strong>NF-e modelo 55:</strong>{' '}
                {clienteSelecionado.aceitaNFe55 ? 'Sim' : 'Não'}
              </p>
            </div>

            <form id="form-aprovacao" onSubmit={aoSubmeter} className="space-y-4">
              {modoReprovar ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Motivo da reprovação</label>
                  <textarea
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.motivoReprovacao}
                    onChange={(e) => setForm((f) => ({ ...f, motivoReprovacao: e.target.value }))}
                    required
                    minLength={3}
                    placeholder="Descreva o motivo para o vendedor corrigir o cadastro"
                  />
                  <button
                    type="button"
                    className="text-xs text-primary underline"
                    onClick={() => setModoReprovar(false)}
                  >
                    ← Voltar para aprovação
                  </button>
                </div>
              ) : (
                <>
                  <SelectPadrao
                    rotulo="Tipo de cliente"
                    valor={form.tipoCliente}
                    aoMudar={(v) => setForm((f) => ({ ...f, tipoCliente: v }))}
                    opcoes={TIPOS_DE_CLIENTE}
                    placeholder="Selecione..."
                    obrigatorio
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Limite de crédito (R$) *</label>
                      <input
                        type="text"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={form.limiteCredito}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            limiteCredito: e.target.value.replace(/[^\d,.]/g, ''),
                          }))
                        }
                        required
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Condição de pagamento *</label>
                      <input
                        type="text"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={form.condicaoPagamento}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, condicaoPagamento: e.target.value }))
                        }
                        required
                        placeholder="Ex: 30 dias"
                        maxLength={100}
                      />
                    </div>
                  </div>

                  <SelectPadrao
                    rotulo="Vendedor responsável (opcional)"
                    valor={form.vendedorId}
                    aoMudar={(v) => setForm((f) => ({ ...f, vendedorId: v }))}
                    opcoes={usuarios.map((u) => ({
                      value: u.id,
                      label: `${u.name} (${u.email})`,
                    }))}
                    placeholder="Nenhum vendedor vinculado"
                  />
                  <p className="text-xs text-muted-foreground -mt-1">
                      Se definido, somente este vendedor poderá vender ou calcular comissão (módulo Vendas).
                    </p>

                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.calculaComissao}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, calculaComissao: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    <span className="text-sm font-medium">Calcula comissão sobre este cliente?</span>
                  </label>
                </>
              )}
            </form>
          </div>
        )}
      </Modal>

      <Modal
        aberto={modalAssinaturaAberto}
        aoFechar={() => setModalAssinaturaAberto(false)}
        titulo="Próximo passo: assinatura"
        descricao={`Cadastro de ${nomeClienteAprovado} aprovado`}
        rodape={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={copiarLink}>
              Copiar link
            </Button>
            <BotaoPrimario type="button" onClick={() => setModalAssinaturaAberto(false)}>
              Entendi
            </BotaoPrimario>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <p>
            O cadastro foi aprovado e está com status <strong>Aguardando assinatura</strong>.
          </p>
          <p>
            O próximo passo é a assinatura do titular/sócio. O canal de envio definitivo
            (e-mail, WhatsApp, etc.) será definido com o cliente. Por enquanto, utilize o link
            abaixo para envio manual:
          </p>
          <div className="rounded-md border border-border bg-muted/30 p-3 break-all font-mono text-xs">
            {linkAssinatura}
          </div>
          <p className="text-muted-foreground">
            Após a assinatura, o cadastro será ativado automaticamente para uso comercial.
          </p>
        </div>
      </Modal>
    </div>
  )
}

export default function PaginaAprovacaoClientes() {
  return (
    <ProtegerRota chaveDaPagina="clientes">
      <ConteudoAprovacao />
    </ProtegerRota>
  )
}
