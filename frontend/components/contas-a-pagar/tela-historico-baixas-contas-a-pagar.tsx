'use client'

import { useCallback, useEffect, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'
import { Modal } from '@/components/ui/modal'
import {
  BadgeOrigemContaPagar,
  BadgeStatusContaPagar,
} from '@/components/contas-a-pagar/badges-conta-pagar'
import {
  ContaPagarLista,
  HistoricoBaixaLista,
  formatarCodigoContaPagar,
  formatarDataBr,
  formatarMoedaBr,
} from '@/lib/contas-a-pagar'

type Props = {
  /** Incrementar para forçar recarga (ex.: após nova baixa). */
  recarregarToken?: number
}

export function TelaHistoricoBaixasContasAPagar({ recarregarToken = 0 }: Props) {
  const [linhas, setLinhas] = useState<HistoricoBaixaLista[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [pagoEmDe, setPagoEmDe] = useState('')
  const [pagoEmAte, setPagoEmAte] = useState('')
  const [q, setQ] = useState('')
  const [detalhe, setDetalhe] = useState<ContaPagarLista | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const params: Record<string, string> = {}
      if (pagoEmDe) params.pagoEmDe = pagoEmDe
      if (pagoEmAte) params.pagoEmAte = pagoEmAte
      if (q.trim()) params.q = q.trim()
      const { data } = await clienteHttp.get<{ baixas: HistoricoBaixaLista[] }>(
        '/contas-a-pagar/historico-baixas',
        { params }
      )
      setLinhas(data.baixas ?? [])
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Falha ao listar pagamentos.'))
    } finally {
      setCarregando(false)
    }
  }, [pagoEmDe, pagoEmAte, q])

  useEffect(() => {
    void carregar()
  }, [carregar, recarregarToken])

  async function abrirDetalhe(contaPagarId: string) {
    setCarregandoDetalhe(true)
    setErro(null)
    try {
      const { data } = await clienteHttp.get<{ conta: ContaPagarLista }>(
        `/contas-a-pagar/${contaPagarId}`
      )
      setDetalhe(data.conta)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Falha ao abrir o título.'))
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <p className="text-sm text-muted-foreground">
        Histórico do que já foi pago (principal, juros e multa). Clique em uma linha para ver o
        título completo: valor original, o que já pagou e o que ainda falta.
      </p>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InputPadrao
          rotulo="Pago de"
          type="date"
          value={pagoEmDe}
          onChange={(e) => setPagoEmDe(e.target.value)}
        />
        <InputPadrao
          rotulo="Pago até"
          type="date"
          value={pagoEmAte}
          onChange={(e) => setPagoEmAte(e.target.value)}
        />
        <InputPadrao
          rotulo="Busca (código, doc, fornecedor)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex items-end gap-2">
          <Button type="button" onClick={() => void carregar()} disabled={carregando}>
            Filtrar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPagoEmDe('')
              setPagoEmAte('')
              setQ('')
              void (async () => {
                setCarregando(true)
                setErro(null)
                try {
                  const { data } = await clienteHttp.get<{ baixas: HistoricoBaixaLista[] }>(
                    '/contas-a-pagar/historico-baixas'
                  )
                  setLinhas(data.baixas ?? [])
                } catch (e) {
                  setErro(extrairMensagemApi(e, 'Falha ao listar pagamentos.'))
                } finally {
                  setCarregando(false)
                }
              })()
            }}
          >
            Limpar
          </Button>
        </div>
      </div>

      {erro && (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      )}

      <div className="min-w-0 overflow-x-auto rounded-md border">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Pago em</th>
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Fornecedor</th>
              <th className="px-3 py-2 font-medium">Documento</th>
              <th className="px-3 py-2 font-medium">Principal</th>
              <th className="px-3 py-2 font-medium">Juros</th>
              <th className="px-3 py-2 font-medium">Multa</th>
              <th className="px-3 py-2 font-medium">Total pago</th>
              <th className="px-3 py-2 font-medium">Saldo título</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <LinhasSkeletonTabela colunas={10} linhas={6} />
            ) : linhas.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum pagamento encontrado.
                </td>
              </tr>
            ) : (
              linhas.map((linha) => (
                <tr
                  key={linha.id}
                  className="cursor-pointer border-t hover:bg-muted/40"
                  onClick={() => void abrirDetalhe(linha.contaPagarId)}
                >
                  <td className="px-3 py-2">{formatarDataBr(linha.pagoEm)}</td>
                  <td className="px-3 py-2 font-medium">
                    {linha.codigoExibicao ?? formatarCodigoContaPagar(linha.codigo)}
                  </td>
                  <td className="px-3 py-2">{linha.pessoa?.nome ?? '—'}</td>
                  <td className="px-3 py-2">{linha.numeroDocumento || '—'}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatarMoedaBr(linha.valorPrincipal)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatarMoedaBr(linha.valorJuros)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatarMoedaBr(linha.valorMulta)}</td>
                  <td className="px-3 py-2 tabular-nums font-medium">
                    {formatarMoedaBr(linha.valorTotalPago)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatarMoedaBr(linha.saldoDevedorTitulo)}
                  </td>
                  <td className="px-3 py-2">
                    <BadgeStatusContaPagar status={linha.statusConta} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        aberto={Boolean(detalhe) || carregandoDetalhe}
        aoFechar={() => setDetalhe(null)}
        titulo={
          detalhe
            ? `Título ${detalhe.codigoExibicao ?? formatarCodigoContaPagar(detalhe.codigo)}`
            : 'Carregando…'
        }
        descricao="Resumo do documento: valor, pagamentos feitos e saldo em aberto."
        largura="3xl"
        rodape={
          <Button type="button" variant="outline" onClick={() => setDetalhe(null)}>
            Fechar
          </Button>
        }
      >
        {detalhe && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <BadgeStatusContaPagar status={detalhe.status} />
              <BadgeOrigemContaPagar origem={detalhe.origem} />
            </div>

            <div className="grid gap-2 rounded-md border bg-muted/20 p-3 sm:grid-cols-2">
              <div>
                <div className="text-muted-foreground">Fornecedor</div>
                <div className="font-medium">{detalhe.pessoa?.nome ?? '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Documento</div>
                <div className="font-medium">{detalhe.numeroDocumento || '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Valor do título</div>
                <div className="font-medium tabular-nums">
                  {formatarMoedaBr(detalhe.valorTotal)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Já pago (principal)</div>
                <div className="font-medium tabular-nums text-emerald-700">
                  {formatarMoedaBr(detalhe.valorPagoPrincipal ?? 0)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Juros pagos (baixas)</div>
                <div className="tabular-nums">
                  {formatarMoedaBr(detalhe.totalJurosBaixas ?? 0)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Multas pagas (baixas)</div>
                <div className="tabular-nums">
                  {formatarMoedaBr(detalhe.totalMultaBaixas ?? 0)}
                </div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-muted-foreground">Ainda falta (saldo)</div>
                <div
                  className={`text-base font-semibold tabular-nums ${
                    (detalhe.saldoDevedor ?? 0) > 0.009 ? 'text-destructive' : 'text-emerald-700'
                  }`}
                >
                  {formatarMoedaBr(detalhe.saldoDevedor ?? 0)}
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 font-medium">Pagamentos feitos</h3>
              {(detalhe.baixas?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground">Nenhuma baixa neste título.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Data</th>
                        <th className="px-3 py-2">Parc.</th>
                        <th className="px-3 py-2">Principal</th>
                        <th className="px-3 py-2">Juros</th>
                        <th className="px-3 py-2">Multa</th>
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2">Usuário</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhe.baixas!.map((b) => (
                        <tr key={b.id} className="border-t">
                          <td className="px-3 py-2">{formatarDataBr(b.pagoEm)}</td>
                          <td className="px-3 py-2">{b.numeroParcela ?? '—'}</td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatarMoedaBr(b.valorPrincipal)}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatarMoedaBr(b.valorJuros)}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatarMoedaBr(b.valorMulta)}
                          </td>
                          <td className="px-3 py-2 tabular-nums font-medium">
                            {formatarMoedaBr(b.valorTotalPago)}
                          </td>
                          <td className="px-3 py-2">{b.usuario?.name ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
