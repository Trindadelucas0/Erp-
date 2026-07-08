'use client'

/**
 * Painel de aprovação de clientes — Etapa 2 (admin).
 */
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { ConfirmacaoComSenha } from '@/components/compartilhado/confirmacao-com-senha'
import { usePermissao } from '@/hooks/use-permissao'
import { useDesbloqueioAssinatura } from '@/hooks/use-desbloqueio-assinatura'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { BadgeStatus } from '@/components/ui/badge-status'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { CabecalhoColunaOrdenavel } from '@/components/ui/cabecalho-coluna-ordenavel'
import { useOrdenacaoColunas } from '@/hooks/use-ordenacao-colunas'
import { ordenarLista } from '@/lib/ordenacao-lista'
import { Modal } from '@/components/ui/modal'
import { SelectPadrao } from '@/components/ui/select-padrao'
import {
  ModalEnviarDocumentoCliente,
  type ClienteParaAssinatura,
} from '@/components/assinatura-zapsign/modal-enviar-documento-cliente'
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

type ClienteAguardando = {
  id: string
  tipo: 'PF' | 'PJ'
  nome: string
  cpf?: string | null
  cnpj?: string | null
  email: string | null
  statusAprovacao: string
  tokenAssinaturaInterno: string | null
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

function formatarDocumento(c: ClientePendente | ClienteAguardando) {
  if (c.tipo === 'PF' && c.cpf) return mascaraCpf(c.cpf)
  if (c.tipo === 'PJ' && c.cnpj) return mascaraCnpj(c.cnpj)
  return '—'
}

function ConteudoAprovacao() {
  const podeAprovar = usePermissao('clientes:approve')
  const { perfil } = useSessaoDoUsuario()
  const ehAdmin = perfil?.ehAdmin ?? false
  const {
    desbloqueado,
    pedindoSenha,
    solicitarDesbloqueio,
    aoDesbloquear,
    cancelarDesbloqueio,
  } = useDesbloqueioAssinatura()

  const [pendentes, setPendentes] = useState<ClientePendente[]>([])
  const [aguardando, setAguardando] = useState<ClienteAguardando[]>([])
  const { ordenacao: ordenacaoPendentes, alternarOrdenacao: alternarOrdenacaoPendentes } =
    useOrdenacaoColunas<'tipo' | 'nome' | 'documento' | 'contato' | 'status'>()
  const { ordenacao: ordenacaoAguardando, alternarOrdenacao: alternarOrdenacaoAguardando } =
    useOrdenacaoColunas<'nome' | 'documento' | 'email' | 'status'>()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const [clienteSelecionado, setClienteSelecionado] = useState<ClientePendente | null>(null)
  const [form, setForm] = useState<FormAprovacao>(FORM_APROVACAO_VAZIO)
  const [modoReprovar, setModoReprovar] = useState(false)
  const [processando, setProcessando] = useState(false)

  // Pendente de abertura ZapSign após aprovação (quando admin precisou desbloquear antes)
  const [clienteZapsignPendente, setClienteZapsignPendente] = useState<ClienteParaAssinatura | null>(null)

  // Modal ZapSign
  const [clienteZapsign, setClienteZapsign] = useState<ClienteParaAssinatura | null>(null)
  const [modalZapsignAberto, setModalZapsignAberto] = useState(false)
  const [linkZapsignRetornado, setLinkZapsignRetornado] = useState<string | null>(null)
  const [modalSucessoZapsignAberto, setModalSucessoZapsignAberto] = useState(false)

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
      setErro(extrairMensagemApi(e, 'Erro ao carregar dados'))
    } finally {
      setCarregando(false)
    }

    // Carrega aguardando assinatura separadamente — não quebra a tela se o endpoint
    // ainda não estiver disponível no backend.
    try {
      const res = await clienteHttp.get('/clientes/aguardando-assinatura')
      setAguardando(res.data.clientes ?? [])
    } catch {
      setAguardando([])
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

        const dadosCliente: ClienteParaAssinatura = {
          id: clienteSelecionado.id,
          nome: clienteSelecionado.nome,
          email: clienteSelecionado.email ?? null,
        }

        fecharAnalise()
        await carregar()

        if (ehAdmin && desbloqueado) {
          // Admin desbloqueado — abre ZapSign imediatamente
          setClienteZapsign(dadosCliente)
          setModalZapsignAberto(true)
        } else if (ehAdmin) {
          // Admin sem desbloqueio — guarda pendente e solicita senha
          setClienteZapsignPendente(dadosCliente)
          setSucesso(`Cadastro de ${data.cliente?.nome ?? dadosCliente.nome} aprovado. Confirme sua senha para enviar o contrato.`)
          solicitarDesbloqueio()
        } else {
          setSucesso(`Cadastro de ${data.cliente?.nome ?? dadosCliente.nome} aprovado. Um administrador poderá enviar o contrato de assinatura.`)
        }
      }
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Erro ao processar aprovação'))
    } finally {
      setProcessando(false)
    }
  }

  function abrirZapsignParaCliente(cliente: ClienteAguardando) {
    const dadosCliente: ClienteParaAssinatura = { id: cliente.id, nome: cliente.nome, email: cliente.email }
    if (desbloqueado) {
      setClienteZapsign(dadosCliente)
      setModalZapsignAberto(true)
    } else {
      setClienteZapsignPendente(dadosCliente)
      solicitarDesbloqueio()
    }
  }

  function aoEnviarZapsign(link: string | null) {
    setModalZapsignAberto(false)
    setLinkZapsignRetornado(link)
    setModalSucessoZapsignAberto(true)
    carregar()
  }

  function aoDesbloquearEAbrirPendente() {
    aoDesbloquear()
    if (clienteZapsignPendente) {
      setClienteZapsign(clienteZapsignPendente)
      setClienteZapsignPendente(null)
      setModalZapsignAberto(true)
    }
  }

  const pendentesExibidos = useMemo(
    () =>
      ordenarLista(pendentes, ordenacaoPendentes, (c, coluna) => {
        switch (coluna) {
          case 'tipo':
            return c.tipo
          case 'nome':
            return c.nome
          case 'documento':
            return c.tipo === 'PF' ? (c.cpf ?? '') : (c.cnpj ?? '')
          case 'contato':
            return c.email || c.telefone || ''
          case 'status':
            return rotuloStatusAprovacao(c.statusAprovacao)
        }
      }),
    [pendentes, ordenacaoPendentes]
  )

  const aguardandoExibidos = useMemo(
    () =>
      ordenarLista(aguardando, ordenacaoAguardando, (c, coluna) => {
        switch (coluna) {
          case 'nome':
            return c.nome
          case 'documento':
            return c.tipo === 'PF' ? (c.cpf ?? '') : (c.cnpj ?? '')
          case 'email':
            return c.email ?? ''
          case 'status':
            return rotuloStatusAprovacao(c.statusAprovacao)
        }
      }),
    [aguardando, ordenacaoAguardando]
  )

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
    <div className="min-w-0 space-y-6">
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

      {/* Seção: cadastros pendentes */}
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
                  <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Tipo" coluna="tipo" ordenacao={ordenacaoPendentes} onOrdenar={alternarOrdenacaoPendentes} />
                  <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Nome" coluna="nome" ordenacao={ordenacaoPendentes} onOrdenar={alternarOrdenacaoPendentes} />
                  <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Documento" coluna="documento" ordenacao={ordenacaoPendentes} onOrdenar={alternarOrdenacaoPendentes} />
                  <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Contato" coluna="contato" ordenacao={ordenacaoPendentes} onOrdenar={alternarOrdenacaoPendentes} />
                  <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Status" coluna="status" ordenacao={ordenacaoPendentes} onOrdenar={alternarOrdenacaoPendentes} />
                  <th className="px-4 py-3 text-left font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pendentesExibidos.map((c) => (
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

      {/* Seção: aguardando assinatura */}
      <CardPadrao
        titulo="Aguardando assinatura"
        descricao={`${aguardando.length} cliente(s) aprovados pendentes de envio de contrato`}
      >
        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : aguardando.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum cliente aguardando assinatura no momento.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Nome" coluna="nome" ordenacao={ordenacaoAguardando} onOrdenar={alternarOrdenacaoAguardando} />
                  <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Documento" coluna="documento" ordenacao={ordenacaoAguardando} onOrdenar={alternarOrdenacaoAguardando} />
                  <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="E-mail" coluna="email" ordenacao={ordenacaoAguardando} onOrdenar={alternarOrdenacaoAguardando} />
                  <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Status" coluna="status" ordenacao={ordenacaoAguardando} onOrdenar={alternarOrdenacaoAguardando} />
                  <th className="px-4 py-3 text-left font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {aguardandoExibidos.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{c.nome}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {formatarDocumento(c)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.email ?? (
                        <span className="text-destructive text-xs">Sem e-mail</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <BadgeStatus variante={varianteBadgeAprovacao(c.statusAprovacao)}>
                        {rotuloStatusAprovacao(c.statusAprovacao)}
                      </BadgeStatus>
                    </td>
                    <td className="px-4 py-3">
                      {ehAdmin ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => abrirZapsignParaCliente(c)}
                        >
                          Enviar contrato
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Somente admin</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardPadrao>

      {/* Modal: análise de aprovação */}
      <Modal
        aberto={!!clienteSelecionado}
        aoFechar={fecharAnalise}
        titulo={clienteSelecionado ? `Analisar: ${clienteSelecionado.nome}` : ''}
        descricao="Defina os dados comerciais ou reprove o cadastro"
        largura="lg"
        rodape={
          <div className="flex flex-wrap justify-end gap-2">
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
                <strong>Exige NF-e modelo 55:</strong>{' '}
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

      {/* Modal ZapSign: envio de contrato */}
      {clienteZapsign && (
        <ModalEnviarDocumentoCliente
          cliente={clienteZapsign}
          aberto={modalZapsignAberto}
          aoFechar={() => setModalZapsignAberto(false)}
          aoEnviar={aoEnviarZapsign}
        />
      )}

      {/* Modal: sucesso envio ZapSign */}
      <Modal
        aberto={modalSucessoZapsignAberto}
        aoFechar={() => {
          setModalSucessoZapsignAberto(false)
          setLinkZapsignRetornado(null)
        }}
        titulo="Contrato enviado com sucesso"
        descricao="O signatário receberá o link por e-mail via ZapSign."
        rodape={
          <div className="flex justify-end">
            <BotaoPrimario
              type="button"
              onClick={() => {
                setModalSucessoZapsignAberto(false)
                setLinkZapsignRetornado(null)
              }}
            >
              Fechar
            </BotaoPrimario>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <p>O contrato foi enviado para assinatura. A ZapSign enviou o link por e-mail ao cliente.</p>

          {linkZapsignRetornado && (
            <div className="space-y-1">
              <p className="text-muted-foreground">
                Link direto de assinatura (caso precise enviar manualmente):
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md border border-border bg-muted/30 p-2 break-all font-mono text-xs">
                  {linkZapsignRetornado}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(linkZapsignRetornado!)
                    setSucesso('Link copiado.')
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>
          )}

          <p className="rounded-md bg-muted/40 px-3 py-2 text-muted-foreground">
            Acompanhe o status em{' '}
            <strong className="text-foreground">Configurações → Assinatura Digital → Documentos</strong>.
            Após o cliente assinar, clique em <strong className="text-foreground">Atualizar</strong> para
            sincronizar o status.
          </p>
        </div>
      </Modal>

      {/* Modal: confirmar senha para envio de contrato (admin) */}
      {pedindoSenha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Confirmar identidade</h3>
            <ConfirmacaoComSenha
              escopo="assinatura-documentos"
              mensagem="Para enviar contratos de assinatura, confirme sua senha de administrador. O acesso ficará ativo por 15 minutos."
              onConfirmar={aoDesbloquearEAbrirPendente}
              onCancelar={() => {
                setClienteZapsignPendente(null)
                cancelarDesbloqueio()
              }}
            />
          </div>
        </div>
      )}

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
