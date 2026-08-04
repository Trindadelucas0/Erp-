'use client'

import { useEffect, useMemo, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  formatarMoedaKardex,
  formatarQtdEstoque,
  type FornecedorVinculoKardex,
} from '@/lib/estoque'
import { Modal } from '@/components/ui/modal'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Button } from '@/components/ui/button'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type ModoAjuste = 'quantidade_final' | 'entrada' | 'saida'

type Props = {
  aberto: boolean
  produtoId: string
  produtoRotulo: string
  fisicoAtual: number
  precoCustoAtual: number | null
  fornecedores: FornecedorVinculoKardex[]
  aoFechar: () => void
  aoSalvar: (aviso?: string) => void
}

const MODOS: { valor: ModoAjuste; rotulo: string }[] = [
  { valor: 'quantidade_final', rotulo: 'Quantidade final' },
  { valor: 'entrada', rotulo: 'Entrada' },
  { valor: 'saida', rotulo: 'Saída' },
]

function parseNumeroBr(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function formatarPrecoInput(valor: number | null): string {
  if (valor == null || Number.isNaN(valor)) return ''
  return String(valor).replace('.', ',')
}

export function ModalAjusteInventario({
  aberto,
  produtoId,
  produtoRotulo,
  fisicoAtual,
  precoCustoAtual,
  fornecedores,
  aoFechar,
  aoSalvar,
}: Props) {
  const [modo, setModo] = useState<ModoAjuste>('quantidade_final')
  const [quantidade, setQuantidade] = useState('')
  const [precoCusto, setPrecoCusto] = useState('')
  const [observacao, setObservacao] = useState('')
  const [fornecedorPessoaId, setFornecedorPessoaId] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setModo('quantidade_final')
    setQuantidade('')
    setPrecoCusto(formatarPrecoInput(precoCustoAtual))
    setObservacao('')
    setFornecedorPessoaId('')
    setErro('')
  }, [aberto, precoCustoAtual])

  const preview = useMemo(() => {
    const qtd = parseNumeroBr(quantidade)
    if (qtd == null) return null

    let delta: number
    let fisicoApos: number

    if (modo === 'quantidade_final') {
      fisicoApos = qtd
      delta = Math.round((qtd - fisicoAtual) * 10000) / 10000
    } else if (modo === 'entrada') {
      if (qtd < 0) return null
      delta = qtd
      fisicoApos = Math.round((fisicoAtual + qtd) * 10000) / 10000
    } else {
      if (qtd < 0) return null
      delta = -qtd
      fisicoApos = Math.round((fisicoAtual - qtd) * 10000) / 10000
    }

    return { delta, fisicoApos }
  }, [quantidade, modo, fisicoAtual])

  const rotuloQuantidade =
    modo === 'quantidade_final'
      ? 'Quantidade final (físico)'
      : modo === 'entrada'
        ? 'Quantidade da entrada'
        : 'Quantidade da saída'

  async function salvar() {
    setErro('')
    const qtd = parseNumeroBr(quantidade)
    if (qtd == null) {
      setErro('Informe a quantidade válida')
      return
    }
    if ((modo === 'entrada' || modo === 'saida') && qtd <= 0) {
      setErro('Informe uma quantidade maior que zero')
      return
    }
    if (!observacao.trim()) {
      setErro('Observação é obrigatória')
      return
    }

    const precoParseado = parseNumeroBr(precoCusto)
    if (precoCusto.trim() && precoParseado == null) {
      setErro('Preço de custo inválido')
      return
    }
    if (precoParseado != null && precoParseado < 0) {
      setErro('Preço de custo não pode ser negativo')
      return
    }

    const body: {
      observacao: string
      fornecedorPessoaId: string | null
      precoCusto: number | null
      quantidadeNova?: number
      delta?: number
    } = {
      observacao: observacao.trim(),
      fornecedorPessoaId: fornecedorPessoaId || null,
      precoCusto: precoCusto.trim() ? precoParseado : null,
    }

    if (modo === 'quantidade_final') {
      body.quantidadeNova = qtd
    } else if (modo === 'entrada') {
      body.delta = qtd
    } else {
      body.delta = -qtd
    }

    setSalvando(true)
    try {
      const { data } = await clienteHttp.post<{
        avisoSemCusto?: boolean
        precoCustoGravado?: number | null
      }>(`/estoque/${produtoId}/ajuste-inventario`, body)
      const aviso =
        data.avisoSemCusto
          ? 'Ajuste gravado. Sem preço de custo nesta linha — coluna Preço/Custo ficou vazia.'
          : undefined
      aoSalvar(aviso)
      aoFechar()
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível gravar o ajuste'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Ajuste de inventário"
      descricao="Altera apenas o estoque físico (e o disponível). O estoque fiscal não muda."
      largura="md"
      rodape={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <BotaoPrimario type="button" onClick={salvar} disabled={salvando}>
            {salvando ? 'Gravando…' : 'Gravar ajuste'}
          </BotaoPrimario>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
          <p>
            Produto:{' '}
            <span className="font-medium text-foreground">{produtoRotulo}</span>
          </p>
          <p className="mt-1">
            Físico atual:{' '}
            <span className="font-medium tabular-nums text-foreground">
              {formatarQtdEstoque(fisicoAtual)}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Custo no cadastro: {formatarMoedaKardex(precoCustoAtual)}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Modo do ajuste</Label>
          <div className="flex flex-wrap gap-2">
            {MODOS.map((m) => {
              const ativo = modo === m.valor
              return (
                <button
                  key={m.valor}
                  type="button"
                  onClick={() => {
                    setModo(m.valor)
                    setQuantidade('')
                    setErro('')
                  }}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                    ativo
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background text-foreground hover:bg-muted',
                  )}
                  aria-pressed={ativo}
                >
                  {m.rotulo}
                </button>
              )
            })}
          </div>
        </div>

        <InputPadrao
          rotulo={rotuloQuantidade}
          obrigatorio
          type="text"
          inputMode="decimal"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          placeholder={modo === 'quantidade_final' ? 'Ex.: 100' : 'Ex.: 10'}
        />

        {preview && preview.delta !== 0 && (
          <div className="rounded-md border border-dashed px-3 py-2 text-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Prévia
            </p>
            <p className="mt-1 tabular-nums">
              {formatarQtdEstoque(fisicoAtual)}
              <span className="mx-1.5 text-muted-foreground">→</span>
              <span
                className={cn(
                  'font-medium',
                  preview.delta > 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-700 dark:text-rose-400',
                )}
              >
                {preview.delta > 0 ? '+' : ''}
                {formatarQtdEstoque(preview.delta)}
              </span>
              <span className="mx-1.5 text-muted-foreground">→</span>
              <span className="font-semibold">{formatarQtdEstoque(preview.fisicoApos)}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Físico atual · delta · físico após
            </p>
          </div>
        )}

        <InputPadrao
          rotulo="Preço de custo (na linha)"
          type="text"
          inputMode="decimal"
          value={precoCusto}
          onChange={(e) => setPrecoCusto(e.target.value)}
          placeholder="Ex.: 5,04"
        />
        <p className="-mt-2 text-xs text-muted-foreground">
          Snapshot gravado no kardex. Deixe vazio para linha sem custo.
        </p>

        <div className="space-y-2">
          <Label htmlFor="fornecedor-inventario">Fornecedor (opcional)</Label>
          <select
            id="fornecedor-inventario"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            value={fornecedorPessoaId}
            onChange={(e) => setFornecedorPessoaId(e.target.value)}
            disabled={fornecedores.length === 0}
          >
            <option value="">
              {fornecedores.length === 0
                ? 'Produto sem vínculo de fornecedor'
                : 'Nenhum'}
            </option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.fornecedorPessoaId}>
                {f.nome}
                {f.documento ? ` · ${f.documento}` : ''}
                {f.codigoFornecedor ? ` · cód. ${f.codigoFornecedor}` : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Só lista fornecedores já vinculados no cadastro do produto. Aparece como
            Parceiro na grade.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="obs-inventario">
            Observação / motivo<span className="ml-0.5 text-destructive">*</span>
          </Label>
          <textarea
            id="obs-inventario"
            className="min-h-[88px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Motivo obrigatório do ajuste"
          />
        </div>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
      </div>
    </Modal>
  )
}
