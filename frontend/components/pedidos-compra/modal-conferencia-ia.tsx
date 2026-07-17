'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { BadgeStatus } from '@/components/ui/badge-status'
import { TextareaPadrao } from '@/components/ui/textarea-padrao'
import { ConfirmacaoComSenha } from '@/components/compartilhado/confirmacao-com-senha'
import {
  RelatorioConferenciaVisual,
  type RelatorioConferencia,
} from '@/components/conferencia-arquivo/relatorio-conferencia-visual'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  mensagemToastAvisoWhatsapp,
  processarAvisoWhatsappPortal,
  type AvisoWhatsappPortal,
} from '@/lib/whatsapp-portal'

export type StatusConferenciaAnexo = 'pendente' | 'aprovado' | 'ajuste_solicitado'
export type { RelatorioConferencia }

type Props = {
  aberto: boolean
  pedidoId: string
  anexoId: string
  nomeArquivo: string
  statusConferencia: StatusConferenciaAnexo
  motivoAjuste: string | null
  relatorioInicial?: RelatorioConferencia | null
  aoFechar: () => void
  aoDecidir: () => void
  aoConferirConcluida: () => void
}

const ROTULO_STATUS_DECISAO: Record<
  StatusConferenciaAnexo,
  { texto: string; variante: 'ativo' | 'pendente' | 'reprovado' | 'sucesso' }
> = {
  pendente: { texto: 'Em conferência', variante: 'pendente' },
  aprovado: { texto: 'Aprovado', variante: 'sucesso' },
  ajuste_solicitado: { texto: 'Ajuste solicitado', variante: 'reprovado' },
}

const ETAPAS_CONFERENCIA_IA = [
  { limite: 25, texto: 'Lendo o documento...' },
  { limite: 55, texto: 'Enviando para a IA...' },
  { limite: 80, texto: 'Comparando com o pedido...' },
  { limite: 100, texto: 'Montando o relatório...' },
]

function etapaConferenciaIa(progresso: number): string {
  return (
    ETAPAS_CONFERENCIA_IA.find((etapa) => progresso < etapa.limite)?.texto ??
    ETAPAS_CONFERENCIA_IA[ETAPAS_CONFERENCIA_IA.length - 1].texto
  )
}

