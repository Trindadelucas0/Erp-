'use client'

import { ChangeEvent, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ConfirmacaoComSenha } from '@/components/compartilhado/confirmacao-com-senha'
import { ModalConfirmacao } from '@/components/compartilhado/modal-confirmacao'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { TextareaPadrao } from '@/components/ui/textarea-padrao'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  ACCEPT_ANEXO_FORNECEDOR,
  formatarTamanhoAnexo,
  MENSAGEM_TIPOS_ANEXO_PERMITIDOS,
  rotuloTipoAnexo,
} from '@/lib/anexo-fornecedor'
import type {
  StatusConferenciaAnexo,
  RelatorioConferencia,
} from '@/components/pedidos-compra/modal-conferencia-ia'
import {
  CardDocumentoFornecedor,
  formatarDataHoraDocumento,
  organizarAnexosPorDocumento,
  rotuloStatusConferencia,
} from '@/components/pedidos-compra/lista-documentos-fornecedor'
import {
  ModalEscolherTelefoneWhatsapp,
  processarAvisoWhatsappPortal,
} from '@/components/pedidos-compra/modal-escolher-telefone-whatsapp'
import {
  mensagemToastAvisoWhatsapp,
  type AvisoWhatsappPortal,
  type TelefoneWhatsappAviso,
} from '@/lib/whatsapp-portal'

export type TipoAnexoFornecedor = 'documento_fornecedor' | 'relatorio_conferencia_ia'

export type AnexoFornecedor = {
  id: string
  nomeArquivo: string
  mimeType: string
  tamanhoBytes: number
  enviadoEm: string
  tipoAnexo: TipoAnexoFornecedor
  anexoOrigemId: string | null
  conferidoEm: string | null
  statusConferencia: StatusConferenciaAnexo
  motivoAjuste: string | null
  relatorioConferencia: RelatorioConferencia | null
}

type ModoDecisaoAnexo = 'aprovar' | 'ajuste'

function isDocumentoFornecedor(anexo: AnexoFornecedor): boolean {
  return anexo.tipoAnexo === 'documento_fornecedor'
}

type Props = {
  pedidoId: string
  status: string
  podeEditar: boolean
  portalLiberadoEm: string | null
  portalBloqueadoEm: string | null
  anexosFornecedor: AnexoFornecedor[]
  mensagemPortal: string
  mensagemDocumentos: string
  liberandoPortal: boolean
  voltandoParaRascunho: boolean
  enviandoAnexo: boolean
  formatarData: (iso: string) => string
  onLiberarPortal: () => void
  onVoltarParaRascunho: () => void
  onEnviarAnexo: (e: ChangeEvent<HTMLInputElement>) => void
  onBaixarAnexo: (anexo: AnexoFornecedor) => void
  onAbrirConferencia: (anexo: AnexoFornecedor) => void
  onAnexoExcluido: (anexoId: string) => void
  onAnexoDecidido: () => void
  onPedidoAprovado: () => void
}

