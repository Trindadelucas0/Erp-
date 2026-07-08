'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { CabecalhoColunaOrdenavel } from '@/components/ui/cabecalho-coluna-ordenavel'
import { useOrdenacaoColunas } from '@/hooks/use-ordenacao-colunas'
import { ordenarLista } from '@/lib/ordenacao-lista'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { BadgeStatus } from '@/components/ui/badge-status'
import { Modal } from '@/components/ui/modal'
import { SelectPadrao } from '@/components/ui/select-padrao'
import {
  ModalEnviarDocumentoCliente,
  type ClienteParaAssinatura,
} from './modal-enviar-documento-cliente'

type Documento = {
  id: string
  tokenZapsign: string
  nomeDocumento: string
  status: string
  signatarioNome: string | null
  signatarioEmail: string | null
  linkAssinatura: string | null
  assinadoEm: string | null
  recusadoEm: string | null
  motivoRecusa: string | null
  criadoEm: string
}

type ClienteAguardando = {
  id: string
  nome: string
  email: string | null
}

type VarianteBadge = 'ativo' | 'inativo' | 'pendente' | 'reprovado' | 'aguardando' | 'info'

function statusParaBadge(status: string): { variante: VarianteBadge; rotulo: string } {
  switch (status) {
    case 'signed':
      return { variante: 'ativo', rotulo: 'Assinado' }
    case 'refused':
      return { variante: 'reprovado', rotulo: 'Recusado' }
    case 'deleted':
      return { variante: 'inativo', rotulo: 'Excluído' }
    case 'expired':
      return { variante: 'inativo', rotulo: 'Expirado' }
    case 'pending':
    case 'pendente':
    default:
      return { variante: 'pendente', rotulo: 'Pendente' }
  }
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function ListaDocumentosZapsign() {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState<string | null>(null)
  const sincronizandoRef = useRef(false)

  // Seleção de cliente antes de enviar
  const [clientes, setClientes] = useState<ClienteAguardando[]>([])
  const [clienteIdSelecionado, setClienteIdSelecionado] = useState('')
  const [modalSelecionarClienteAberto, setModalSelecionarClienteAberto] = useState(false)
  const [erroSeletor, setErroSeletor] = useState('')

  // Modal de envio
  const [clienteParaModal, setClienteParaModal] = useState<ClienteParaAssinatura | null>(null)
  const [modalEnvioAberto, setModalEnvioAberto] = useState(false)
  const { ordenacao, alternarOrdenacao } = useOrdenacaoColunas<
    'documento' | 'signatario' | 'status' | 'data'
  >()

  const documentosExibidos = useMemo(
    () =>
      ordenarLista(documentos, ordenacao, (doc, coluna) => {
        switch (coluna) {
          case 'documento':
            return doc.nomeDocumento
          case 'signatario':
            return doc.signatarioNome ?? doc.signatarioEmail ?? ''
          case 'status':
            return statusParaBadge(doc.status).rotulo
          case 'data':
            return new Date(doc.assinadoEm || doc.recusadoEm || doc.criadoEm)
        }
      }),
    [documentos, ordenacao]
  )

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const [resDoc, resClientes] = await Promise.all([
        clienteHttp.get<{ documentos: Documento[] }>('/zapsign/documentos'),
        clienteHttp.get<{ clientes: ClienteAguardando[] }>('/clientes/aguardando-assinatura'),
      ])
      setDocumentos(resDoc.data.documentos)
      setClientes(resClientes.data.clientes ?? [])
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível carregar os documentos.'))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Auto-sincroniza a cada 30s enquanto houver documentos pendentes
  useEffect(() => {
    const temPendente = documentos.some((d) => d.status === 'pendente' || d.status === 'pending')
    if (!temPendente) return

    const id = setInterval(async () => {
      if (sincronizandoRef.current) return
      sincronizandoRef.current = true
      try {
        await clienteHttp.post('/zapsign/documentos/sincronizar')
        await carregar()
      } catch {
        // falha silenciosa — não exibe erro para o usuário
      } finally {
        sincronizandoRef.current = false
      }
    }, 30_000)

    return () => clearInterval(id)
  }, [documentos, carregar])

  async function sincronizarECarregar() {
    if (sincronizandoRef.current) return
    sincronizandoRef.current = true
    setCarregando(true)
    setErro('')
    try {
      await clienteHttp.post('/zapsign/documentos/sincronizar')
      await carregar()
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível sincronizar os documentos.'))
    } finally {
      sincronizandoRef.current = false
      setCarregando(false)
    }
  }

  async function copiarLink(link: string, id: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(id)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      // fallback silencioso
    }
  }

  function abrirSeletorDeCliente() {
    setClienteIdSelecionado('')
    setErroSeletor('')
    setModalSelecionarClienteAberto(true)
  }

  function confirmarSeleçãoCliente() {
    if (!clienteIdSelecionado) {
      setErroSeletor('Selecione um cliente para continuar.')
      return
    }
    const cliente = clientes.find((c) => c.id === clienteIdSelecionado)
    if (!cliente) return

    setModalSelecionarClienteAberto(false)
    setClienteParaModal({ id: cliente.id, nome: cliente.nome, email: cliente.email })
    setModalEnvioAberto(true)
  }

  return (
    <>
      {/* Seletor de cliente */}
      <Modal
        aberto={modalSelecionarClienteAberto}
        aoFechar={() => setModalSelecionarClienteAberto(false)}
        titulo="Selecionar cliente"
        descricao="Escolha o cliente aguardando assinatura para enviar o contrato."
        rodape={
          <div className="flex justify-end gap-2">
            <BotaoPrimario type="button" onClick={confirmarSeleçãoCliente}>
              Continuar
            </BotaoPrimario>
          </div>
        }
      >
        <div className="space-y-3">
          {clientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum cliente com status "Aguardando assinatura". Aprove um cadastro primeiro.
            </p>
          ) : (
            <>
              <SelectPadrao
                rotulo="Cliente"
                valor={clienteIdSelecionado}
                aoMudar={(v) => {
                  setClienteIdSelecionado(v)
                  setErroSeletor('')
                }}
                opcoes={clientes.map((c) => ({
                  value: c.id,
                  label: c.email ? `${c.nome} (${c.email})` : `${c.nome} — sem e-mail`,
                }))}
                placeholder="Selecione o cliente..."
              />
              {erroSeletor && (
                <p className="text-sm text-destructive">{erroSeletor}</p>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* Modal ZapSign 2 passos */}
      {clienteParaModal && (
        <ModalEnviarDocumentoCliente
          cliente={clienteParaModal}
          aberto={modalEnvioAberto}
          aoFechar={() => setModalEnvioAberto(false)}
          aoEnviar={() => {
            setModalEnvioAberto(false)
            carregar()
          }}
        />
      )}

      <CardPadrao
        titulo="Documentos enviados para assinatura"
        acoes={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={sincronizarECarregar}
              disabled={carregando}
            >
              {carregando ? 'Atualizando...' : 'Atualizar'}
            </Button>
            <BotaoPrimario
              type="button"
              size="sm"
              onClick={abrirSeletorDeCliente}
            >
              Enviar documento
            </BotaoPrimario>
          </div>
        }
      >
        {erro && (
          <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erro}
          </p>
        )}

        {carregando && documentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : documentos.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum documento enviado ainda.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={abrirSeletorDeCliente}
            >
              Enviar primeiro documento
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Documento" coluna="documento" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                  <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Signatário" coluna="signatario" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                  <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Status" coluna="status" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                  <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Data" coluna="data" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                  <th className="px-4 py-3 text-left font-medium">Link</th>
                </tr>
              </thead>
              <tbody>
                {documentosExibidos.map((doc) => {
                  const { variante, rotulo } = statusParaBadge(doc.status)
                  const dataPrincipal = doc.assinadoEm || doc.recusadoEm || doc.criadoEm
                  const labelData = doc.assinadoEm
                    ? 'Assinado em'
                    : doc.recusadoEm
                    ? 'Recusado em'
                    : 'Enviado em'

                  return (
                    <tr
                      key={doc.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium leading-tight">{doc.nomeDocumento}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate max-w-[160px]">
                          {doc.tokenZapsign}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{doc.signatarioNome ?? '—'}</p>
                        {doc.signatarioEmail && (
                          <p className="text-xs text-muted-foreground">{doc.signatarioEmail}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <BadgeStatus variante={variante}>{rotulo}</BadgeStatus>
                        {doc.motivoRecusa && (
                          <p
                            className="mt-1 text-xs text-destructive truncate max-w-[150px]"
                            title={doc.motivoRecusa}
                          >
                            {doc.motivoRecusa}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-xs text-muted-foreground">{labelData}</p>
                        <p>{formatarData(dataPrincipal)}</p>
                      </td>
                      <td className="px-4 py-3">
                        {doc.linkAssinatura ? (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={doc.linkAssinatura}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline underline-offset-4 text-xs"
                            >
                              Abrir
                            </a>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => copiarLink(doc.linkAssinatura!, doc.id)}
                            >
                              {copiado === doc.id ? '✓ Copiado' : 'Copiar'}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardPadrao>
    </>
  )
}