export function ModalConferenciaIa({
  aberto,
  pedidoId,
  anexoId,
  nomeArquivo,
  statusConferencia,
  motivoAjuste,
  relatorioInicial,
  aoFechar,
  aoDecidir,
  aoConferirConcluida,
}: Props) {
  const [carregando, setCarregando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [erro, setErro] = useState('')
  const [relatorio, setRelatorio] = useState<RelatorioConferencia | null>(relatorioInicial ?? null)
  const [baixandoPdf, setBaixandoPdf] = useState(false)

  const [statusAtual, setStatusAtual] = useState(statusConferencia)
  const [motivoAtual, setMotivoAtual] = useState(motivoAjuste)
  const [mostrandoSenha, setMostrandoSenha] = useState(false)
  const [mostrandoFormAjuste, setMostrandoFormAjuste] = useState(false)
  const [motivoDigitado, setMotivoDigitado] = useState('')
  const [erroDecisao, setErroDecisao] = useState('')
  const [decidindo, setDecidindo] = useState(false)
  const [mensagemDecisao, setMensagemDecisao] = useState('')

  useEffect(() => {
    if (!carregando) return

    const intervalo = setInterval(() => {
      setProgresso((atual) => {
        if (atual >= 90) return atual
        return Math.min(90, atual + (atual < 60 ? 4 : 1))
      })
    }, 300)

    return () => clearInterval(intervalo)
  }, [carregando])

  function fechar() {
    setErro('')
    setMostrandoSenha(false)
    setMostrandoFormAjuste(false)
    setMotivoDigitado('')
    setErroDecisao('')
    setMensagemDecisao('')
    aoFechar()
  }

  async function conferir() {
    if (carregando) return
    setCarregando(true)
    setProgresso(0)
    setErro('')
    setRelatorio(null)
    try {
      const { data } = await clienteHttp.post(
        `/pedidos-compra/${pedidoId}/anexos-fornecedor/${anexoId}/conferir-ia`,
        undefined,
        // Pior caso do retry+fallback da IA (2x timeout de 60s + 1x fallback): ~182s.
        { timeout: 210000 }
      )
      setProgresso(100)
      setRelatorio(data.relatorio)
      aoConferirConcluida()
    } catch (e: unknown) {
      setProgresso(100)
      setErro(extrairMensagemApi(e, 'Erro ao conferir o documento com a IA.'))
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 300))
      setCarregando(false)
    }
  }

  async function baixarPdf() {
    if (baixandoPdf) return
    setBaixandoPdf(true)
    try {
      const resposta = await clienteHttp.get(
        `/pedidos-compra/${pedidoId}/anexos-fornecedor/${anexoId}/relatorio-conferencia-pdf`,
        { responseType: 'blob' }
      )
      const url = window.URL.createObjectURL(new Blob([resposta.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `relatorio-conferencia-${nomeArquivo.replace(/\.[^.]+$/, '')}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setErro(extrairMensagemApi(e, 'Erro ao baixar o PDF da conferência.'))
    } finally {
      setBaixandoPdf(false)
    }
  }

  async function confirmarAprovacao() {
    setDecidindo(true)
    setErroDecisao('')
    setMostrandoSenha(false)
    try {
      const { data } = await clienteHttp.post(
        `/pedidos-compra/${pedidoId}/anexos-fornecedor/${anexoId}/aprovar`
      )
      setStatusAtual('aprovado')
      setMotivoAtual(null)
      const aviso = data as AvisoWhatsappPortal
      processarAvisoWhatsappPortal(aviso)
      setMensagemDecisao(mensagemToastAvisoWhatsapp(aviso, 'Documento aprovado'))
      aoDecidir()
    } catch (e: unknown) {
      setErroDecisao(extrairMensagemApi(e, 'Erro ao aprovar o documento.'))
    } finally {
      setDecidindo(false)
    }
  }

  async function confirmarSolicitacaoAjuste() {
    if (!motivoDigitado.trim()) {
      setErroDecisao('Descreva o motivo da divergência.')
      return
    }
    setDecidindo(true)
    setErroDecisao('')
    try {
      const { data } = await clienteHttp.post(
        `/pedidos-compra/${pedidoId}/anexos-fornecedor/${anexoId}/solicitar-ajuste`,
        { motivo: motivoDigitado.trim(), relatorio }
      )
      setStatusAtual('ajuste_solicitado')
      setMotivoAtual(motivoDigitado.trim())
      setMostrandoFormAjuste(false)
      setMotivoDigitado('')
      const aviso = data as AvisoWhatsappPortal
      processarAvisoWhatsappPortal(aviso)
      setMensagemDecisao(mensagemToastAvisoWhatsapp(aviso, 'Ajuste solicitado'))
      aoDecidir()
    } catch (e: unknown) {
      setErroDecisao(extrairMensagemApi(e, 'Erro ao solicitar o ajuste.'))
    } finally {
      setDecidindo(false)
    }
  }

  return (
    <>
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      titulo="Conferir com IA"
      descricao={`Documento: ${nomeArquivo}`}
      largura="4xl"
      alturaMinimaConteudo={carregando || relatorio ? 'lg' : undefined}
      rodape={
        <div className="flex w-full justify-end gap-2">
          <Button type="button" variant="outline" onClick={fechar} disabled={carregando}>
            Fechar
          </Button>
          {relatorio && !carregando && (
            <Button type="button" variant="outline" onClick={baixarPdf} disabled={baixandoPdf}>
              {baixandoPdf ? 'Baixando...' : 'Baixar PDF'}
            </Button>
          )}
          {statusAtual === 'pendente' && (
            <BotaoPrimario type="button" onClick={conferir} disabled={carregando}>
              {carregando ? 'Conferindo...' : relatorio ? 'Conferir novamente' : 'Conferir com IA'}
            </BotaoPrimario>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {erro && !carregando && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
        )}

        {carregando && (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <Loader2 className="size-6 animate-spin text-primary" />
            <div className="w-full max-w-sm space-y-2">
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={progresso}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progresso da conferência com IA"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                  style={{ width: `${progresso}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {etapaConferenciaIa(progresso)} {progresso}%
              </p>
            </div>
          </div>
        )}

        {!relatorio && !carregando && !erro && (
          <p className="text-sm text-muted-foreground">
            A IA extrai os dados deste documento e compara com os itens do pedido lançado no ERP.
            Nada é aplicado automaticamente — o resultado é só para conferência.
          </p>
        )}

        {relatorio && !carregando && (
          <>
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Decisão do comprador</p>
                <BadgeStatus variante={ROTULO_STATUS_DECISAO[statusAtual].variante}>
                  {ROTULO_STATUS_DECISAO[statusAtual].texto}
                </BadgeStatus>
              </div>

              {statusAtual === 'ajuste_solicitado' && motivoAtual && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  Motivo do ajuste: {motivoAtual}
                </p>
              )}

              {mensagemDecisao && (
                <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{mensagemDecisao}</p>
              )}

              {erroDecisao && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erroDecisao}</p>
              )}

              {statusAtual !== 'pendente' ? null : mostrandoSenha ? (
                <ConfirmacaoComSenha
                  mensagem="Confirme sua senha para aprovar este documento."
                  onConfirmar={confirmarAprovacao}
                  onCancelar={() => setMostrandoSenha(false)}
                  carregandoExterno={decidindo}
                />
              ) : mostrandoFormAjuste ? (
                <div className="space-y-2">
                  <TextareaPadrao
                    rotulo="Motivo da divergência *"
                    value={motivoDigitado}
                    onChange={(e) => setMotivoDigitado(e.target.value)}
                    placeholder="Descreva o que precisa ser corrigido pelo fornecedor"
                    disabled={decidindo}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setMostrandoFormAjuste(false)
                        setMotivoDigitado('')
                        setErroDecisao('')
                      }}
                      disabled={decidindo}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => void confirmarSolicitacaoAjuste()}
                      disabled={decidindo}
                    >
                      {decidindo ? 'Enviando...' : 'Enviar solicitação'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <BotaoPrimario type="button" onClick={() => setMostrandoSenha(true)} disabled={decidindo}>
                    Aprovar
                  </BotaoPrimario>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setMostrandoFormAjuste(true)}
                    disabled={decidindo}
                  >
                    Solicitar ajuste
                  </Button>
                </div>
              )}
            </div>

            <RelatorioConferenciaVisual relatorio={relatorio} />
          </>
        )}
      </div>
    </Modal>
    </>
  )
}