export function AbaAvaliacaoPedido({
  pedidoId,
  status,
  podeEditar,
  portalLiberadoEm,
  portalBloqueadoEm,
  anexosFornecedor,
  mensagemPortal,
  mensagemDocumentos,
  liberandoPortal,
  voltandoParaRascunho,
  enviandoAnexo,
  formatarData,
  onLiberarPortal,
  onVoltarParaRascunho,
  onEnviarAnexo,
  onBaixarAnexo,
  onAbrirConferencia,
  onAnexoExcluido,
  onAnexoDecidido,
  onPedidoAprovado,
}: Props) {
  const [anexoParaExcluir, setAnexoParaExcluir] = useState<AnexoFornecedor | null>(null)
  const [excluindoAnexo, setExcluindoAnexo] = useState(false)
  const [erroExclusao, setErroExclusao] = useState('')
  const [mostrandoSenhaAprovacao, setMostrandoSenhaAprovacao] = useState(false)
  const [aprovandoPedido, setAprovandoPedido] = useState(false)
  const [erroAprovacao, setErroAprovacao] = useState('')
  const [confirmandoVoltarRascunho, setConfirmandoVoltarRascunho] = useState(false)

  const [anexoDecisaoId, setAnexoDecisaoId] = useState<string | null>(null)
  const [modoDecisao, setModoDecisao] = useState<ModoDecisaoAnexo | null>(null)
  const [motivoAjusteDigitado, setMotivoAjusteDigitado] = useState('')
  const [decidindoAnexo, setDecidindoAnexo] = useState(false)
  const [erroDecisaoAnexo, setErroDecisaoAnexo] = useState('')
  const [mensagemDecisaoAnexo, setMensagemDecisaoAnexo] = useState('')
  const [escolhaWhatsapp, setEscolhaWhatsapp] = useState<{
    telefones: TelefoneWhatsappAviso[]
    texto: string
  } | null>(null)

  const temAnexoAprovado = anexosFornecedor.some(
    (a) => isDocumentoFornecedor(a) && a.statusConferencia === 'aprovado'
  )
  const podeAprovarPedido = podeEditar && status === 'enviado'
  const podeVoltarParaRascunho =
    podeEditar &&
    status === 'enviado' &&
    !!portalLiberadoEm &&
    !portalBloqueadoEm

  const { documentos, relatoriosAvulsos } = useMemo(
    () => organizarAnexosPorDocumento(anexosFornecedor),
    [anexosFornecedor]
  )

  function fecharPainelDecisao() {
    setAnexoDecisaoId(null)
    setModoDecisao(null)
    setMotivoAjusteDigitado('')
    setErroDecisaoAnexo('')
  }

  function abrirPainelDecisao(anexoId: string, modo: ModoDecisaoAnexo) {
    setMensagemDecisaoAnexo('')
    setErroDecisaoAnexo('')
    setMotivoAjusteDigitado('')
    setAnexoDecisaoId(anexoId)
    setModoDecisao(modo)
  }

  async function confirmarExclusaoAnexo() {
    if (!anexoParaExcluir) return
    setExcluindoAnexo(true)
    setErroExclusao('')
    try {
      await clienteHttp.delete(
        `/pedidos-compra/${pedidoId}/anexos-fornecedor/${anexoParaExcluir.id}`
      )
      if (anexoDecisaoId === anexoParaExcluir.id) {
        fecharPainelDecisao()
      }
      onAnexoExcluido(anexoParaExcluir.id)
      setAnexoParaExcluir(null)
    } catch (e: unknown) {
      setErroExclusao(extrairMensagemApi(e, 'Erro ao excluir o documento.'))
    } finally {
      setExcluindoAnexo(false)
    }
  }

  async function confirmarAprovacaoPedido() {
    setAprovandoPedido(true)
    setErroAprovacao('')
    try {
      await clienteHttp.post(`/pedidos-compra/${pedidoId}/aprovar`)
      setMostrandoSenhaAprovacao(false)
      onPedidoAprovado()
    } catch (e: unknown) {
      setErroAprovacao(extrairMensagemApi(e, 'Erro ao aprovar o pedido.'))
    } finally {
      setAprovandoPedido(false)
    }
  }

  async function confirmarAprovacaoDocumento(anexoId: string) {
    setDecidindoAnexo(true)
    setErroDecisaoAnexo('')
    try {
      const { data } = await clienteHttp.post(
        `/pedidos-compra/${pedidoId}/anexos-fornecedor/${anexoId}/aprovar`
      )
      const aviso = data as AvisoWhatsappPortal
      processarAvisoWhatsappPortal(aviso, setEscolhaWhatsapp)
      const mensagem = mensagemToastAvisoWhatsapp(aviso, 'Documento aprovado')
      fecharPainelDecisao()
      setMensagemDecisaoAnexo(mensagem)
      onAnexoDecidido()
    } catch (e: unknown) {
      setErroDecisaoAnexo(extrairMensagemApi(e, 'Erro ao aprovar o documento.'))
    } finally {
      setDecidindoAnexo(false)
    }
  }

  async function confirmarSolicitacaoAjuste(anexoId: string) {
    if (!motivoAjusteDigitado.trim()) {
      setErroDecisaoAnexo('Descreva o motivo da divergência.')
      return
    }
    setDecidindoAnexo(true)
    setErroDecisaoAnexo('')
    try {
      const { data } = await clienteHttp.post(
        `/pedidos-compra/${pedidoId}/anexos-fornecedor/${anexoId}/solicitar-ajuste`,
        { motivo: motivoAjusteDigitado.trim() }
      )
      const aviso = data as AvisoWhatsappPortal
      processarAvisoWhatsappPortal(aviso, setEscolhaWhatsapp)
      const mensagem = mensagemToastAvisoWhatsapp(aviso, 'Ajuste solicitado')
      fecharPainelDecisao()
      setMensagemDecisaoAnexo(mensagem)
      onAnexoDecidido()
    } catch (e: unknown) {
      setErroDecisaoAnexo(extrairMensagemApi(e, 'Erro ao solicitar o ajuste.'))
    } finally {
      setDecidindoAnexo(false)
    }
  }

  function metadadosDocumento(anexo: AnexoFornecedor): string {
    const partes = [
      rotuloTipoAnexo(anexo.mimeType, anexo.nomeArquivo),
      formatarTamanhoAnexo(anexo.tamanhoBytes),
      `enviado ${formatarData(anexo.enviadoEm)}`,
    ]
    if (anexo.conferidoEm) {
      partes.push(`conferido ${formatarDataHoraDocumento(anexo.conferidoEm)}`)
    }
    return partes.join(' · ')
  }

  function painelDecisaoDocumento(anexo: AnexoFornecedor) {
    if (anexoDecisaoId !== anexo.id || !modoDecisao) return null

    return (
      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-sm font-medium">
          {modoDecisao === 'aprovar' ? 'Aprovar documento' : 'Solicitar ajuste'}
        </p>
        {erroDecisaoAnexo && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erroDecisaoAnexo}
          </p>
        )}
        {modoDecisao === 'aprovar' ? (
          <ConfirmacaoComSenha
            mensagem="Confirme sua senha para aprovar este documento."
            onConfirmar={() => void confirmarAprovacaoDocumento(anexo.id)}
            onCancelar={fecharPainelDecisao}
            carregandoExterno={decidindoAnexo}
          />
        ) : (
          <div className="space-y-2">
            <TextareaPadrao
              rotulo="Motivo da divergência *"
              value={motivoAjusteDigitado}
              onChange={(e) => setMotivoAjusteDigitado(e.target.value)}
              placeholder="Descreva o que precisa ser corrigido pelo fornecedor"
              disabled={decidindoAnexo}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={fecharPainelDecisao}
                disabled={decidindoAnexo}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void confirmarSolicitacaoAjuste(anexo.id)}
                disabled={decidindoAnexo}
              >
                {decidindoAnexo ? 'Enviando...' : 'Enviar solicitação'}
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  function acoesDocumento(anexo: AnexoFornecedor) {
    return (
      <>
        <Button type="button" variant="outline" size="sm" onClick={() => onBaixarAnexo(anexo)}>
          Baixar
        </Button>
        {podeEditar && anexo.statusConferencia === 'pendente' && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAbrirConferencia(anexo)}
            >
              {anexo.relatorioConferencia || anexo.conferidoEm
                ? 'Ver relatório'
                : 'Conferir com IA'}
            </Button>
            <BotaoPrimario
              type="button"
              size="sm"
              onClick={() => abrirPainelDecisao(anexo.id, 'aprovar')}
              disabled={decidindoAnexo}
            >
              Aprovar
            </BotaoPrimario>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => abrirPainelDecisao(anexo.id, 'ajuste')}
              disabled={decidindoAnexo}
            >
              Solicitar ajuste
            </Button>
          </>
        )}
        {podeEditar && anexo.statusConferencia !== 'aprovado' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            aria-label={`Excluir ${anexo.nomeArquivo}`}
            onClick={() => {
              setErroExclusao('')
              setAnexoParaExcluir(anexo)
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </>
    )
  }

  function historicoRelatorios(relatorios: AnexoFornecedor[]) {
    if (relatorios.length === 0) return null
    return (
      <div className="mt-1 space-y-1.5 border-t border-border pt-2">
        <p className="text-xs font-medium text-muted-foreground">Histórico de conferências IA</p>
        <ul className="space-y-1">
          {relatorios.map((relatorio) => (
            <li
              key={relatorio.id}
              className="flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <span className="text-muted-foreground">
                {formatarDataHoraDocumento(relatorio.enviadoEm)} ·{' '}
                {formatarTamanhoAnexo(relatorio.tamanhoBytes)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={() => onBaixarAnexo(relatorio)}
              >
                Baixar
              </Button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <CardPadrao
        compacto
        titulo="Portal do fornecedor"
        descricao={
          portalBloqueadoEm
            ? `Bloqueado em ${formatarData(portalBloqueadoEm)}`
            : portalLiberadoEm
              ? `Liberado em ${formatarData(portalLiberadoEm)}`
              : 'O fornecedor acessa com CNPJ + senha (número do pedido) e envia o documento oficial.'
        }
        acoes={
          podeEditar &&
          (!portalLiberadoEm || portalBloqueadoEm ? (
            <BotaoPrimario type="button" onClick={onLiberarPortal} disabled={liberandoPortal}>
              {liberandoPortal ? 'Liberando...' : 'Liberar para fornecedor'}
            </BotaoPrimario>
          ) : podeVoltarParaRascunho ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmandoVoltarRascunho(true)}
              disabled={voltandoParaRascunho}
            >
              {voltandoParaRascunho ? 'Voltando...' : 'Voltar pedido para rascunho'}
            </Button>
          ) : null)
        }
      >
        {mensagemPortal && <p className="text-sm text-muted-foreground">{mensagemPortal}</p>}
      </CardPadrao>

      <CardPadrao
        compacto
        titulo="Documentos do fornecedor"
        descricao="Documentos enviados pelo fornecedor no portal ou anexados por você. Baixe para conferir manualmente, aprove ou solicite ajuste — Conferir com IA é opcional."
      >
        {podeEditar && (
          <div className="mb-3 space-y-1">
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-primary hover:underline">
              {enviandoAnexo ? 'Enviando...' : 'Anexar documento do fornecedor'}
              <input
                type="file"
                className="hidden"
                accept={ACCEPT_ANEXO_FORNECEDOR}
                disabled={enviandoAnexo}
                onChange={onEnviarAnexo}
              />
            </label>
            <p className="text-xs text-muted-foreground">{MENSAGEM_TIPOS_ANEXO_PERMITIDOS}</p>
          </div>
        )}

        {mensagemDocumentos && (
          <p className="mb-2 text-sm text-muted-foreground">{mensagemDocumentos}</p>
        )}

        {mensagemDecisaoAnexo && (
          <p className="mb-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
            {mensagemDecisaoAnexo}
          </p>
        )}

        {erroExclusao && (
          <p className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erroExclusao}
          </p>
        )}

        {anexosFornecedor.length > 0 ? (
          <div className="space-y-3">
            {documentos.map(({ documento, relatorios }) => (
              <CardDocumentoFornecedor
                key={documento.id}
                nomeArquivo={documento.nomeArquivo}
                metadados={metadadosDocumento(documento)}
                status={rotuloStatusConferencia(documento.statusConferencia, {
                  conferidoEm: documento.conferidoEm,
                  contexto: 'erp',
                })}
                destaque={documento.statusConferencia === 'aprovado'}
                acoes={acoesDocumento(documento)}
                painelDecisao={painelDecisaoDocumento(documento)}
                motivoAjuste={
                  documento.statusConferencia === 'ajuste_solicitado'
                    ? documento.motivoAjuste
                    : null
                }
                historicoRelatorios={historicoRelatorios(relatorios)}
              />
            ))}

            {relatoriosAvulsos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Relatórios IA avulsos</p>
                {relatoriosAvulsos.map((relatorio) => (
                  <CardDocumentoFornecedor
                    key={relatorio.id}
                    nomeArquivo={relatorio.nomeArquivo}
                    metadados={`Relatório IA · ${formatarTamanhoAnexo(relatorio.tamanhoBytes)} · ${formatarDataHoraDocumento(relatorio.enviadoEm)}`}
                    status={{ texto: 'Relatório IA', variante: 'pendente' }}
                    acoes={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onBaixarAnexo(relatorio)}
                      >
                        Baixar
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum documento anexado ainda.</p>
        )}
      </CardPadrao>

      {podeAprovarPedido && (
        <CardPadrao
          compacto
          titulo="Aprovar pedido"
          descricao={
            temAnexoAprovado
              ? 'Documento aceito. O pedido pode ser aprovado e seguir para o sistema.'
              : 'Aprove ao menos um documento do fornecedor antes de aprovar o pedido.'
          }
        >
          {erroAprovacao && (
            <p className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erroAprovacao}
            </p>
          )}
          {mostrandoSenhaAprovacao ? (
            <ConfirmacaoComSenha
              mensagem="Confirme sua senha para aprovar este pedido."
              onConfirmar={confirmarAprovacaoPedido}
              onCancelar={() => setMostrandoSenhaAprovacao(false)}
              carregandoExterno={aprovandoPedido}
            />
          ) : (
            <BotaoPrimario
              type="button"
              onClick={() => setMostrandoSenhaAprovacao(true)}
              disabled={!temAnexoAprovado}
            >
              Aprovar pedido
            </BotaoPrimario>
          )}
        </CardPadrao>
      )}

      <ModalConfirmacao
        aberto={!!anexoParaExcluir}
        titulo="Excluir documento"
        mensagem={`Tem certeza que deseja excluir "${anexoParaExcluir?.nomeArquivo ?? ''}"? Essa ação não pode ser desfeita.`}
        textoConfirmar={excluindoAnexo ? 'Excluindo...' : 'Excluir'}
        textoCancelar="Cancelar"
        aoConfirmar={() => void confirmarExclusaoAnexo()}
        aoCancelar={() => setAnexoParaExcluir(null)}
      />

      <ModalConfirmacao
        aberto={confirmandoVoltarRascunho}
        titulo="Voltar pedido para rascunho"
        mensagem="Este pedido não ficará mais disponível ao fornecedor no portal. Quer continuar?"
        textoConfirmar={voltandoParaRascunho ? 'Voltando...' : 'Continuar'}
        textoCancelar="Cancelar"
        aoConfirmar={() => {
          setConfirmandoVoltarRascunho(false)
          onVoltarParaRascunho()
        }}
        aoCancelar={() => setConfirmandoVoltarRascunho(false)}
      />

      <ModalEscolherTelefoneWhatsapp
        aberto={Boolean(escolhaWhatsapp)}
        telefones={escolhaWhatsapp?.telefones ?? []}
        texto={escolhaWhatsapp?.texto ?? ''}
        aoFechar={() => setEscolhaWhatsapp(null)}
      />
    </div>
  )
}

