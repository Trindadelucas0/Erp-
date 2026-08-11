'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { usePermissao } from '@/hooks/use-permissao'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Checkbox } from '@/components/ui/checkbox'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'
import { Modal } from '@/components/ui/modal'
import { FormularioContaPagar } from '@/components/contas-a-pagar/formulario-conta-pagar'
import {
  BadgeStatusContaPagar,
  BadgeTipoContaPagar,
  CelulaVencimentoContaPagar,
} from '@/components/contas-a-pagar/badges-conta-pagar'
import {
  ContaPagarLista,
  FormContaPagar,
  classeLinhaStatusContaPagar,
  contaParaForm,
  diasAteVencimento,
  formatarCodigoContaPagar,
  formatarDataBr,
  formatarMoedaBr,
  tituloVencido,
} from '@/lib/contas-a-pagar'

type Opcao = { id: string; nome: string; codigo?: string }

type LinhaBaixa = {
  contaId: string
  parcelaId: string
  selecionado: boolean
  valorPrincipal: string
  valorJuros: string
  valorMulta: string
  conta: ContaPagarLista
}

type Props = {
  fornecedores: Opcao[]
  planos: Opcao[]
  /** Chamado após baixa bem-sucedida (para a aba Títulos atualizar). */
  aoBaixar?: () => void
}

function parseNum(texto: string): number {
  const t = texto.trim().replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}

export function TelaBaixasContasAPagar({ fornecedores, planos, aoBaixar }: Props) {
  const podeEditar = usePermissao('financeiro:edit')
  const [linhas, setLinhas] = useState<LinhaBaixa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [baixando, setBaixando] = useState(false)
  const [pagoEm, setPagoEm] = useState(() => new Date().toISOString().slice(0, 10))
  const [detalhe, setDetalhe] = useState<{ conta: ContaPagarLista; form: FormContaPagar } | null>(
    null
  )

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const { data } = await clienteHttp.get<{ contas: ContaPagarLista[] }>(
        '/contas-a-pagar/para-baixar'
      )
      setLinhas(
        (data.contas ?? [])
          .filter((c) => c.parcelaId)
          .map((c) => ({
            contaId: c.id,
            parcelaId: c.parcelaId!,
            selecionado: false,
            valorPrincipal: String(c.saldoDevedor ?? c.valorTotal).replace('.', ','),
            valorJuros: '0',
            valorMulta: '0',
            conta: c,
          }))
      )
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Falha ao listar títulos para baixa.'))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const selecionadas = useMemo(() => linhas.filter((l) => l.selecionado), [linhas])

  const totais = useMemo(() => {
    let principal = 0
    let juros = 0
    let multa = 0
    for (const l of selecionadas) {
      principal += parseNum(l.valorPrincipal)
      juros += parseNum(l.valorJuros)
      multa += parseNum(l.valorMulta)
    }
    return {
      qtd: selecionadas.length,
      principal,
      juros,
      multa,
      total: principal + juros + multa,
    }
  }, [selecionadas])

  function alternarTodas(marcar: boolean) {
    setLinhas((prev) => prev.map((l) => ({ ...l, selecionado: marcar })))
  }

  function patchLinha(parcelaId: string, parcial: Partial<LinhaBaixa>) {
    setLinhas((prev) =>
      prev.map((l) => (l.parcelaId === parcelaId ? { ...l, ...parcial } : l))
    )
  }

  async function baixarSelecionados() {
    if (!podeEditar) return
    if (selecionadas.length === 0) {
      setErro('Selecione ao menos um título.')
      return
    }
    for (const l of selecionadas) {
      const principal = parseNum(l.valorPrincipal)
      const saldo = l.conta.saldoDevedor ?? 0
      if (principal <= 0) {
        setErro(`Informe o valor principal do título ${formatarCodigoContaPagar(l.conta.codigo)}.`)
        return
      }
      if (principal > saldo + 0.009) {
        setErro(
          `Principal do título ${formatarCodigoContaPagar(l.conta.codigo)} passa do saldo (${formatarMoedaBr(saldo)}).`
        )
        return
      }
    }

    setBaixando(true)
    setErro(null)
    try {
      await clienteHttp.post('/contas-a-pagar/baixas', {
        pagoEm: pagoEm || null,
        itens: selecionadas.map((l) => ({
          parcelaId: l.parcelaId,
          valorPrincipal: parseNum(l.valorPrincipal),
          valorJuros: parseNum(l.valorJuros),
          valorMulta: parseNum(l.valorMulta),
          valorDesconto: 0,
        })),
      })
      await carregar()
      aoBaixar?.()
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível baixar os títulos.'))
    } finally {
      setBaixando(false)
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
        Marque os títulos e ajuste o <strong className="text-foreground">Principal</strong> (pode
        ser parcial). <strong className="text-foreground">Juros</strong> e{' '}
        <strong className="text-foreground">Multa</strong> entram no pagamento sem reduzir o saldo.
      </div>

      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-[10rem]">
          <InputPadrao
            rotulo="Data pagamento"
            type="date"
            value={pagoEm}
            onChange={(e) => setPagoEm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void carregar()} disabled={carregando}>
            Atualizar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => alternarTodas(true)}
            disabled={carregando || linhas.length === 0}
          >
            Marcar todos
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => alternarTodas(false)}
            disabled={carregando || linhas.length === 0}
          >
            Desmarcar
          </Button>
          {podeEditar && (
            <Button
              type="button"
              disabled={baixando || selecionadas.length === 0}
              onClick={() => void baixarSelecionados()}
            >
              {baixando
                ? 'Baixando…'
                : `Baixar selecionados (${selecionadas.length})`}
            </Button>
          )}
        </div>
      </div>

      {erro && (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      )}

      <div className="min-w-0 overflow-x-auto rounded-md border">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-2 py-2">
                <Checkbox
                  checked={linhas.length > 0 && linhas.every((l) => l.selecionado)}
                  onCheckedChange={(v) => alternarTodas(v === true)}
                  aria-label="Selecionar todos"
                />
              </th>
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Emissão</th>
              <th className="px-3 py-2 font-medium">Vencimento</th>
              <th className="px-3 py-2 font-medium">Fornecedor</th>
              <th className="px-3 py-2 font-medium">Documento</th>
              <th className="px-3 py-2 font-medium">Valor</th>
              <th className="px-3 py-2 font-medium">Saldo</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Principal</th>
              <th className="px-3 py-2 font-medium">Juros</th>
              <th className="px-3 py-2 font-medium">Multa</th>
              <th className="px-3 py-2 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <LinhasSkeletonTabela colunas={14} linhas={6} />
            ) : linhas.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum título aberto para baixa.
                </td>
              </tr>
            ) : (
              linhas.map((linha) => {
                const dias = diasAteVencimento(linha.conta.vencimento)
                const vencido = tituloVencido(linha.conta.status, linha.conta.vencimento)
                const baseClass = classeLinhaStatusContaPagar(linha.conta.status, vencido)
                return (
                  <tr
                    key={linha.parcelaId}
                    className={`border-t ${
                      linha.selecionado ? 'bg-primary/10 ring-1 ring-inset ring-primary/20' : baseClass
                    }`}
                  >
                    <td className="px-2 py-2">
                      <Checkbox
                        checked={linha.selecionado}
                        onCheckedChange={(v) =>
                          patchLinha(linha.parcelaId, { selecionado: v === true })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {linha.conta.codigoExibicao ??
                        formatarCodigoContaPagar(linha.conta.codigo)}
                    </td>
                    <td className="px-3 py-2">{formatarDataBr(linha.conta.dataEmissao)}</td>
                    <td className="px-3 py-2">
                      <CelulaVencimentoContaPagar
                        status={linha.conta.status}
                        vencimento={linha.conta.vencimento}
                        dataFormatada={formatarDataBr(linha.conta.vencimento)}
                        dias={dias}
                      />
                    </td>
                    <td className="px-3 py-2">{linha.conta.pessoa?.nome ?? '—'}</td>
                    <td className="px-3 py-2">{linha.conta.numeroDocumento || '—'}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatarMoedaBr(linha.conta.valorTotal)}
                    </td>
                    <td className="px-3 py-2 tabular-nums font-medium">
                      {formatarMoedaBr(linha.conta.saldoDevedor ?? 0)}
                    </td>
                    <td className="px-3 py-2">
                      <BadgeTipoContaPagar tipo={linha.conta.tipo} />
                    </td>
                    <td className="px-3 py-2">
                      <BadgeStatusContaPagar status={linha.conta.status} />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="h-8 w-24 rounded-md border border-input bg-background px-2 text-sm"
                        value={linha.valorPrincipal}
                        disabled={!podeEditar}
                        onChange={(e) =>
                          patchLinha(linha.parcelaId, { valorPrincipal: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm"
                        value={linha.valorJuros}
                        disabled={!podeEditar}
                        onChange={(e) =>
                          patchLinha(linha.parcelaId, { valorJuros: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm"
                        value={linha.valorMulta}
                        disabled={!podeEditar}
                        onChange={(e) =>
                          patchLinha(linha.parcelaId, { valorMulta: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setDetalhe({
                            conta: linha.conta,
                            form: contaParaForm(linha.conta),
                          })
                        }
                      >
                        Ver
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 rounded-md border bg-card px-3 py-3 text-sm shadow-xs">
        <span>
          Selecionados: <strong>{totais.qtd}</strong>
        </span>
        <span>
          Principal: <strong>{formatarMoedaBr(totais.principal)}</strong>
        </span>
        <span>
          Juros: <strong>{formatarMoedaBr(totais.juros)}</strong>
        </span>
        <span>
          Multa: <strong>{formatarMoedaBr(totais.multa)}</strong>
        </span>
        <span className="text-foreground">
          Total da baixa:{' '}
          <strong className="text-base">{formatarMoedaBr(totais.total)}</strong>
        </span>
      </div>

      <Modal
        aberto={Boolean(detalhe)}
        aoFechar={() => setDetalhe(null)}
        titulo={
          detalhe
            ? `Título ${formatarCodigoContaPagar(detalhe.conta.codigo)}`
            : 'Título'
        }
        descricao="Visualização do título (somente leitura na baixa)."
        cabecalhoExtra={
          detalhe ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <BadgeStatusContaPagar status={detalhe.conta.status} />
              <BadgeTipoContaPagar tipo={detalhe.conta.tipo} />
            </div>
          ) : undefined
        }
        largura="3xl"
        rodape={
          <Button type="button" variant="outline" onClick={() => setDetalhe(null)}>
            Fechar
          </Button>
        }
      >
        {detalhe && (
          <FormularioContaPagar
            form={detalhe.form}
            aoMudar={() => undefined}
            fornecedores={fornecedores}
            planos={planos}
            codigoExibicao={
              detalhe.conta.codigoExibicao ?? formatarCodigoContaPagar(detalhe.conta.codigo)
            }
            somenteLeitura
          />
        )}
      </Modal>
    </div>
  )
}
